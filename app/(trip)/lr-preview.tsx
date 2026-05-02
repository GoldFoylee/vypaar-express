import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Share, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Share2, Download, MessageCircle, FileText } from 'lucide-react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as WebBrowser from 'expo-web-browser'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

export default function LRPreviewScreen() {
  const router = useRouter()
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const tenantId = useStore((state) => state.tenantId)

  const [trip, setTrip] = useState<any>(null)
  const [truck, setTruck] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    if (tripId) fetchTrip()
  }, [tripId])

  const fetchTrip = async () => {
    try {
      const { data: tripData, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      if (error) throw error
      setTrip(tripData)

      if (tripData.truck_id) {
        const { data: truckData } = await supabase.from('trucks').select('*').eq('id', tripData.truck_id).single()
        setTruck(truckData)
      }
      if (tripData.driver_id) {
        const { data: driverData } = await supabase.from('drivers').select('*').eq('id', tripData.driver_id).single()
        setDriver(driverData)
      }
      if (tripData.tenant_id) {
        const { data: tenantData } = await supabase.from('tenants').select('company_name, gst_number, phone').eq('id', tripData.tenant_id).single()
        setTenant(tenantData)
      }
    } catch (e: any) {
      console.error(e)
      Alert.alert('Error', 'Failed to load trip details.')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    if (!trip) return
    try {
      await Share.share({
        message: `Vypaar Express Lorry Receipt\nLR No: ${trip.lr_number}\nFrom: ${trip.origin}\nTo: ${trip.destination}`,
      })
    } catch (error: any) {
      Alert.alert('Error', error.message)
    }
  }

  const generateHTML = () => {
    const senderHTML = trip.senders.map((s: any) => `<div>${s.name}<br/>+91 ${s.phone}${s.gst ? '<br/>GST: ' + s.gst : ''}</div>`).join('<br/><br/>')
    const receiverHTML = trip.receivers.map((r: any) => `<div>${r.name}<br/>+91 ${r.phone}${r.gst ? '<br/>GST: ' + r.gst : ''}</div>`).join('<br/><br/>')

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #1C1C1A; }
            .header { text-align: center; border-bottom: 2px solid #1C1C1A; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; color: #1A5EB8; }
            .header h2 { margin: 5px 0 0 0; font-size: 18px; color: #6B6B66; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .box { border: 1px solid #E5E4E0; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
            .box-title { font-size: 12px; font-weight: bold; color: #6B6B66; margin-bottom: 5px; }
            .flex-row { display: flex; gap: 10px; }
            .flex-half { flex: 1; border: 1px solid #E5E4E0; padding: 10px; border-radius: 4px; }
            .footer { margin-top: 30px; font-size: 12px; color: #6B6B66; text-align: center; border-top: 1px solid #E5E4E0; padding-top: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table, th, td { border: 1px solid #E5E4E0; }
            th, td { padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${tenant?.company_name?.toUpperCase() || 'VYPAAR EXPRESS'}</h1>
            ${tenant?.gst_number ? `<h2 style="font-size: 14px; margin-top: 5px;">GST: ${tenant.gst_number}</h2>` : ''}
            <h2>LORRY RECEIPT (L.R.)</h2>
          </div>
          
          <div class="row">
            <div><strong>LR No:</strong> ${trip.lr_number}</div>
            <div><strong>Date:</strong> ${new Date(trip.created_at).toLocaleDateString('en-GB')}</div>
          </div>

          <div class="flex-row" style="margin-bottom: 10px;">
            <div class="flex-half">
              <div class="box-title">FROM</div>
              <div><strong>${trip.origin}</strong></div>
            </div>
            <div class="flex-half">
              <div class="box-title">TO</div>
              <div><strong>${trip.destination}</strong></div>
            </div>
          </div>

          <div class="box">
            <div class="box-title">CONSIGNOR (SENDER)</div>
            ${senderHTML}
          </div>

          <div class="box">
            <div class="box-title">CONSIGNEE (RECEIVER)</div>
            ${receiverHTML}
          </div>

          <div class="box">
            <div class="box-title">GOODS DETAILS</div>
            <p style="margin-top: 0"><strong>${trip.goods_description}</strong></p>
            <table>
              <tr>
                <td>Quantity</td>
                <td><strong>${trip.quantity ? `${trip.quantity} ${trip.quantity_unit || ''}` : '-'}</strong></td>
              </tr>
              <tr>
                <td>Weight</td>
                <td><strong>${Number(trip.weight_kg).toLocaleString('en-IN')} kg</strong></td>
              </tr>
              <tr>
                <td>Freight</td>
                <td><strong>₹${Number(trip.freight_amount).toLocaleString('en-IN')}</strong></td>
              </tr>
              ${trip.goods_value ? `
              <tr>
                <td>Goods Value</td>
                <td><strong>₹${Number(trip.goods_value).toLocaleString('en-IN')}</strong></td>
              </tr>` : ''}
            </table>
          </div>

          <div class="box">
            <div class="box-title">VEHICLE & DRIVER DETAILS</div>
            <table>
              <tr>
                <td>Vehicle No</td>
                <td><strong>${truck?.registration_number || 'N/A'}</strong></td>
              </tr>
              <tr>
                <td>Driver</td>
                <td><strong>${driver?.full_name || 'N/A'}</strong></td>
              </tr>
              <tr>
                <td>Driver Mob</td>
                <td><strong>+91 ${driver?.mobile_number || 'N/A'}</strong></td>
              </tr>
            </table>
          </div>

          <div class="footer">
            This is a computer-generated Lorry Receipt issued by ${tenant?.company_name || 'Vypaar Express'}.<br/>
            Subject to standard T&C.
          </div>
        </body>
      </html>
    `
  }

  const handleDownloadPDF = async () => {
    if (!trip) return
    setGeneratingPdf(true)
    
    try {
      const { uri } = await Print.printToFileAsync({ html: generateHTML() })
      
      // Share/Save the file locally
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { UTMTitle: trip.lr_number })
      } else {
        Alert.alert('Download complete', `PDF saved to ${uri}`)
      }

      // Try uploading to Supabase
      if (Platform.OS !== 'web') {
        try {
          const response = await fetch(uri)
          const blob = await response.blob()
          const fileName = `${tenantId}/${trip.lr_number}_${Date.now()}.pdf`
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('lr-pdfs')
            .upload(fileName, blob, { contentType: 'application/pdf' })

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase.storage.from('lr-pdfs').getPublicUrl(fileName)
            await supabase.from('trips').update({ lr_pdf_url: publicUrl }).eq('id', trip.id)
            // Silently update state to reflect saved URL if needed later
          } else {
            console.warn('Failed to upload PDF to Supabase', uploadError)
          }
        } catch (uploadEx) {
          console.warn('Exception uploading PDF', uploadEx)
        }
      }

      Alert.alert('Success', 'LR saved and ready to share')

    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate PDF')
      console.error(error)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleWhatsApp = () => {
    Alert.alert('Coming Soon', 'WhatsApp sharing coming soon. Use Download PDF to share manually for now.')
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text>Trip not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lorry Receipt</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Share2 color={Colors.primary} size={24} />
        </TouchableOpacity>
      </View>

      {trip.ewaybill_required && (
        <TouchableOpacity 
          style={styles.ewayBanner} 
          onPress={() => WebBrowser.openBrowserAsync('https://ewaybillgst.gov.in')}
        >
          <Text style={styles.ewayBannerText}>⚠️ E-way bill required for this shipment. Generate on GST Portal →</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.lrCard}>
          <View style={styles.lrHeader}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>{tenant?.company_name?.substring(0, 2).toUpperCase() || 'VE'}</Text>
            </View>
            <View>
              <Text style={styles.companyName}>{tenant?.company_name?.toUpperCase() || 'VYPAAR EXPRESS'}</Text>
              {tenant?.gst_number ? <Text style={styles.tenantGst}>GST: {tenant.gst_number}</Text> : null}
              <Text style={styles.docType}>LORRY RECEIPT (L.R.)</Text>
            </View>
          </View>

          <View style={styles.lrMeta}>
            <View>
              <Text style={styles.metaLabel}>LR No:</Text>
              <Text style={styles.metaValue}>{trip.lr_number}</Text>
            </View>
            <View>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>{new Date(trip.created_at).toLocaleDateString('en-GB')}</Text>
            </View>
          </View>

          <View style={styles.lrRoute}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>FROM</Text>
              <Text style={styles.routeCity}>{trip.origin}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>TO</Text>
              <Text style={styles.routeCity}>{trip.destination}</Text>
            </View>
          </View>

          <View style={styles.lrSection}>
            <Text style={styles.sectionHeader}>CONSIGNOR (SENDER)</Text>
            {trip.senders.map((s: any, idx: number) => (
              <View key={`s-${idx}`} style={{ marginBottom: 8 }}>
                <Text style={styles.partyName}>{s.name}</Text>
                <Text style={styles.partyPhone}>+91 {s.phone}</Text>
                {s.gst ? <Text style={styles.partyGst}>GST: {s.gst}</Text> : null}
              </View>
            ))}
          </View>

          <View style={styles.lrSection}>
            <Text style={styles.sectionHeader}>CONSIGNEE (RECEIVER)</Text>
            {trip.receivers.map((r: any, idx: number) => (
              <View key={`r-${idx}`} style={{ marginBottom: 8 }}>
                <Text style={styles.partyName}>{r.name}</Text>
                <Text style={styles.partyPhone}>+91 {r.phone}</Text>
                {r.gst ? <Text style={styles.partyGst}>GST: {r.gst}</Text> : null}
              </View>
            ))}
          </View>

          <View style={styles.lrSection}>
            <Text style={styles.sectionHeader}>GOODS DESCRIPTION</Text>
            <Text style={styles.goodsText}>{trip.goods_description}</Text>
            
            <View style={styles.goodsMetaRow}>
              <Text style={styles.goodsMetaLabel}>Quantity</Text>
              <Text style={styles.goodsMetaValue}>{trip.quantity ? `${trip.quantity} ${trip.quantity_unit || ''}` : '-'}</Text>
            </View>
            <View style={styles.goodsMetaRow}>
              <Text style={styles.goodsMetaLabel}>Weight</Text>
              <Text style={styles.goodsMetaValue}>{Number(trip.weight_kg).toLocaleString('en-IN')} kg</Text>
            </View>
            <View style={styles.goodsMetaRow}>
              <Text style={styles.goodsMetaLabel}>Freight</Text>
              <Text style={styles.goodsMetaValue}>₹{Number(trip.freight_amount).toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.lrSection}>
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleLabel}>VEHICLE NO</Text>
              <Text style={styles.vehicleValue}>{truck?.registration_number || 'N/A'}</Text>
            </View>
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleLabel}>DRIVER</Text>
              <Text style={styles.vehicleValue}>{driver?.full_name || 'N/A'}</Text>
            </View>
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleLabel}>DRIVER MOB</Text>
              <Text style={styles.vehicleValue}>+91 {driver?.mobile_number || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.lrFooter}>
            <Text style={styles.footerText}>This is a computer-generated Lorry Receipt issued by {tenant?.company_name || 'Vypaar Express'}.</Text>
            <Text style={styles.footerText}>Subject to standard T&C.</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Button 
            title="Download PDF" 
            onPress={handleDownloadPDF} 
            loading={generatingPdf}
          />
          <View style={{ height: 16 }} />
          <Button 
            title="Send via WhatsApp" 
            onPress={handleWhatsApp} 
            variant="secondary"
          />
          
          <TouchableOpacity 
            style={styles.detailsLink}
            onPress={() => router.push(`/(trip-details)/${trip.id}`)}
          >
            <Text style={styles.detailsLinkText}>View Trip Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={styles.dashboardButton}
          >
            <Text style={styles.dashboardButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
        
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  shareButton: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  ewayBanner: { backgroundColor: '#DBEAFE', padding: 12, borderBottomWidth: 1, borderBottomColor: '#BFDBFE' },
  ewayBannerText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary, textAlign: 'center' },
  scrollContent: { padding: 24, paddingBottom: 60 },
  lrCard: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, marginBottom: 24 },
  lrHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 2, borderBottomColor: Colors.textPrimary },
  logoBox: { width: 40, height: 40, backgroundColor: Colors.primary, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logoText: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#FFFFFF' },
  companyName: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  tenantGst: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  docType: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  lrMeta: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  metaLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  metaValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  lrRoute: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: '#FAFAFA' },
  routeLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  routeCity: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  lrSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionHeader: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  partyName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  partyPhone: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  partyGst: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  goodsText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, marginBottom: 12 },
  goodsMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  goodsMetaLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  goodsMetaValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  vehicleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  vehicleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, flex: 1 },
  vehicleValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  lrFooter: { padding: 16, backgroundColor: '#FAFAFA', alignItems: 'center' },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  actionsContainer: { paddingHorizontal: 16 },
  detailsLink: { marginTop: 24, marginBottom: 24, alignItems: 'center' },
  detailsLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.primary },
  dashboardButton: { backgroundColor: '#FFFFFF', borderColor: '#1A5EB8', borderWidth: 1, borderRadius: 8, height: 52, justifyContent: 'center', alignItems: 'center', width: '100%' },
  dashboardButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#1A5EB8' },
})
