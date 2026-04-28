import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useTripStore } from '../../store/useTripStore'

const step1Schema = z.object({
  senders: z.array(z.object({
    name: z.string().min(1, 'Required'),
    phone: z.string().min(1, 'Required'),
  })).min(1),
  receiverName: z.string().min(1, 'Required'),
  receiverPhone: z.string().min(1, 'Required'),
})

type Step1FormData = z.infer<typeof step1Schema>

export default function TripStep1Screen() {
  const router = useRouter()
  const { draft, setDraft } = useTripStore()

  const { control, handleSubmit, formState: { errors } } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      senders: draft.senders.length ? draft.senders : [{ name: '', phone: '' }],
      receiverName: draft.receiverName,
      receiverPhone: draft.receiverPhone,
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "senders",
  })

  const onSubmit = (data: Step1FormData) => {
    setDraft({
      senders: data.senders,
      receiverName: data.receiverName,
      receiverPhone: data.receiverPhone,
    })
    router.push('/(trip)/step2')
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sender Details</Text>
          {fields.map((field, index) => (
            <View key={field.id} style={styles.senderBlock}>
              <View style={styles.senderHeader}>
                <Text style={styles.senderLabel}>Sender {index + 1}</Text>
                {index > 0 && (
                  <TouchableOpacity onPress={() => remove(index)}>
                    <Trash2 color={Colors.danger} size={20} />
                  </TouchableOpacity>
                )}
              </View>
              <Controller
                control={control}
                name={`senders.${index}.name`}
                render={({ field: { onChange, value } }) => (
                  <Input label="Name *" placeholder="Sender Name" value={value} onChangeText={onChange} error={errors.senders?.[index]?.name?.message} />
                )}
              />
              <Controller
                control={control}
                name={`senders.${index}.phone`}
                render={({ field: { onChange, value } }) => (
                  <Input label="Phone *" placeholder="+91" value={value} onChangeText={onChange} error={errors.senders?.[index]?.phone?.message} keyboardType="phone-pad" />
                )}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.addSenderBtn} onPress={() => append({ name: '', phone: '' })}>
            <Plus color={Colors.primary} size={20} />
            <Text style={styles.addSenderText}>Add another sender</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receiver Details</Text>
          <Controller
            control={control}
            name="receiverName"
            render={({ field: { onChange, value } }) => (
              <Input label="Name *" placeholder="Receiver Name" value={value} onChangeText={onChange} error={errors.receiverName?.message} />
            )}
          />
          <Controller
            control={control}
            name="receiverPhone"
            render={({ field: { onChange, value } }) => (
              <Input label="Phone *" placeholder="+91" value={value} onChangeText={onChange} error={errors.receiverPhone?.message} keyboardType="phone-pad" />
            )}
          />
        </View>
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
  section: { marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary, marginBottom: 16 },
  senderBlock: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  senderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  senderLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textSecondary },
  addSenderBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8 },
  addSenderText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary, marginLeft: 8 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  footer: { padding: 24, paddingTop: 16, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
})
