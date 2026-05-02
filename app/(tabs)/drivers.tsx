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

const driverSchema = z.object({
  fullName: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  licenseNumber: z.string().min(1, 'Required'),
  driverTag: z.string().min(1, 'Required'),
  customDriverTag: z.string().optional(),
})

type DriverFormData = z.infer<typeof driverSchema>

const DRIVER_TYPES = ['Company Driver', 'Market Driver', 'Custom']

export default function DriversScreen() {
  const tenantId = useStore((state) => state.tenantId)
  const [drivers, setDrivers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingDriver, setEditingDriver] = useState<any>(null)

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: { fullName: '', phone: '', licenseNumber: '', driverTag: 'Company Driver', customDriverTag: '' }
  })

  const selectedTag = watch('driverTag')

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

  const handleEdit = (driver: any) => {
    setEditingDriver(driver)
    
    let tag = driver.driver_tag || 'Company Driver'
    let customTag = ''
    if (!['Company Driver', 'Market Driver'].includes(tag)) {
      customTag = tag
      tag = 'Custom'
    }

    reset({
      fullName: driver.name,
      phone: driver.phone,
      licenseNumber: driver.license_number,
      driverTag: tag,
      customDriverTag: customTag,
    })
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingDriver(null)
    reset({ fullName: '', phone: '', licenseNumber: '', driverTag: 'Company Driver', customDriverTag: '' })
  }

  const onSubmit = async (data: DriverFormData) => {
    if (!tenantId) return
    setSubmitting(true)
    
    const finalTag = data.driverTag === 'Custom' ? data.customDriverTag : data.driverTag

    if (editingDriver) {
      const { error } = await supabase
        .from('drivers')
        .update({
          name: data.fullName,
          phone: data.phone,
          license_number: data.licenseNumber,
          driver_tag: finalTag,
        })
        .eq('id', editingDriver.id)

      setSubmitting(false)
      if (error) {
        Alert.alert('Error', error.message)
      } else {
        handleCloseModal()
        onRefresh()
      }
    } else {
      const { error } = await supabase
        .from('drivers')
        .insert({
          tenant_id: tenantId,
          name: data.fullName,
          phone: data.phone,
          license_number: data.licenseNumber,
          driver_tag: finalTag,
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
    if (!editingDriver) return
    Alert.alert(
      'Delete Driver',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('drivers')
              .delete()
              .eq('id', editingDriver.id)
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

  const filteredDrivers = drivers.filter(driver =>
    (driver.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (driver.phone || '').includes(search) ||
    (driver.driver_tag || '').toLowerCase().includes(search.toLowerCase())
  )

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  const getTagColor = (tag: string) => {
    if (tag === 'Company Driver') return { bg: '#EFF6FF', text: Colors.primary }
    if (tag === 'Market Driver') return { bg: '#FFFBEB', text: Colors.warning }
    return { bg: '#F5F5F4', text: Colors.textSecondary }
  }

  const renderItem = ({ item }: { item: any }) => {
    const tagStyle = getTagColor(item.driver_tag)
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name || '')}</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.name}>{item.name}</Text>
            {item.status === 'AVAILABLE' ? (
              <TouchableOpacity onPress={() => handleEdit(item)} style={{ marginLeft: 8 }}>
                <Edit2 color={Colors.primary} size={14} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.phone}>{item.phone}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {item.driver_tag && (
              <View style={[styles.tagPill, { backgroundColor: tagStyle.bg }]}>
                <Text style={[styles.tagPillText, { color: tagStyle.text }]}>{item.driver_tag}</Text>
              </View>
            )}
            {item.status === 'ON_TRIP' && <Text style={[styles.subText, { marginLeft: item.driver_tag ? 8 : 0 }]}>On Trip — cannot edit</Text>}
          </View>
        </View>
        <StatusPill status={item.status} />
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Drivers</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color={Colors.textSecondary} size={18} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drivers..."
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
          data={filteredDrivers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search ? `No results for "${search}"` : 'No drivers found.'}
              </Text>
            </View>
          )}
        />
      )}

      {/* Add Driver Bottom Sheet (Simulated with Modal) */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingDriver ? 'Edit Driver' : 'Add Driver'}</Text>
              <TouchableOpacity onPress={handleCloseModal}>
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
              <Controller
                control={control}
                name="driverTag"
                render={({ field: { onChange, value } }) => (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Driver Type *</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {DRIVER_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => onChange(type)}
                          style={[styles.typePill, value === type && styles.typePillActive]}
                        >
                          <Text style={[styles.typePillText, value === type && styles.typePillTextActive]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              />
              {selectedTag === 'Custom' && (
                <Controller
                  control={control}
                  name="customDriverTag"
                  render={({ field: { onChange, value } }) => (
                    <Input label="Custom Tag *" placeholder="e.g. Contract" value={value} onChangeText={onChange} error={errors.customDriverTag?.message} />
                  )}
                />
              )}
              {/* Note: Document uploads would go here in Phase 2 or if strictly requested now */}
              <View style={{ height: 24 }} />
              <Button title={editingDriver ? "Update Driver" : "Save Driver"} onPress={handleSubmit(onSubmit)} loading={submitting} />
              {editingDriver && (
                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    editingDriver.status === 'ON_TRIP' && styles.deleteButtonDisabled
                  ]}
                  disabled={editingDriver.status === 'ON_TRIP'}
                  onPress={handleDelete}
                >
                  <Text style={[
                    styles.deleteButtonText,
                    editingDriver.status === 'ON_TRIP' && styles.deleteButtonTextDisabled
                  ]}>
                    {editingDriver.status === 'ON_TRIP' ? 'On Trip — cannot delete' : 'Delete Driver'}
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
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  typePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: Colors.border },
  typePillActive: { backgroundColor: '#EFF6FF', borderColor: Colors.primary },
  typePillText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  typePillTextActive: { fontFamily: 'Inter_600SemiBold', color: Colors.primary },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  tagPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
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
