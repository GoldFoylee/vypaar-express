import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, MapPin, X, CheckCircle2, ChevronDown } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { useTripStore } from '../../store/useTripStore'

interface ValidationErrors {
  origin?: string
  destination?: string
  goods_description?: string
  quantity?: string
  weight_kg?: string
  freight_amount?: string
}

export default function Step2LoadScreen() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const isOcr = source === 'ocr'
  const [showOcrBanner, setShowOcrBanner] = useState(isOcr)
  
  const { draft, setDraft } = useTripStore()

  const [origin, setOrigin] = useState(draft.origin || '')
  const [destination, setDestination] = useState(draft.destination || '')
  const [goodsDescription, setGoodsDescription] = useState(draft.goods_description || '')
  const [quantity, setQuantity] = useState(draft.quantity ? draft.quantity.toString() : '')
  const [quantityUnit, setQuantityUnit] = useState(draft.quantity_unit || 'Pieces')
  const [weightKg, setWeightKg] = useState(draft.weight_kg || '')
  const [freightAmount, setFreightAmount] = useState(draft.freight_amount || '')
  const [goodsValue, setGoodsValue] = useState(draft.goods_value || '')
  
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [showEwayBill, setShowEwayBill] = useState(draft.ewaybill_required || false)
  const [showUnitModal, setShowUnitModal] = useState(false)
  
  const UNITS = ['Bags', 'Boxes', 'Bundles', 'Tonnes', 'Pieces', 'Other']

  useEffect(() => {
    checkEwayBill()
  }, [freightAmount, goodsValue])

  const checkEwayBill = () => {
    const goods = parseFloat(goodsValue) || 0
    setShowEwayBill(goods > 50000)
  }

  const handleContinue = () => {
    let isValid = true
    const newErrors: ValidationErrors = {}

    if (!origin.trim()) { newErrors.origin = 'Required'; isValid = false }
    if (!destination.trim()) { newErrors.destination = 'Required'; isValid = false }
    if (!goodsDescription.trim()) { newErrors.goods_description = 'Required'; isValid = false }
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) <= 0) { newErrors.quantity = 'Required'; isValid = false }
    if (!weightKg.trim()) { newErrors.weight_kg = 'Required'; isValid = false }
    if (!freightAmount.trim()) { newErrors.freight_amount = 'Required'; isValid = false }

    setErrors(newErrors)

    if (isValid) {
      setDraft({
        origin,
        destination,
        goods_description: goodsDescription,
        quantity: parseInt(quantity, 10),
        quantity_unit: quantityUnit,
        weight_kg: weightKg,
        freight_amount: freightAmount,
        goods_value: goodsValue,
        ewaybill_required: showEwayBill
      })
      router.push('/(trip)/step3-assign')
    }
  }

  const renderIconInput = (label: string, icon: React.ReactNode, value: string, onChangeText: (text: string) => void, error?: string, placeholder?: string, isOcrFilled?: boolean) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : null, isOcrFilled ? styles.ocrInput : null]}>
        <View style={styles.inputIcon}>{icon}</View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => { onChangeText(text); setErrors({ ...errors, [label.toLowerCase()]: undefined }) }}
          placeholder={placeholder}
          placeholderTextColor={Colors.greyPlaceholder}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )

  const renderNumberInput = (label: string, value: string, onChangeText: (text: string) => void, error?: string, prefix?: string, suffix?: string, onBlur?: () => void, isOcrFilled?: boolean) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : null, isOcrFilled ? styles.ocrInput : null]}>
        {prefix && (
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        )}
        <TextInput
          style={[styles.input, { paddingHorizontal: prefix ? 12 : 12 }]}
          value={value}
          onChangeText={(text) => { onChangeText(text.replace(/[^0-9]/g, '')); setErrors({ ...errors, [label.toLowerCase()]: undefined }) }}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={Colors.greyPlaceholder}
          onBlur={onBlur}
        />
        {suffix && (
          <View style={styles.suffixBox}>
            <Text style={styles.suffixText}>{suffix}</Text>
          </View>
        )}
      </View>
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
          <Text style={styles.progressText}>Step 2 of 3</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '66%' }]} />
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

          <View style={styles.card}>
            {renderIconInput('From City', <MapPin color={Colors.textSecondary} size={20} />, origin, setOrigin, errors.origin, 'Origin', isOcr && !!origin)}
            {renderIconInput('To City', <MapPin color={Colors.textSecondary} size={20} />, destination, setDestination, errors.destination, 'Destination', isOcr && !!destination)}
          </View>

          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Goods Description</Text>
              <TextInput
                style={[styles.simpleInput, errors.goods_description ? styles.inputError : null, (isOcr && !!goodsDescription) ? styles.ocrInput : null]}
                value={goodsDescription}
                onChangeText={(text) => { setGoodsDescription(text); setErrors({ ...errors, goods_description: undefined }) }}
                placeholder="e.g. Steel pipes"
                placeholderTextColor={Colors.greyPlaceholder}
              />
              {errors.goods_description ? <Text style={styles.errorText}>{errors.goods_description}</Text> : null}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Quantity</Text>
              <View style={[styles.inputWrapper, errors.quantity ? styles.inputError : null, (isOcr && !!quantity) ? styles.ocrInput : null]}>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={(text) => { setQuantity(text); setErrors({ ...errors, quantity: undefined }) }}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.greyPlaceholder}
                />
                <TouchableOpacity style={styles.unitSelector} onPress={() => setShowUnitModal(true)}>
                  <Text style={styles.unitSelectorText}>{quantityUnit}</Text>
                  <ChevronDown color={Colors.textSecondary} size={16} />
                </TouchableOpacity>
              </View>
              {errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                {renderNumberInput('Weight', weightKg, setWeightKg, errors.weight_kg, undefined, 'kg', undefined, isOcr && !!weightKg)}
              </View>
              <View style={styles.halfWidth}>
                {renderNumberInput('Freight Amount', freightAmount, setFreightAmount, errors.freight_amount, '₹', undefined, checkEwayBill, isOcr && !!freightAmount)}
              </View>
            </View>

            {renderNumberInput('Goods Value', goodsValue, setGoodsValue, undefined, '₹', undefined, checkEwayBill, isOcr && !!goodsValue)}
            
            {showEwayBill && (
              <View style={styles.ewayWarning}>
                <Text style={styles.ewayTitle}>⚠️  E-way Bill Required</Text>
                <Text style={styles.ewayText}>Goods above ₹50,000 require an E-way bill before departure. Generate on GST portal after LR.</Text>
              </View>
            )}
          </View>

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
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  inputContainer: { marginBottom: 16, width: '100%' },
  label: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },
  simpleInput: { width: '100%', height: 44, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  inputWrapper: { flexDirection: 'row', width: '100%', height: 44, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, overflow: 'hidden' },
  inputError: { borderColor: Colors.danger },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, marginTop: 4 },
  inputIcon: { width: 44, height: '100%', justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: Colors.background },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  prefixBox: { backgroundColor: Colors.background, paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border },
  prefixText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  suffixBox: { backgroundColor: Colors.background, paddingHorizontal: 12, justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: Colors.border },
  suffixText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  halfWidth: { flex: 1 },
  ewayWarning: { marginTop: 8, backgroundColor: 'rgba(217, 119, 6, 0.1)', borderLeftWidth: 4, borderLeftColor: Colors.warning, padding: 12, borderRadius: 4 },
  ewayTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.warning, marginBottom: 4 },
  ewayText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.warning, lineHeight: 18 },
  footer: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 0 : 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Colors.border },
  ocrBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', padding: 12, borderRadius: 8, marginBottom: 24, borderWidth: 1, borderColor: '#BBF7D0' },
  ocrBannerIcon: { marginRight: 8 },
  ocrBannerText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#166534' },
  ocrBannerClose: { padding: 4 },
  ocrInput: { borderLeftWidth: 4, borderLeftColor: '#16A34A' },
  unitSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  unitSelectorText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textPrimary, marginRight: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, width: '100%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  modalList: { padding: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8 },
  modalItemSelected: { backgroundColor: 'rgba(26, 94, 184, 0.1)' },
  modalItemText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.textPrimary },
  modalItemTextSelected: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
})
