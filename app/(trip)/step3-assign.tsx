import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { useTripStore } from '../../store/useTripStore'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'

export default function Step3AssignScreen() {
  const router = useRouter()
  const { draft, resetDraft } = useTripStore()
  const tenantId = useStore((state) => state.tenantId)

  const [trucks, setTrucks] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  
  const [fetching, setFetching] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (tenantId) fetchResources()
  }, [tenantId])

  const fetchResources = async () => {
    setFetching(true)
    
    const { data: trucksData } = await supabase
      .from('trucks')
      .select('id, registration_number, truck_type')
      .eq('tenant_id', tenantId)
      .eq('status', 'AVAILABLE')

    const { data: driversData } = await supabase
      .from('drivers')
      .select('id, name, phone')
      .eq('tenant_id', tenantId)
      .eq('status', 'AVAILABLE')

    setTrucks(trucksData || [])
    setDrivers(driversData || [])
    setFetching(false)
  }

  const handleGenerateLR = async () => {
    if (!selectedTruck) {
      Alert.alert('Select a truck', 'Please select a truck before generating the LR.')
      return
    }
    if (!selectedDriver) {
      Alert.alert('Select a driver', 'Please select a driver before generating the LR.')
      return
    }
    try {
      setSubmitting(true)

      const { data: lrNumber, error: lrError } = await supabase
        .rpc('generate_lr_number', { p_tenant_id: tenantId })
      if (lrError) throw new Error('LR number generation failed: ' + lrError.message)
      console.log('LR Number:', lrNumber)

      const insertTrip = async (lrToUse: string) => {
        return await supabase
          .from('trips')
          .insert({
            tenant_id: tenantId,
            lr_number: lrToUse,
            truck_id: selectedTruck,
            driver_id: selectedDriver,
            status: 'LR_CREATED',
            origin: draft.origin,
            destination: draft.destination,
            senders: draft.senders || [],
            receivers: draft.receivers || [],
            receiver_name: draft.receivers?.[0]?.name || '',
            receiver_phone: draft.receivers?.[0]?.phone || '',
            goods_description: draft.goods_description || '',
            weight_kg: parseFloat(draft.weight_kg) || 0,
            quantity: draft.quantity,
            quantity_unit: draft.quantity_unit || 'Pieces',
            freight_amount: parseFloat(draft.freight_amount) || 0,
            goods_value: draft.goods_value ? parseFloat(draft.goods_value) : null,
            ewaybill_required: draft.ewaybill_required || false,
          })
          .select()
          .single()
      }

      let finalLrNumber = lrNumber
      let { data: trip, error: tripError } = await insertTrip(finalLrNumber)

      if (tripError && tripError.message.includes('duplicate key')) {
        finalLrNumber = `${lrNumber}-${Math.floor(1000 + Math.random() * 9000)}`
        const retryRes = await insertTrip(finalLrNumber)
        trip = retryRes.data
        tripError = retryRes.error
      }

      if (tripError) throw new Error('Trip insert failed: ' + tripError.message)
      console.log('Trip created:', trip.id)

      await supabase.from('trucks').update({ status: 'ON_TRIP' }).eq('id', selectedTruck)
      await supabase.from('drivers').update({ status: 'ON_TRIP' }).eq('id', selectedDriver)

      resetDraft()
      router.replace(`/(trip)/lr-preview?tripId=${trip.id}`)

    } catch (error: any) {
      console.error('Generate LR error:', error.message)
      Alert.alert('Error', error.message || 'Could not create trip. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (fetching) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const senderNames = draft.senders.map(s => s.name).join(', ')
  const receiverNames = draft.receivers.map(r => r.name).join(', ')

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Trip</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Step 3 of 3</Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: '100%' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT TRUCK</Text>
          {trucks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No trucks available. Add a truck first.</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/trucks')}>
                <Text style={styles.emptyLink}>Go to Trucks</Text>
              </TouchableOpacity>
            </View>
          ) : (
            trucks.map(truck => (
              <TouchableOpacity 
                key={truck.id} 
                style={[styles.selectCard, selectedTruck === truck.id && styles.selectCardActive]}
                onPress={() => setSelectedTruck(truck.id)}
                activeOpacity={0.7}
              >
                <View style={styles.selectCardContent}>
                  <Text style={styles.itemTitle}>{truck.registration_number}</Text>
                  <Text style={styles.itemSub}>{truck.truck_type}</Text>
                </View>
                {selectedTruck === truck.id ? (
                  <CheckCircle2 color={Colors.primary} size={24} />
                ) : (
                  <Circle color={Colors.border} size={24} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT DRIVER</Text>
          {drivers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No drivers available. Add a driver first.</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/drivers')}>
                <Text style={styles.emptyLink}>Go to Drivers</Text>
              </TouchableOpacity>
            </View>
          ) : (
            drivers.map(driver => (
              <TouchableOpacity 
                key={driver.id} 
                style={[styles.selectCard, selectedDriver === driver.id && styles.selectCardActive]}
                onPress={() => setSelectedDriver(driver.id)}
                activeOpacity={0.7}
              >
                <View style={styles.selectCardContent}>
                  <Text style={styles.itemTitle}>{driver.name}</Text>
                  <Text style={styles.itemSub}>{driver.phone}</Text>
                </View>
                {selectedDriver === driver.id ? (
                  <CheckCircle2 color={Colors.primary} size={24} />
                ) : (
                  <Circle color={Colors.border} size={24} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TRIP SUMMARY</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryRoute}>{draft.origin} → {draft.destination}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryDetailRow}>
              <Text style={styles.summaryLabel}>Goods</Text>
              <Text style={styles.summaryValue}>{draft.goods_description}</Text>
            </View>
            <View style={styles.summaryDetailRow}>
              <Text style={styles.summaryLabel}>Weight</Text>
              <Text style={styles.summaryValue}>{Number(draft.weight_kg).toLocaleString('en-IN')} kg</Text>
            </View>
            <View style={styles.summaryDetailRow}>
              <Text style={styles.summaryLabel}>Freight</Text>
              <Text style={styles.summaryValue}>₹{Number(draft.freight_amount).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryDetailRow}>
              <Text style={styles.summaryLabel}>Sender(s)</Text>
              <Text style={styles.summaryValue}>{senderNames}</Text>
            </View>
            <View style={styles.summaryDetailRow}>
              <Text style={styles.summaryLabel}>Receiver(s)</Text>
              <Text style={styles.summaryValue}>{receiverNames}</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Generate LR" 
          onPress={handleGenerateLR} 
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  progressContainer: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  progressText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  progressBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, marginBottom: 12, uppercase: true },
  selectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  selectCardActive: { borderColor: Colors.primary, backgroundColor: '#F0F9FF' },
  selectCardContent: { flex: 1 },
  itemTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  itemSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  emptyBox: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  emptyLink: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary },
  summaryCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { marginBottom: 12 },
  summaryRoute: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  summaryDetailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, flex: 1 },
  summaryValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, flex: 2, textAlign: 'right' },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 0 : 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Colors.border },
})
