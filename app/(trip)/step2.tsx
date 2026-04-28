import React, { useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useTripStore } from '../../store/useTripStore'

const step2Schema = z.object({
  originCity: z.string().min(1, 'Required'),
  destinationCity: z.string().min(1, 'Required'),
  goodsDescription: z.string().min(1, 'Required'),
  weightKg: z.string().min(1, 'Required'),
  freightAmount: z.string().min(1, 'Required'),
  goodsValue: z.string().min(1, 'Required'),
})

type Step2FormData = z.infer<typeof step2Schema>

export default function TripStep2Screen() {
  const router = useRouter()
  const { draft, setDraft } = useTripStore()

  const { control, handleSubmit, watch, formState: { errors } } = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      originCity: draft.originCity,
      destinationCity: draft.destinationCity,
      goodsDescription: draft.goodsDescription,
      weightKg: draft.weightKg,
      freightAmount: draft.freightAmount,
      goodsValue: draft.goodsValue,
    }
  })

  const freightAmount = watch('freightAmount')
  const goodsValue = watch('goodsValue')

  const freightNum = parseInt(freightAmount || '0', 10)
  const goodsNum = parseInt(goodsValue || '0', 10)
  const requiresEwaybill = freightNum > 50000 || goodsNum > 50000

  const onSubmit = (data: Step2FormData) => {
    setDraft({
      ...data,
      ewaybillRequired: requiresEwaybill,
    })
    router.push('/(trip)/step3')
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <Controller
            control={control}
            name="originCity"
            render={({ field: { onChange, value } }) => (
              <Input label="Origin City *" placeholder="e.g. Mumbai" value={value} onChangeText={onChange} error={errors.originCity?.message} />
            )}
          />
          <Controller
            control={control}
            name="destinationCity"
            render={({ field: { onChange, value } }) => (
              <Input label="Destination City *" placeholder="e.g. Pune" value={value} onChangeText={onChange} error={errors.destinationCity?.message} />
            )}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goods</Text>
          <Controller
            control={control}
            name="goodsDescription"
            render={({ field: { onChange, value } }) => (
              <Input label="Description *" placeholder="e.g. Steel pipes" value={value} onChangeText={onChange} error={errors.goodsDescription?.message} />
            )}
          />
          <Controller
            control={control}
            name="weightKg"
            render={({ field: { onChange, value } }) => (
              <Input label="Weight (kg) *" placeholder="e.g. 2400" value={value} onChangeText={onChange} error={errors.weightKg?.message} keyboardType="numeric" />
            )}
          />
          <Controller
            control={control}
            name="freightAmount"
            render={({ field: { onChange, value } }) => (
              <Input label="Freight Amount (₹) *" placeholder="e.g. 15000" value={value} onChangeText={onChange} error={errors.freightAmount?.message} keyboardType="numeric" />
            )}
          />
          <Controller
            control={control}
            name="goodsValue"
            render={({ field: { onChange, value } }) => (
              <Input label="Goods Value (₹) *" placeholder="e.g. 60000" value={value} onChangeText={onChange} error={errors.goodsValue?.message} keyboardType="numeric" />
            )}
          />
        </View>

        {requiresEwaybill && (
          <View style={styles.banner}>
            <AlertCircle color={Colors.warning} size={20} />
            <Text style={styles.bannerText}>
              E-way bill required for goods/freight above ₹50,000. You can generate it after creating the LR.
            </Text>
          </View>
        )}

      </ScrollView>
      <View style={styles.footer}>
        <Button title="Continue" onPress={handleSubmit(onSubmit)} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24 },
  section: { marginBottom: 8 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary, marginBottom: 16 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  banner: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FEF3C7', marginTop: 8 },
  bannerText: { flex: 1, marginLeft: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.warning },
  footer: { padding: 24, paddingTop: 16, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
})
