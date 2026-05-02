import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, X, CheckCircle2 } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { useTripStore, Sender, Receiver } from '../../store/useTripStore'

interface ValidationErrors {
  senders: { name?: string; phone?: string; gst?: string }[]
  receivers: { name?: string; phone?: string; gst?: string }[]
}

export default function Step1PartiesScreen() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const isOcr = source === 'ocr'
  const [showOcrBanner, setShowOcrBanner] = useState(isOcr)
  
  const { draft, setDraft } = useTripStore()

  const [senders, setSenders] = useState<Sender[]>(draft.senders.length > 0 ? draft.senders : [{ name: '', phone: '' }])
  const [receivers, setReceivers] = useState<Receiver[]>(draft.receivers.length > 0 ? draft.receivers : [{ name: '', phone: '' }])
  const [errors, setErrors] = useState<ValidationErrors>({ senders: [], receivers: [] })

  const handleAddSender = () => {
    if (senders.length < 3) {
      setSenders([...senders, { name: '', phone: '' }])
    }
  }

  const handleRemoveSender = (index: number) => {
    setSenders(senders.filter((_, i) => i !== index))
  }

  const handleAddReceiver = () => {
    if (receivers.length < 3) {
      setReceivers([...receivers, { name: '', phone: '' }])
    }
  }

  const handleRemoveReceiver = (index: number) => {
    setReceivers(receivers.filter((_, i) => i !== index))
  }

  const updateSender = (index: number, field: keyof Sender, value: string) => {
    const newSenders = [...senders]
    newSenders[index][field] = value
    setSenders(newSenders)
    // Clear specific error
    const newErrors = { ...errors }
    if (newErrors.senders[index]) {
      newErrors.senders[index][field] = undefined
    }
    setErrors(newErrors)
  }

  const updateReceiver = (index: number, field: keyof Receiver, value: string) => {
    const newReceivers = [...receivers]
    newReceivers[index][field] = value
    setReceivers(newReceivers)
    // Clear specific error
    const newErrors = { ...errors }
    if (newErrors.receivers[index]) {
      newErrors.receivers[index][field] = undefined
    }
    setErrors(newErrors)
  }

  const validatePhone = (phone: string) => {
    return /^\d{10}$/.test(phone)
  }

  const validateGST = (gst?: string) => {
    if (!gst) return true
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)
  }

  const handleContinue = () => {
    let isValid = true
    const newErrors: ValidationErrors = { senders: [], receivers: [] }

    senders.forEach((sender, i) => {
      newErrors.senders[i] = {}
      if (!sender.name.trim()) {
        newErrors.senders[i].name = 'Name is required'
        isValid = false
      }
      if (!validatePhone(sender.phone)) {
        newErrors.senders[i].phone = 'Valid 10-digit number required'
        isValid = false
      }
      if (sender.gst && !validateGST(sender.gst)) {
        newErrors.senders[i].gst = 'Invalid GST format'
        isValid = false
      }
    })

    receivers.forEach((receiver, i) => {
      newErrors.receivers[i] = {}
      if (!receiver.name.trim()) {
        newErrors.receivers[i].name = 'Name is required'
        isValid = false
      }
      if (!validatePhone(receiver.phone)) {
        newErrors.receivers[i].phone = 'Valid 10-digit number required'
        isValid = false
      }
      if (receiver.gst && !validateGST(receiver.gst)) {
        newErrors.receivers[i].gst = 'Invalid GST format'
        isValid = false
      }
    })

    setErrors(newErrors)

    if (isValid) {
      setDraft({ senders, receivers })
      router.push({
        pathname: '/(trip)/step2-load',
        params: isOcr ? { source: 'ocr' } : undefined
      })
    }
  }

  const renderPhoneInput = (value: string, onChangeText: (text: string) => void, error?: string, isOcrFilled?: boolean) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>Mobile Number</Text>
      <View style={[styles.phoneInputWrapper, error ? styles.inputError : null, isOcrFilled ? styles.ocrInput : null]}>
        <View style={styles.phonePrefix}>
          <Text style={styles.phonePrefixText}>+91</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, 10))}
          keyboardType="numeric"
          placeholder="9999999999"
          placeholderTextColor={Colors.greyPlaceholder}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )

  const renderTextInput = (label: string, value: string, onChangeText: (text: string) => void, error?: string, isOcrFilled?: boolean, autoCapitalize?: "none" | "sentences" | "words" | "characters") => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, isOcrFilled ? styles.ocrInput : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={Colors.greyPlaceholder}
        autoCapitalize={autoCapitalize || "sentences"}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={Colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Trip</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>Step 1 of 3</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '33%' }]} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {showOcrBanner && (
            <View style={styles.ocrBanner}>
              <CheckCircle2 color="#16A34A" size={20} style={styles.ocrBannerIcon} />
              <Text style={styles.ocrBannerText}>Invoice scanned — review and edit the details below</Text>
              <TouchableOpacity onPress={() => setShowOcrBanner(false)} style={styles.ocrBannerClose}>
                <X color="#15803D" size={16} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionTitle}>SENDER DETAILS</Text>
          {senders.map((sender, index) => (
            <View key={`sender-${index}`} style={styles.partyBlock}>
              {index > 0 && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveSender(index)}>
                  <X color={Colors.danger} size={16} />
                </TouchableOpacity>
              )}
              {renderTextInput('Sender Name', sender.name, (text) => updateSender(index, 'name', text), errors.senders[index]?.name, isOcr && !!sender.name)}
              {renderPhoneInput(sender.phone, (text) => updateSender(index, 'phone', text), errors.senders[index]?.phone, isOcr && !!sender.phone)}
              {renderTextInput('GST Number (optional)', sender.gst || '', (text) => updateSender(index, 'gst', text.toUpperCase()), errors.senders[index]?.gst, isOcr && !!sender.gst, "characters")}
            </View>
          ))}
          {senders.length < 3 && (
            <TouchableOpacity onPress={handleAddSender} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add Sender</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>RECEIVER DETAILS</Text>
          {receivers.map((receiver, index) => (
            <View key={`receiver-${index}`} style={styles.partyBlock}>
              {index > 0 && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveReceiver(index)}>
                  <X color={Colors.danger} size={16} />
                </TouchableOpacity>
              )}
              {renderTextInput('Receiver Name', receiver.name, (text) => updateReceiver(index, 'name', text), errors.receivers[index]?.name, isOcr && !!receiver.name)}
              {renderPhoneInput(receiver.phone, (text) => updateReceiver(index, 'phone', text), errors.receivers[index]?.phone, isOcr && !!receiver.phone)}
              {renderTextInput('GST Number (optional)', receiver.gst || '', (text) => updateReceiver(index, 'gst', text.toUpperCase()), errors.receivers[index]?.gst, isOcr && !!receiver.gst, "characters")}
            </View>
          ))}
          {receivers.length < 3 && (
            <TouchableOpacity onPress={handleAddReceiver} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Add Receiver</Text>
            </TouchableOpacity>
          )}
          
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Continue" onPress={handleContinue} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  progressContainer: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  progressText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  progressBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, marginBottom: 16 },
  partyBlock: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, position: 'relative' },
  removeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
  inputContainer: { marginBottom: 16, width: '100%' },
  label: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  input: { width: '100%', height: 44, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  phoneInputWrapper: { flexDirection: 'row', width: '100%', height: 44, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  phonePrefix: { backgroundColor: Colors.background, paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border },
  phonePrefixText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  phoneInput: { flex: 1, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  inputError: { borderColor: Colors.danger },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, marginTop: 4 },
  addBtn: { marginBottom: 24 },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 24 },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 0 : 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Colors.border },
  ocrBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', padding: 12, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#BBF7D0' },
  ocrBannerIcon: { marginRight: 8 },
  ocrBannerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#166534' },
  ocrBannerClose: { padding: 4 },
  ocrInput: { borderLeftWidth: 4, borderLeftColor: '#16A34A' },
})
