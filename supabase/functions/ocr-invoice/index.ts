const INVOICE_EXTRACTION_PROMPT = `
You are an expert OCR and data extraction system specialized in Indian freight invoices and delivery challans.
Extract the structured data from the provided image according to the schema.

CRITICAL INSTRUCTIONS:
1. Validate Image: If the image is NOT a freight invoice, delivery challan, or logistics document (e.g., random photo, blank image), set "is_valid_invoice" to false and return immediately without extracting other data.
2. Senders & Receivers:
   - Sender = Consignor = From party = Shipper.
   - Receiver = Consignee = To party.
   - Normalize names to English if they are in mixed Hindi/English.
   - Phone Numbers: Extract only 10-digit Indian mobile numbers. Strip "+91", "91-", spaces, and dashes.
   - GST number: 15-character alphanumeric Indian GSTIN format (e.g., 22AAAAA0000A1Z5). Extract exactly as printed — uppercase, no spaces. It appears near the party name/address, often labeled "GSTIN", "GST No", "GST Number", or "GSTIN/UIN". If not present, return null.
3. Amounts & Values (CRITICAL DISAMBIGUATION):
   - "freight_amount": This is the TRANSPORT CHARGE for moving the goods. It is DIFFERENT from the goods value.
   - "goods_value": the FINAL total amount payable on the invoice AFTER all taxes. This is the largest rupee amount on the invoice — typically labeled "Grand Total", "Total Amount", "Invoice Total", "Net Payable", or "Total (incl. GST)". It includes the taxable value PLUS CGST, SGST, IGST, and any other charges. Do NOT return the taxable value, subtotal, or pre-GST amount. If the invoice shows: Taxable Value ₹1,00,000 + CGST ₹9,000 + SGST ₹9,000 = Total ₹1,18,000 → return 118000. Return as a number only, no symbols or commas.
   - Do NOT confuse these two. Look for labels like "Freight", "To Pay", "Paid" for freight_amount.
   - Return numbers only (no commas, no ₹).
4. Weight & Quantity:
   - "weight_kg": Convert tonnes/MT to kg (1 tonne = 1000 kg). Return pure numbers (e.g., 2400 instead of "2400 kg").
   - "quantity": the total number of units, bags, boxes, rolls, pieces, or bundles mentioned. Return as a plain number only — no units (e.g. 240 not "240 bags"). If multiple line items exist, return the sum total. If not mentioned, return null.
5. Dates:
   - Always output as "DD/MM/YYYY".
   - Indian invoices typically use DD/MM order. Assume DD/MM when ambiguous.
6. Locations (Origin/Destination):
   - Extract the short city name (e.g., "Mumbai", not "Mumbai, Maharashtra, 400001").
   - Normalize to English.
7. Unreadable Fields:
   - If a field cannot be found or is completely illegible, return null for it. Do NOT guess.
   - Add the key of the unreadable field to the "unreadable_fields" array.
8. Confidence Scores:
   - Provide an overall "confidence" (high/medium/low).
   - Provide a "field_confidence" for each extracted field based on legibility and ambiguity.
`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Validate auth (Check JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify token with Supabase Auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (supabaseUrl && supabaseAnonKey) {
      const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: authHeader,
          apikey: supabaseAnonKey,
        }
      });
      if (!userRes.ok) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // 3. Parse request
    let invoice_url;
    try {
      const body = await req.json();
      invoice_url = body.invoice_url;
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!invoice_url) {
      return new Response(JSON.stringify({ success: false, error: "Missing invoice_url" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 4. Fetch the image
    const imageRes = await fetch(invoice_url);
    if (!imageRes.ok) {
      return new Response(JSON.stringify({ success: false, error: "Failed to fetch image" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const imageBuffer = await imageRes.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    
    const rawMime = imageRes.headers.get('content-type') || '';
    let mimeType = 'image/jpeg';
    if (rawMime.startsWith('image/')) {
      mimeType = rawMime.split(';')[0].trim();
    }
    // Force JPEG for octet-stream or unknown types
    if (mimeType === 'application/octet-stream' || !mimeType.startsWith('image/')) {
      mimeType = 'image/jpeg';
    }
    console.log('[OCR] Raw mime:', rawMime, 'Using mime:', mimeType, 'Image bytes:', uint8Array.length);
    
    // Reliable base64 encoding for Deno - avoids chunking bugs
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binary);
    
    console.log('[OCR] Image size bytes:', uint8Array.length, 'base64 length:', base64Image.length);

    // 5. Send to Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    const model = Deno.env.get('GEMINI_FLASH_MODEL') || 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: INVOICE_EXTRACTION_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            is_valid_invoice: { type: "BOOLEAN" },
            senders: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", nullable: true },
                  phone: { type: "STRING", nullable: true },
                  gst: { type: "STRING", nullable: true }
                }
              }
            },
            receivers: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", nullable: true },
                  phone: { type: "STRING", nullable: true },
                  gst: { type: "STRING", nullable: true }
                }
              }
            },
            goods_description: { type: "STRING", nullable: true },
            quantity: { type: "NUMBER", nullable: true },
            weight_kg: { type: "NUMBER", nullable: true },
            freight_amount: { type: "NUMBER", nullable: true },
            goods_value: { type: "NUMBER", nullable: true },
            invoice_number: { type: "STRING", nullable: true },
            invoice_date: { type: "STRING", nullable: true },
            origin: { type: "STRING", nullable: true },
            destination: { type: "STRING", nullable: true }
          },
          required: ["is_valid_invoice"]
        }
      }
    };

    // Use AbortController for a 20 second hard timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error("Gemini Error:", errorText);
      return new Response(JSON.stringify({ success: false, error: "upstream_error" }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const geminiData = await geminiRes.json();
    
    let extractedJson;
    try {
      const textResponse = geminiData.candidates[0].content.parts[0].text;
      extractedJson = JSON.parse(textResponse);
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", e);
      return new Response(JSON.stringify({ success: false, error: "upstream_error" }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 6. Check if valid invoice
    if (extractedJson.is_valid_invoice === false) {
      return new Response(JSON.stringify({ success: false, error: "not_a_valid_invoice" }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 7. Map and return data
    const { is_valid_invoice, ...dataFields } = extractedJson;

    // Ensure all optional schema fields exist and are null if missing
    const finalData = {
      senders: dataFields.senders || [],
      receivers: dataFields.receivers || [],
      goods_description: dataFields.goods_description ?? null,
      quantity: dataFields.quantity ?? null,
      weight_kg: dataFields.weight_kg ?? null,
      freight_amount: dataFields.freight_amount ?? null,
      goods_value: dataFields.goods_value ?? null,
      invoice_number: dataFields.invoice_number ?? null,
      invoice_date: dataFields.invoice_date ?? null,
      origin: dataFields.origin ?? null,
      destination: dataFields.destination ?? null
    };

    return new Response(JSON.stringify({ 
      success: true, 
      data: finalData
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({ success: false, error: "upstream_error" }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    console.error("Unhandled error:", error);
    return new Response(JSON.stringify({ success: false, error: "upstream_error" }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
