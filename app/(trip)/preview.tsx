import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, Image } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle2, MessageSquare, Share2, Info, Camera, Phone } from 'lucide-react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

export default function TripPreviewScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const router = useRouter()
  
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [smsSending, setSmsSending] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loadingPhoto, setLoadingPhoto] = useState<string | null>(null)

  useEffect(() => {
    fetchTripDetails()
  }, [tripId])

  const fetchTripDetails = async () => {
    if (!tripId) return

    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        trucks (registration_number),
        drivers (full_name)
      `)
      .eq('id', tripId)
      .single()

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setTrip(data)
      
      // Check if loading photo exists
      const { data: photoData } = await supabase
        .from('trip_photos')
        .select('photo_url')
        .eq('trip_id', tripId)
        .eq('photo_type', 'LOADING')
        .single()
        
      if (photoData) {
        setLoadingPhoto(photoData.photo_url)
      }
    }
    setLoading(false)
  }

  const generateHTML = () => {
    return `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1C1C1A; }
            .header { text-align: center; margin-bottom: 40px; }
            .title { font-size: 24px; font-weight: bold; color: #1A5EB8; }
            .subtitle { font-size: 14px; color: #6B6B66; }
            .grid { display: flex; flex-wrap: wrap; margin-bottom: 20px; }
            .col { flex: 1; min-width: 50%; margin-bottom: 16px; }
            .label { font-size: 12px; color: #6B6B66; text-transform: uppercase; }
            .val { font-size: 16px; font-weight: bold; margin-top: 4px; }
            .divider { height: 1px; background-color: #E5E4E0; margin: 24px 0; }
            .footer { text-align: center; font-size: 12px; color: #6B6B66; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Vypaar Express Lorry Receipt</div>
            <div class="subtitle">LR No: ${trip.lr_number} | Date: ${new Date().toLocaleDateString('en-GB')}</div>
          </div>
          
          <div class="grid">
            <div class="col">
              <div class="label">From</div>
              <div class="val">${trip.origin}</div>
            </div>
            <div class="col">
              <div class="label">To</div>
              <div class="val">${trip.destination}</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="grid">
            <div class="col">
              <div class="label">Goods</div>
              <div class="val">${trip.goods}</div>
            </div>
            <div class="col">
              <div class="label">Weight</div>
              <div class="val">${trip.weight_kg} kg</div>
            </div>
            <div class="col">
              <div class="label">Freight Amount</div>
              <div class="val">₹${trip.freight_amount}</div>
            </div>
            ${trip.invoice_number ? `
            <div class="col">
              <div class="label">Invoice No</div>
              <div class="val">${trip.invoice_number}</div>
            </div>` : ''}
          </div>

          <div class="divider"></div>

          <div class="grid">
            <div class="col">
              <div class="label">Truck Number</div>
              <div class="val">${trip.trucks?.registration_number}</div>
            </div>
            <div class="col">
              <div class="label">Driver</div>
              <div class="val">${trip.drivers?.full_name}</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="grid">
            <div class="col">
              <div class="label">Sender</div>
              <div class="val">${trip.sender_details[0]?.name} <br> ${trip.sender_details[0]?.phone}</div>
            </div>
            <div class="col">
              <div class="label">Receiver</div>
              <div class="val">${trip.receiver_name} <br> ${trip.receiver_phone}</div>
            </div>
          </div>

          <div class="footer">This is a computer-generated Lorry Receipt — Vypaar Express</div>
        </body>
      </html>
    `
  }

  const handleShareWhatsApp = async () => {
    if (!trip) return
    setSharing(true)

    try {
      // 1. Mock edge function call
      console.log('MOCK EDGE FUNCTION CALL: send-notifications', { tripId: trip.id, type: 'WHATSAPP' })
      
      // 2. Generate PDF
      const { uri } = await Print.printToFileAsync({ html: generateHTML() })

      // 3. Upload PDF to Supabase
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      const filePath = `${trip.tenant_id}/${trip.lr_number}-${Date.now()}.pdf`
      
      const { error: uploadError } = await supabase.storage.from('lr-pdfs').upload(filePath, decode(base64), {
        contentType: 'application/pdf'
      })

      if (!uploadError) {
        await supabase.from('trips').update({ lr_pdf_url: filePath }).eq('id', trip.id)
      }

      // 4. Share via OS Share dialog (which includes WhatsApp)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })
        Alert.alert('Success', `Sent to ${trip.sender_details[0]?.name} via WhatsApp`)
      } else {
        Alert.alert('Sharing not available on this device')
      }

    } catch (error: any) {
      Alert.alert('Error sharing', error.message)
    }

    setSharing(false)
  }

  const handleSendSMS = () => {
    if (!trip) return
    setSmsSending(true)
    
    setTimeout(() => {
      console.log('MOCK EDGE FUNCTION CALL: send-notifications', { tripId: trip.id, type: 'SMS' })
      setSmsSending(false)
      Alert.alert('Success', 'SMS sent successfully')
    }, 1000)
  }

  const handleUploadPhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
    if (permissionResult.granted === false) {
      Alert.alert('Permission to access camera is required!')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    })

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setUploadingPhoto(true)
      
      try {
        const filePath = `${trip.tenant_id}/${trip.id}-loading-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage.from('trip-photos').upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg'
        })

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('trip-photos').getPublicUrl(filePath)
        
        await supabase.from('trip_photos').insert({
          trip_id: trip.id,
          photo_type: 'LOADING',
          photo_url: data.publicUrl
        })

        setLoadingPhoto(data.publicUrl)
      } catch (error: any) {
        Alert.alert('Error uploading photo', error.message)
      }
      setUploadingPhoto(false)
    }
  }

  const handleContinue = () => {
    router.replace('/(tabs)')
  }

  if (loading || !trip) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {trip.ewaybill_required && (
          <TouchableOpacity style={styles.infoBanner} onPress={() => Linking.openURL('https://ewaybillgst.gov.in')}>
            <Info color={Colors.primary} size={20} />
            <Text style={styles.infoBannerText}>E-way bill required → Generate on GST Portal</Text>
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <Text style={styles.cardHeader}>Vypaar Express LR</Text>
          <Text style={styles.lrNumber}>{trip.lr_number}</Text>
          
          <View style={styles.cardDivider} />
          
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Origin</Text>
              <Text style={styles.value}>{trip.origin}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Destination</Text>
              <Text style={styles.value}>{trip.destination}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Goods</Text>
              <Text style={styles.value}>{trip.goods}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Weight</Text>
              <Text style={styles.value}>{trip.weight_kg} kg</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Truck</Text>
              <Text style={styles.value}>{trip.trucks?.registration_number}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Driver</Text>
              <Text style={styles.value}>{trip.drivers?.full_name}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <Text style={styles.footerText}>This is a computer-generated Lorry Receipt — Vypaar Express</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShareWhatsApp} disabled={sharing}>
            {sharing ? <ActivityIndicator color={Colors.primary} /> : <Share2 color={Colors.primary} size={20} />}
            <Text style={styles.actionText}>Send via WhatsApp</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleSendSMS} disabled={smsSending}>
            {smsSending ? <ActivityIndicator color={Colors.primary} /> : <MessageSquare color={Colors.primary} size={20} />}
            <Text style={styles.actionText}>Send SMS copy</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleUploadPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator color={Colors.primary} />
            ) : loadingPhoto ? (
              <>
                <CheckCircle2 color={Colors.success} size={20} />
                <Text style={[styles.actionText, { color: Colors.success }]}>Loading photo uploaded</Text>
              </>
            ) : (
              <>
                <Camera color={Colors.primary} size={20} />
                <Text style={styles.actionText}>Upload loading photo</Text>
              </>
            )}
          </TouchableOpacity>
          
          {loadingPhoto && (
            <Image source={{ uri: loadingPhoto }} style={styles.thumbnail} />
          )}
        </View>
        
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Go to Dashboard" onPress={handleContinue} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24 },
  infoBanner: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16, alignItems: 'center' },
  infoBannerText: { flex: 1, marginLeft: 12, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary },
  card: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
  cardHeader: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  lrNumber: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: Colors.textPrimary, textAlign: 'center', marginTop: 4 },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  col: { flex: 1 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  value: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 16 },
  actions: { gap: 12 },
  actionButton: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary, marginLeft: 8 },
  thumbnail: { width: '100%', height: 160, borderRadius: 12, marginTop: 12, resizeMode: 'cover' },
  footer: { padding: 24, paddingTop: 16, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
})
