import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
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

const companySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  city: z.string().min(1, 'City is required'),
  phone: z.string()
    .min(10, 'Phone number must be 10 digits')
    .max(10, 'Phone number must be 10 digits')
    .regex(/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
  gstNumber: z.string()
    .min(15, 'GST number must be 15 characters')
    .max(15, 'GST number must be 15 characters')
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Enter a valid GST number')
    .transform(val => val.toUpperCase()),
})

type CompanyFormData = z.infer<typeof companySchema>

export default function SetupCompanyScreen() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setTenantId = useStore((state) => state.setTenantId)
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: '',
      ownerName: '',
      city: '',
      phone: '',
      gstNumber: '',
    }
  })

  const onSubmit = async (data: CompanyFormData) => {
    if (!user) {
      Alert.alert('Error', 'No authenticated user found. Please log in again.')
      return
    }

    setLoading(true)

    try {
      const tenantPayload = {
        company_name: data.companyName,
        owner_name: data.ownerName,
        city: data.city,
        phone: data.phone,
        gst_number: data.gstNumber,
      }
      console.log("Submitting tenant insert payload:", tenantPayload)

      // 1. Insert into tenants
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert(tenantPayload)
        .select('id')
        .single()

      if (tenantError) throw tenantError

      const newTenantId = tenantData.id

      const userPayload = {
        id: user.id,
        tenant_id: newTenantId,
        email: user.email,
        full_name: data.ownerName,
        role: 'OWNER',
        phone: null,
      }
      console.log("Submitting users insert payload:", userPayload)

      // 2. Insert into users
      const { error: userError } = await supabase
        .from('users')
        .insert(userPayload)

      if (userError) throw userError

      // Success
      setTenantId(newTenantId)
      router.push('/(tabs)')
    } catch (error: any) {
      Alert.alert('Error during setup', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Company setup</Text>
            <Text style={styles.subtext}>Let's get your fleet on board.</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="companyName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Company name *"
                  placeholder="e.g. Rajan Transport"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.companyName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="ownerName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Owner name *"
                  placeholder="e.g. Rajan Mehta"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.ownerName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="city"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="City *"
                  placeholder="e.g. Mumbai"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.city?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ marginBottom: 16 }}>
                  <Input
                    label="Phone number *"
                    placeholder="9999999999"
                    keyboardType="phone-pad"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.phone?.message}
                    containerStyle={{ marginBottom: 4 }}
                  />
                  <Text style={styles.helperText}>Used for trip notifications and support</Text>
                </View>
              )}
            />

            <Controller
              control={control}
              name="gstNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ marginBottom: 16 }}>
                  <Input
                    label="GST number *"
                    placeholder="22AAAAA0000A1Z5"
                    autoCapitalize="characters"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.gstNumber?.message}
                    containerStyle={{ marginBottom: 4 }}
                  />
                  <Text style={styles.helperText}>Your GST number will appear on all generated Lorry Receipts</Text>
                </View>
              )}
            />
          </View>

          <View style={styles.footer}>
            <Button 
              title="Continue" 
              onPress={handleSubmit(onSubmit)} 
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 0 : 24,
    paddingTop: 16,
  },
  helperText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
})
