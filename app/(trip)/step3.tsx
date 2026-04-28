import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Camera } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { useTripStore } from '../../store/useTripStore'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'

export default function TripStep3Screen() {
  const router = useRouter()
  const { draft, setDraft } = useTripStore()
  const tenantId = useStore((state) => state.tenantId)
  
  const [trucks, setTrucks] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedTruck, setSelectedTruck] = useState<string>('')
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)

  useEffect(() => {
    fetchAvailableResources()
  }, [])

  const fetchAvailableResources = async () => {
    if (!tenantId) return

    const [trucksRes, driversRes] = await Promise.all([
      supabase.from('trucks').select('*').eq('tenant_id', tenantId).eq('status', 'AVAILABLE'),
      supabase.from('drivers').select('*').eq('tenant_id', tenantId).eq('status', 'AVAILABLE')
    ])

    if (trucksRes.data) setTrucks(trucksRes.data)
    if (driversRes.data) setDrivers(driversRes.data)
    
    setLoading(false)
  }

  const handleScanInvoice = async () => {
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
      setOcrLoading(true)
      
      try {
        // 1. Upload to invoices bucket
        const filePath = `${tenantId}/${Date.now()}-invoice.jpg`
        await supabase.storage.from('invoices').upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg'
        })
        
        // 2. Mock Edge Function Call (ocr-invoice)
        // In real life: await supabase.functions.invoke('ocr-invoice', { body: { invoice_url: filePath } })
        setTimeout(() => {
          const mockData = {
            consignor_name: "Anand Industries",
            consignee_name: "Bharat Steel",
            goods_description: "Steel pipes",
            weight_kg: "2400",
            invoice_number: "INV-2024-001",
            invoice_date: "15/01/2025",
            goods_value: "72000"
          }

          setDraft({
            senders: [{ name: mockData.consignor_name, phone: draft.senders[0]?.phone || '' }],
            receiverName: mockData.consignee_name,
            goodsDescription: mockData.goods_description,
            weightKg: mockData.weight_kg,
            goodsValue: mockData.goods_value,
            invoiceNumber: mockData.invoice_number,
            invoiceDate: mockData.invoice_date,
            ewaybillRequired: parseInt(mockData.goods_value) > 50000 || parseInt(draft.freightAmount || '0') > 50000
          })

          setOcrLoading(false)
          Alert.alert('Invoice Scanned', 'LR details have been auto-filled. Please review them.')
        }, 1500)

      } catch (error: any) {
        setOcrLoading(false)
        Alert.alert('Error', error.message)
      }
    }
  }

  const handleCreateLR = async () => {
    if (!selectedTruck || !selectedDriver) {
      Alert.alert('Error', 'Please assign a truck and driver')
      return
    }
    
    setSubmitting(true)

    // Generate LR Number
    let lrNumber = ''
    const { data: lrData, error: lrError } = await supabase.rpc('generate_lr_number')
    
    if (lrError || !lrData) {
      // Fallback if rpc fails or doesn't exist
      lrNumber = `VE-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
    } else {
      lrNumber = lrData
    }

    // Insert Trip
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .insert({
        tenant_id: tenantId,
        lr_number: lrNumber,
        truck_id: selectedTruck,
        driver_id: selectedDriver,
        status: 'LR_CREATED',
        origin: draft.originCity,
        destination: draft.destinationCity,
        goods: draft.goodsDescription,
        weight_kg: parseInt(draft.weightKg || '0'),
        freight_amount: parseInt(draft.freightAmount || '0'),
        goods_value: parseInt(draft.goodsValue || '0'),
        invoice_number: draft.invoiceNumber,
        invoice_date: draft.invoiceDate,
        ewaybill_required: draft.ewaybillRequired,
        ewaybill_done: false,
        sender_details: draft.senders,
        receiver_name: draft.receiverName,
        receiver_phone: draft.receiverPhone,
      })
      .select()
      .single()

    if (tripError) {
      setSubmitting(false)
      Alert.alert('Error creating trip', tripError.message)
      return
    }

    // Update Truck and Driver status
    await Promise.all([
      supabase.from('trucks').update({ status: 'ON_TRIP' }).eq('id', selectedTruck),
      supabase.from('drivers').update({ status: 'ON_TRIP' }).eq('id', selectedDriver)
    ])

    setSubmitting(false)
    router.push({
      pathname: '/(trip)/preview',
      params: { tripId: tripData.id }
    })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <TouchableOpacity style={styles.ocrButton} onPress={handleScanInvoice} disabled={ocrLoading}>
          {ocrLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Camera color={Colors.primary} size={24} style={{ marginRight: 8 }} />
              <Text style={styles.ocrText}>Scan invoice to auto-fill LR details</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assign Resources</Text>
          
          <Text style={styles.label}>Select Truck *</Text>
          <View style={styles.pickerContainer}>
            {trucks.map(truck => (
              <TouchableOpacity 
                key={truck.id} 
                style={[styles.pickerItem, selectedTruck === truck.id && styles.pickerItemSelected]}
                onPress={() => setSelectedTruck(truck.id)}
              >
                <Text style={[styles.pickerItemText, selectedTruck === truck.id && styles.pickerItemTextSelected]}>
                  {truck.registration_number} ({truck.truck_type})
                </Text>
              </TouchableOpacity>
            ))}
            {trucks.length === 0 && <Text style={styles.emptyText}>No available trucks.</Text>}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Select Driver *</Text>
          <View style={styles.pickerContainer}>
            {drivers.map(driver => (
              <TouchableOpacity 
                key={driver.id} 
                style={[styles.pickerItem, selectedDriver === driver.id && styles.pickerItemSelected]}
                onPress={() => setSelectedDriver(driver.id)}
              >
                <Text style={[styles.pickerItemText, selectedDriver === driver.id && styles.pickerItemTextSelected]}>
                  {driver.full_name} ({driver.phone})
                </Text>
              </TouchableOpacity>
            ))}
            {drivers.length === 0 && <Text style={styles.emptyText}>No available drivers.</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Trip Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>From:</Text><Text style={styles.summaryValue}>{draft.originCity}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>To:</Text><Text style={styles.summaryValue}>{draft.destinationCity}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Goods:</Text><Text style={styles.summaryValue}>{draft.goodsDescription} ({draft.weightKg}kg)</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Freight:</Text><Text style={styles.summaryValue}>₹{draft.freightAmount}</Text></View>
          {draft.invoiceNumber ? (
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Invoice:</Text><Text style={styles.summaryValue}>{draft.invoiceNumber}</Text></View>
          ) : null}
        </View>

      </ScrollView>
      <View style={styles.footer}>
        <Button title="Create LR" onPress={handleCreateLR} loading={submitting} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24 },
  ocrButton: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  ocrText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary },
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary, marginBottom: 16 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  pickerContainer: { gap: 8 },
  pickerItem: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 16 },
  pickerItemSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  pickerItemText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  pickerItemTextSelected: { fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  summaryCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  summaryTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  footer: { padding: 24, paddingTop: 16, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
})
