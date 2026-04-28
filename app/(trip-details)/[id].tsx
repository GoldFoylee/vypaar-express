import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Modal, Image, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Camera, FileText, X } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { StatusPill } from '../../components/ui/StatusPill'
import { supabase } from '../../lib/supabase'

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  
  const [trip, setTrip] = useState<any>(null)
  const [photos, setPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'INFO' | 'UPDATES' | 'DOCS'>('INFO')
  const [showPODModal, setShowPODModal] = useState(false)
  const [uploadingPOD, setUploadingPOD] = useState(false)
  const [podPhotoUrl, setPodPhotoUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchTrip = async () => {
    const { data: tripData } = await supabase
      .from('trips')
      .select(`*, trucks (id, registration_number), drivers (id, full_name)`)
      .eq('id', id)
      .single()

    const { data: photoData } = await supabase
      .from('trip_photos')
      .select('*')
      .eq('trip_id', id)

    setTrip(tripData)
    setPhotos(photoData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTrip()
  }, [id])

  const handleUpdateStatus = async (newStatus: string) => {
    if (!trip) return
    setSubmitting(true)
    
    await supabase.from('trips').update({ status: newStatus }).eq('id', trip.id)
    
    if (newStatus === 'DELIVERED') {
      // Free up truck and driver
      await Promise.all([
        supabase.from('trucks').update({ status: 'AVAILABLE' }).eq('id', trip.truck_id),
        supabase.from('drivers').update({ status: 'AVAILABLE' }).eq('id', trip.driver_id),
      ])
      setShowPODModal(false)
    }
    
    await fetchTrip()
    setSubmitting(false)
  }

  const handleUploadPOD = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    })

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setUploadingPOD(true)
      try {
        const filePath = `${trip.tenant_id}/${trip.id}-pod-${Date.now()}.jpg`
        const { error } = await supabase.storage.from('trip-photos').upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg'
        })

        if (error) throw error

        const { data } = supabase.storage.from('trip-photos').getPublicUrl(filePath)
        
        await supabase.from('trip_photos').insert({
          trip_id: trip.id,
          photo_type: 'POD',
          photo_url: data.publicUrl
        })

        setPodPhotoUrl(data.publicUrl)
      } catch (e: any) {
        Alert.alert('Error', e.message)
      }
      setUploadingPOD(false)
    }
  }

  const renderInfoTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Sender</Text><Text style={styles.summaryValue}>{trip?.sender_details?.[0]?.name}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Receiver</Text><Text style={styles.summaryValue}>{trip?.receiver_name}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Goods</Text><Text style={styles.summaryValue}>{trip?.goods} ({trip?.weight_kg}kg)</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Freight</Text><Text style={styles.summaryValue}>₹{trip?.freight_amount}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Truck</Text><Text style={styles.summaryValue}>{trip?.trucks?.registration_number}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Driver</Text><Text style={styles.summaryValue}>{trip?.drivers?.full_name}</Text></View>
      </View>
      
      {trip?.lr_pdf_url && (
        <TouchableOpacity style={styles.viewPdfBtn} onPress={() => {
          const { data } = supabase.storage.from('lr-pdfs').getPublicUrl(trip.lr_pdf_url)
          Linking.openURL(data.publicUrl)
        }}>
          <FileText color={Colors.primary} size={20} />
          <Text style={styles.viewPdfText}>View LR Document</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  const renderUpdatesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.timelineItem}>
        <View style={styles.timelineDot} />
        <View style={styles.timelineContent}>
          <Text style={styles.timelineTitle}>LR Created</Text>
          <Text style={styles.timelineDate}>{new Date(trip?.created_at).toLocaleString()}</Text>
        </View>
      </View>
      {['IN_TRANSIT', 'DELIVERED', 'SETTLED'].includes(trip?.status) && (
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineTitle}>In Transit</Text>
          </View>
        </View>
      )}
      {['DELIVERED', 'SETTLED'].includes(trip?.status) && (
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineTitle}>Delivered</Text>
          </View>
        </View>
      )}
    </View>
  )

  const renderDocsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.photoGrid}>
        {photos.map(p => (
          <View key={p.id} style={styles.photoItem}>
            <Image source={{ uri: p.photo_url }} style={styles.photo} />
            <Text style={styles.photoLabel}>{p.photo_type}</Text>
          </View>
        ))}
        {photos.length === 0 && <Text style={styles.emptyText}>No photos uploaded.</Text>}
      </View>
    </View>
  )

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: trip?.lr_number }} />
      
      <View style={styles.header}>
        <View style={styles.routeRow}>
          <Text style={styles.city}>{trip?.origin}</Text>
          <Text style={styles.arrow}>→</Text>
          <Text style={styles.city}>{trip?.destination}</Text>
        </View>
        <StatusPill status={trip?.status} />
      </View>

      <View style={styles.tabs}>
        {['INFO', 'UPDATES', 'DOCS'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab as any)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll}>
        {activeTab === 'INFO' && renderInfoTab()}
        {activeTab === 'UPDATES' && renderUpdatesTab()}
        {activeTab === 'DOCS' && renderDocsTab()}
      </ScrollView>

      {trip?.status === 'LR_CREATED' && (
        <View style={styles.footer}>
          <Button title="Mark as In Transit" onPress={() => handleUpdateStatus('IN_TRANSIT')} loading={submitting} />
        </View>
      )}
      
      {trip?.status === 'IN_TRANSIT' && (
        <View style={styles.footer}>
          <Button title="Mark as Delivered" onPress={() => setShowPODModal(true)} />
        </View>
      )}

      {/* POD Modal */}
      <Modal visible={showPODModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Delivery</Text>
              <TouchableOpacity onPress={() => setShowPODModal(false)}><X color={Colors.textPrimary} size={24} /></TouchableOpacity>
            </View>
            <Text style={styles.modalSubText}>Please upload the signed Proof of Delivery (POD) to complete this trip.</Text>
            
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadPOD} disabled={uploadingPOD}>
              {uploadingPOD ? <ActivityIndicator color={Colors.primary} /> : <Camera color={Colors.primary} size={24} />}
              <Text style={styles.uploadBtnText}>Upload POD Photo</Text>
            </TouchableOpacity>

            {podPhotoUrl && (
              <Image source={{ uri: podPhotoUrl }} style={styles.podPreview} />
            )}

            <View style={{ height: 24 }} />
            <Button title="Confirm Delivery" onPress={() => handleUpdateStatus('DELIVERED')} disabled={!podPhotoUrl} loading={submitting} />
            <View style={{ height: 40 }} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#FFFFFF', padding: 24, borderBottomWidth: 1, borderBottomColor: Colors.border },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  city: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  arrow: { marginHorizontal: 8, color: Colors.textSecondary },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: Colors.primary },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textSecondary },
  activeTabText: { color: Colors.primary },
  scroll: { flex: 1 },
  tabContent: { padding: 24 },
  summaryCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  viewPdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, marginTop: 16 },
  viewPdfText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary, marginLeft: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 24 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, marginTop: 4, marginRight: 16 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  timelineDate: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  photoItem: { width: '47%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border },
  photo: { width: '100%', height: '80%' },
  photoLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textAlign: 'center', paddingVertical: 8, color: Colors.textPrimary },
  emptyText: { fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  footer: { padding: 24, paddingBottom: 40, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Colors.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  modalSubText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  uploadBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  uploadBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary, marginLeft: 8 },
  podPreview: { width: '100%', height: 200, borderRadius: 12, marginTop: 16, resizeMode: 'cover' },
})
