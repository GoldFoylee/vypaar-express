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

const driverSchema = z.object({
  fullName: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  licenseNumber: z.string().min(1, 'Required'),
})

type DriverFormData = z.infer<typeof driverSchema>

export default function DriversScreen() {
  const tenantId = useStore((state) => state.tenantId)
  const [drivers, setDrivers] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { control, handleSubmit, reset, formState: { errors } } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: { fullName: '', phone: '', licenseNumber: '' }
  })

  const fetchDrivers = useCallback(async () => {
    if (!tenantId) return
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDrivers(data)
    }
    setLoading(false)
  }, [tenantId])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchDrivers()
    setRefreshing(false)
  }

  useEffect(() => {
    fetchDrivers()
  }, [fetchDrivers])

  const onSubmit = async (data: DriverFormData) => {
    if (!tenantId) return
    setSubmitting(true)
    
    const { error } = await supabase
      .from('drivers')
      .insert({
        tenant_id: tenantId,
        full_name: data.fullName,
        phone: data.phone,
        license_number: data.licenseNumber,
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
        <Text style={styles.subText}>No active truck</Text>
      </View>
      <StatusPill status={item.status} />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Drivers</Text>
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
          data={drivers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No drivers found.</Text>
            </View>
          )}
        />
      )}

      {/* Add Driver Bottom Sheet (Simulated with Modal) */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Driver</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X color={Colors.textPrimary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, value } }) => (
                  <Input label="Full name *" placeholder="e.g. Ramesh Kumar" value={value} onChangeText={onChange} error={errors.fullName?.message} />
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <Input label="Phone number *" placeholder="+91" value={value} onChangeText={onChange} error={errors.phone?.message} keyboardType="phone-pad" />
                )}
              />
              <Controller
                control={control}
                name="licenseNumber"
                render={({ field: { onChange, value } }) => (
                  <Input label="License number *" placeholder="DL-1420110012345" value={value} onChangeText={onChange} error={errors.licenseNumber?.message} autoCapitalize="characters" />
                )}
              />
              {/* Note: Document uploads would go here in Phase 2 or if strictly requested now */}
              <View style={{ height: 24 }} />
              <Button title="Save Driver" onPress={handleSubmit(onSubmit)} loading={submitting} />
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
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textSecondary },
  cardContent: { flex: 1 },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  phone: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginVertical: 2 },
  subText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
})
