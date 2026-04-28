import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Colors } from '../../constants/Colors'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const TRUCK_TYPES = [
  '6-wheeler',
  '10-wheeler',
  '12-wheeler',
  '14-wheeler',
  '18-wheeler trailer'
]

const truckSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  truckType: z.string().min(1, 'Truck type is required'),
})

type TruckFormData = z.infer<typeof truckSchema>

export default function AddFirstTruckScreen() {
  const router = useRouter()
  const tenantId = useStore((state) => state.tenantId)
  const [loading, setLoading] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<TruckFormData>({
    resolver: zodResolver(truckSchema),
    defaultValues: {
      registrationNumber: '',
      truckType: '',
    }
  })

  const selectedType = watch('truckType')

  const onSubmit = async (data: TruckFormData) => {
    if (!tenantId) {
      Alert.alert('Error', 'Company setup incomplete.')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('trucks')
      .insert({
        tenant_id: tenantId,
        registration_number: data.registrationNumber.toUpperCase(),
        truck_type: data.truckType,
        status: 'AVAILABLE',
      })

    setLoading(false)

    if (error) {
      Alert.alert('Error adding truck', error.message)
      return
    }

    router.replace('/(tabs)')
  }

  const handleSkip = () => {
    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Add your first truck</Text>
            <Text style={styles.subtext}>You can add more later.</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="registrationNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Registration number *"
                  placeholder="MH 12 AB 1234"
                  autoCapitalize="characters"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.registrationNumber?.message}
                />
              )}
            />

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Truck type *</Text>
              <TouchableOpacity 
                style={[styles.pickerButton, errors.truckType && styles.inputError]} 
                onPress={() => setShowTypePicker(true)}
              >
                <Text style={[styles.pickerText, !selectedType && styles.pickerPlaceholder]}>
                  {selectedType || 'Select truck type'}
                </Text>
              </TouchableOpacity>
              {errors.truckType && <Text style={styles.errorText}>{errors.truckType.message}</Text>}
            </View>
          </View>

          <View style={styles.footer}>
            <Button 
              title="Add Truck" 
              onPress={handleSubmit(onSubmit)} 
              loading={loading}
              style={{ marginBottom: 12 }}
            />
            <Button 
              title="Skip for now" 
              onPress={handleSkip} 
              variant="secondary"
              disabled={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Picker Modal */}
      <Modal visible={showTypePicker} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowTypePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Truck Type</Text>
              {TRUCK_TYPES.map((type) => (
                <TouchableOpacity 
                  key={type} 
                  style={styles.modalOption}
                  onPress={() => {
                    setValue('truckType', type, { shouldValidate: true })
                    setShowTypePicker(false)
                  }}
                >
                  <Text style={styles.modalOptionText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginTop: 16,
    marginBottom: 32,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  pickerButton: {
    width: '100%',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: Colors.danger,
  },
  pickerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  pickerPlaceholder: {
    color: Colors.greyPlaceholder,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 0 : 24,
    paddingTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOptionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
  },
})
