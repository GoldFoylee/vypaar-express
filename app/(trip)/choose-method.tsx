import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { ArrowLeft, Camera, Edit3 } from 'lucide-react-native'
import React, { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/Colors'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { useTripStore } from '../../store/useTripStore'

export default function ChooseMethodScreen() {
  const router = useRouter()
  const tenantId = useStore((state) => state.tenantId)
  const tripStore = useTripStore()
  const [scanning, setScanning] = useState(false)

  const handleScanInvoice = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: false,
        quality: 0.8,
      })

      if (result.canceled) return

      console.log('[OCR] Image selected:', result.assets[0].uri, 'width:', result.assets[0].width, 'height:', result.assets[0].height)

      setScanning(true)

      // Compress image before upload
      const uri = result.assets[0].uri
      const originalWidth = result.assets[0].width
      const originalHeight = result.assets[0].height
      const resizeOptions = originalWidth > originalHeight ? { width: 1600 } : { height: 1600 }

      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: resizeOptions }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )
      console.log('[OCR] Compressed image URI:', manipResult.uri)

      // Upload image to Supabase invoices bucket
      const fileName = `${tenantId}/${Date.now()}.jpg`
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: 'base64',
      })
      console.log('[OCR] Base64 length:', base64.length)
      
      const byteCharacters = atob(base64)
      const byteArray = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i)
      }
      console.log('[OCR] Byte array length:', byteArray.length)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, byteArray, { 
          contentType: 'image/jpeg',
          upsert: false 
        })
      console.log('[OCR] Upload result - data:', JSON.stringify(uploadData), 'error:', JSON.stringify(uploadError))

      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message)

      // Generate signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('invoices')
        .createSignedUrl(fileName, 60)

      console.log('[OCR] Signed URL result - url:', signedData?.signedUrl, 'error:', JSON.stringify(signedError))

      if (signedError || !signedData?.signedUrl) {
        throw new Error('Failed to generate signed URL: ' + signedError?.message)
      }

      let signedUrl = signedData.signedUrl
      if (signedUrl.startsWith('/')) {
        signedUrl = `https://khxsxxseluaggmqcvczx.supabase.co/storage/v1${signedUrl}`
      }

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke('ocr-invoice', {
        body: { invoice_url: signedUrl }
      })
      
      console.log('[OCR] Edge function response - data:', JSON.stringify(data), 'error:', JSON.stringify(error))

      const populateStore = (extracted: any) => {
        const senders = extracted.senders?.filter((s: any) => s.name)
        tripStore.setSenders(senders?.length ? senders : [{ name: '', phone: '', gst: '' }])

        const receivers = extracted.receivers?.filter((r: any) => r.name)
        tripStore.setReceivers(receivers?.length ? receivers : [{ name: '', phone: '', gst: '' }])

        tripStore.setGoodsDescription(extracted.goods_description || '')
        tripStore.setQuantity(extracted.quantity || null)
        tripStore.setWeightKg(extracted.weight_kg || null)
        tripStore.setFreightAmount(extracted.freight_amount || null)
        tripStore.setGoodsValue(extracted.goods_value || null)
        tripStore.setOrigin(extracted.origin || '')
        tripStore.setDestination(extracted.destination || '')
      }

      if (error || !data?.success) {
        const isInvalid = data?.error === 'not_a_valid_invoice' || data?.data?.is_valid_invoice === false

        Alert.alert(
          isInvalid ? 'Scan Failed' : "Couldn't read invoice",
          isInvalid
            ? "This doesn't look like a freight invoice. Please scan a consignment note or challan."
            : "The scan didn't work this time. You can fill in the details manually.",
          [
            { text: 'Try Again', onPress: handleScanInvoice },
            {
              text: 'Enter Manually',
              onPress: () => {
                if (data?.data) populateStore(data.data)
                router.push('/(trip)/step1-parties')
              }
            }
          ]
        )
        return
      }

      // Pre-fill store with OCR results
      populateStore(data.data)

      // Navigate to step1 with ocr flag so it shows pre-filled state
      router.push('/(trip)/step1-parties?source=ocr')

    } catch (error: any) {
      console.error('[OCR] Full error object:', JSON.stringify(error), 'message:', error?.message, 'stack:', error?.stack)
      Alert.alert(
        "Couldn't read invoice",
        "The scan didn't work this time. You can fill in the details manually.",
        [
          { text: 'Try Again', onPress: handleScanInvoice },
          { text: 'Enter Manually', onPress: () => router.push('/(trip)/step1-parties') }
        ]
      )
    } finally {
      setScanning(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={Colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Trip</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <TouchableOpacity style={styles.card} onPress={handleScanInvoice} activeOpacity={0.7}>
          <View style={styles.iconContainer}>
            <Camera color={Colors.primary} size={32} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Scan Invoice</Text>
            <Text style={styles.cardSubtitle}>Take a photo of the invoice and we'll fill the details</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/(trip)/step1-parties')} activeOpacity={0.7}>
          <View style={styles.iconContainer}>
            <Edit3 color={Colors.primary} size={32} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Enter Manually</Text>
            <Text style={styles.cardSubtitle}>Fill in the trip details yourself</Text>
          </View>
        </TouchableOpacity>
      </View>

      {scanning && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Reading invoice...</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3E8FF', // Light primary tint
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A5EB8',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 16,
  },
})
