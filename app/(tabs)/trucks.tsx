import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, X, Edit2, Search } from 'lucide-react-native'
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

const TRUCK_TYPES = [
  'Mini Truck (up to 1 tonne)',
  'Light Commercial (1-3 tonne)',
  'Medium Truck (3-7 tonne)',
  'Heavy Truck (7-15 tonne)',
  'Trailer / Multi-axle (15+ tonne)',
]

export default function TrucksScreen() {
  const tenantId = useStore((state) => state.tenantId)
  const [trucks, setTrucks] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingTruck, setEditingTruck] = useState<any>(null)

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

  const handleEdit = (truck: any) => {
    setEditingTruck(truck)
    reset({
      registrationNumber: truck.registration_number,
      truckType: truck.truck_type,
      capacityKg: truck.capacity_kg ? truck.capacity_kg.toString() : '',
    })
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingTruck(null)
    reset({ registrationNumber: '', truckType: '', capacityKg: '' })
  }

  const onSubmit = async (data: TruckFormData) => {
    if (!tenantId) return
    setSubmitting(true)
    
    if (editingTruck) {
      const { error } = await supabase
        .from('trucks')
        .update({
          registration_number: data.registrationNumber.toUpperCase(),
          truck_type: data.truckType,
          capacity_kg: data.capacityKg ? parseInt(data.capacityKg, 10) : null,
        })
        .eq('id', editingTruck.id)

      setSubmitting(false)
      if (error) {
        Alert.alert('Error', error.message)
      } else {
        handleCloseModal()
        onRefresh()
      }
    } else {
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
        handleCloseModal()
        onRefresh()
      }
    }
  }

  const handleDelete = () => {
    if (!editingTruck) return
    Alert.alert(
      'Delete Truck',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('trucks')
              .delete()
              .eq('id', editingTruck.id)
            if (error) {
              Alert.alert('Error', 'Could not delete. Please try again.')
              return
            }
            handleCloseModal()
            onRefresh()
          }
        }
      ]
    )
  }

  const filteredTrucks = trucks.filter(truck =>
    truck.registration_number.toLowerCase().includes(search.toLowerCase()) ||
    truck.truck_type.toLowerCase().includes(search.toLowerCase()) ||
    truck.status.toLowerCase().includes(search.toLowerCase())
  )

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.regNumber}>{item.registration_number}</Text>
          {item.status === 'AVAILABLE' ? (
            <TouchableOpacity onPress={() => handleEdit(item)} style={{ marginLeft: 8 }}>
              <Edit2 color={Colors.primary} size={16} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.cardSubText, { marginLeft: 8, fontSize: 12, color: Colors.textSecondary }]}>On Trip — cannot edit</Text>
          )}
        </View>
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

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color={Colors.textSecondary} size={18} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trucks..."
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearIcon}>
              <X color={Colors.textSecondary} size={16} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredTrucks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search ? `No results for "${search}"` : 'No trucks found.'}
              </Text>
            </View>
          )}
        />
      )}

      {/* Add Truck Bottom Sheet (Simulated with Modal) */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTruck ? 'Edit Truck' : 'Add Truck'}</Text>
              <TouchableOpacity onPress={handleCloseModal}>
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
                render={({ field: { onChange, value } }) => {
                  const options = value && !TRUCK_TYPES.includes(value) ? [...TRUCK_TYPES, value] : TRUCK_TYPES;
                  return (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Truck type *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                      {options.map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => onChange(type)}
                          style={[styles.typePill, value === type && styles.typePillActive]}
                        >
                          <Text style={[styles.typePillText, value === type && styles.typePillTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {errors.truckType && <Text style={{ color: Colors.danger, fontSize: 12, marginTop: 4 }}>{errors.truckType.message}</Text>}
                  </View>
                )}}
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
              <Button title={editingTruck ? "Update Truck" : "Save Truck"} onPress={handleSubmit(onSubmit)} loading={submitting} />
              {editingTruck && (
                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    editingTruck.status === 'ON_TRIP' && styles.deleteButtonDisabled
                  ]}
                  disabled={editingTruck.status === 'ON_TRIP'}
                  onPress={handleDelete}
                >
                  <Text style={[
                    styles.deleteButtonText,
                    editingTruck.status === 'ON_TRIP' && styles.deleteButtonTextDisabled
                  ]}>
                    {editingTruck.status === 'ON_TRIP' ? 'On Trip — cannot delete' : 'Delete Truck'}
                  </Text>
                </TouchableOpacity>
              )}
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
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  typePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: Colors.border },
  typePillActive: { backgroundColor: '#EFF6FF', borderColor: Colors.primary },
  typePillText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  typePillTextActive: { fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  searchContainer: { paddingHorizontal: 24, paddingBottom: 16 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E4E0', borderRadius: 12, height: 44, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  clearIcon: { marginLeft: 8, padding: 4 },
  deleteButton: { marginTop: 16, backgroundColor: '#FFFFFF', borderColor: Colors.danger, borderWidth: 1, borderRadius: 8, height: 52, justifyContent: 'center', alignItems: 'center' },
  deleteButtonDisabled: { borderColor: Colors.border, backgroundColor: '#F5F5F4' },
  deleteButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.danger },
  deleteButtonTextDisabled: { color: Colors.textSecondary },
})
