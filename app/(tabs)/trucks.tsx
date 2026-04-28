import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, X } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { StatusPill } from '../../components/ui/StatusPill'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const truckSchema = z.object({
  registrationNumber: z.string().min(1, 'Required'),
  truckType: z.string().min(1, 'Required'),
  capacityKg: z.string().optional(),
})

type TruckFormData = z.infer<typeof truckSchema>

export default function TrucksScreen() {
  const tenantId = useStore((state) => state.tenantId)
  const [trucks, setTrucks] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { control, handleSubmit, reset, formState: { errors } } = useForm<TruckFormData>({
    resolver: zodResolver(truckSchema),
    defaultValues: { registrationNumber: '', truckType: '', capacityKg: '' }
  })

  const fetchTrucks = useCallback(async () => {
    if (!tenantId) return
    
    // In a real app we'd join trips for the active driver, 
    // but for now we'll fetch trucks and any active trips separately or just rely on a driver relation.
    // Assuming we fetch trucks first:
    const { data, error } = await supabase
      .from('trucks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTrucks(data)
    }
    setLoading(false)
  }, [tenantId])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchTrucks()
    setRefreshing(false)
  }

  useEffect(() => {
    fetchTrucks()
  }, [fetchTrucks])

  const onSubmit = async (data: TruckFormData) => {
    if (!tenantId) return
    setSubmitting(true)
    
    const { error } = await supabase
      .from('trucks')
      .insert({
        tenant_id: tenantId,
        registration_number: data.registrationNumber.toUpperCase(),
        truck_type: data.truckType,
        capacity_kg: data.capacityKg ? parseInt(data.capacityKg, 10) : null,
        status: 'AVAILABLE'
      })

    setSubmitting(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setShowAddModal(false)
      reset()
      onRefresh()
    }
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.regNumber}>{item.registration_number}</Text>
        <StatusPill status={item.status} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardText}>{item.truck_type} • {item.capacity_kg ? `${item.capacity_kg} kg` : 'Capacity N/A'}</Text>
        <Text style={styles.cardSubText}>No active trip</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Trucks</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={trucks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No trucks found.</Text>
            </View>
          )}
        />
      )}

      {/* Add Truck Bottom Sheet (Simulated with Modal) */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Truck</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X color={Colors.textPrimary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Controller
                control={control}
                name="registrationNumber"
                render={({ field: { onChange, value } }) => (
                  <Input label="Registration number *" placeholder="MH 12 AB 1234" value={value} onChangeText={onChange} error={errors.registrationNumber?.message} autoCapitalize="characters" />
                )}
              />
              <Controller
                control={control}
                name="truckType"
                render={({ field: { onChange, value } }) => (
                  <Input label="Truck type *" placeholder="e.g. 10-wheeler" value={value} onChangeText={onChange} error={errors.truckType?.message} />
                )}
              />
              <Controller
                control={control}
                name="capacityKg"
                render={({ field: { onChange, value } }) => (
                  <Input label="Capacity (kg)" placeholder="e.g. 15000" value={value} onChangeText={onChange} error={errors.capacityKg?.message} keyboardType="numeric" />
                )}
              />
              {/* Note: Document uploads would go here in Phase 2 or if strictly requested now */}
              <View style={{ height: 24 }} />
              <Button title="Save Truck" onPress={handleSubmit(onSubmit)} loading={submitting} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: Colors.textPrimary },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 24, paddingTop: 0 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  regNumber: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  cardBody: { gap: 4 },
  cardText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  cardSubText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
})
