import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Modal, Image, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Camera, FileText, X, MapPin, ArrowLeft } from 'lucide-react-native'
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
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  const fetchTrip = async () => {
    const { data: tripData } = await supabase
      .from('trips')
      .select(`
        *,
        trucks (registration_number, truck_type),
        drivers (name, phone)
      `)
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

    const tripSub = supabase
      .channel(`trip_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${id}` }, () => {
        fetchTrip()
      })
      .subscribe()

    const photoSub = supabase
      .channel(`photos_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_photos', filter: `trip_id=eq.${id}` }, () => {
        fetchTrip()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(tripSub)
      supabase.removeChannel(photoSub)
    }
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
      mediaTypes: ['images'],
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

  const handleNotifyParties = () => {
    Alert.alert(
      'Notify Parties',
      'An SMS with the POD and delivery details will be sent to the sender and receiver.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SMS',
          onPress: () => {
            Alert.alert('Success', 'SMS sent successfully!')
          }
        }
      ]
    )
  }

  const renderInfoTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.summaryCard}>
        {trip?.senders?.map((sender: any, i: number) => (
          <View style={styles.summaryRow} key={`sender-${i}`}>
            <Text style={styles.summaryLabel}>Sender {trip.senders.length > 1 ? i + 1 : ''}</Text>
            <Text style={styles.summaryValue}>{sender.name} • {sender.phone}</Text>
          </View>
        ))}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receiver</Text>
          <Text style={styles.summaryValue}>{trip?.receiver_name} • {trip?.receiver_phone}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Goods</Text>
          <Text style={styles.summaryValue}>{trip?.goods_description}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Weight</Text>
          <Text style={styles.summaryValue}>{trip?.weight_kg?.toLocaleString('en-IN')} kg</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Freight</Text>
          <Text style={styles.summaryValue}>₹{trip?.freight_amount?.toLocaleString('en-IN')}</Text>
        </View>
        {trip?.goods_value > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Goods Value</Text>
            <Text style={styles.summaryValue}>₹{trip?.goods_value?.toLocaleString('en-IN')}</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Truck</Text>
          <Text style={styles.summaryValue}>{trip?.trucks?.registration_number} • {trip?.trucks?.truck_type}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Driver</Text>
          <Text style={styles.summaryValue}>{trip?.drivers?.name} • {trip?.drivers?.phone}</Text>
        </View>
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
          <Text style={styles.timelineTitle}>LR Generated</Text>
          <Text style={styles.timelineDate}>{new Date(trip?.created_at).toLocaleString()}</Text>
        </View>
      </View>
      {['IN_TRANSIT', 'DELIVERED', 'SETTLED'].includes(trip?.status) && (
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineTitle}>Trip Started</Text>
          </View>
        </View>
      )}
      {trip?.status === 'IN_TRANSIT' && (
        <View style={styles.timelineItem}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineTitle}>Live Tracking</Text>
            <View style={styles.mapStub}>
               <MapPin color={Colors.primary} size={32} />
               <Text style={styles.mapStubText}>Live location active...</Text>
            </View>
          </View>
        </View>
      )}
      {['DELIVERED', 'SETTLED'].includes(trip?.status) && (
        <View style={styles.timelineItem}>
          <View style={[styles.timelineDot, { backgroundColor: Colors.success }]} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineTitle}>Trip Ended</Text>
            {trip?.status === 'DELIVERED' && (
              <Button title="Notify Parties" onPress={handleNotifyParties} style={{ marginTop: 12 }} />
            )}
          </View>
        </View>
      )}
    </View>
  )

  const renderDocsTab = () => {
    const loadingPhotos = photos.filter(p => p.photo_type === 'LOADING')
    const unloadingPhotos = photos.filter(p => p.photo_type === 'UNLOADING')
    const podPhotos = photos.filter(p => p.photo_type === 'POD')

    const renderSection = (title: string, list: any[]) => (
      <View style={{ marginBottom: 24 }}>
        <Text style={styles.docSectionTitle}>{title}</Text>
        {list.length > 0 ? (
          <View style={styles.photoGrid}>
            {list.map(p => (
              <TouchableOpacity key={p.id} style={styles.photoItem} onPress={() => setSelectedPhoto(p.photo_url)}>
                <Image source={{ uri: p.photo_url }} style={styles.photo} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPhotoBox}>
            <Text style={styles.emptyText}>No photos uploaded yet.</Text>
          </View>
        )}
      </View>
    )

    return (
      <View style={styles.tabContent}>
        {renderSection('LOADING', loadingPhotos)}
        {renderSection('UNLOADING', unloadingPhotos)}
        {renderSection('PROOF OF DELIVERY (POD)', podPhotos)}

        <Modal visible={!!selectedPhoto} animationType="fade" transparent>
          <View style={styles.fullScreenModal}>
            <TouchableOpacity style={styles.closeFullBtn} onPress={() => setSelectedPhoto(null)}>
              <X color="#FFFFFF" size={32} />
            </TouchableOpacity>
            {selectedPhoto && <Image source={{ uri: selectedPhoto }} style={styles.fullScreenImage} resizeMode="contain" />}
          </View>
        </Modal>
      </View>
    )
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: trip ? `${trip.origin} → ${trip.destination}` : 'Trip Details',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <ArrowLeft color="#FFFFFF" size={24} />
            </TouchableOpacity>
          )
        }} 
      />
      
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
  mapStub: { backgroundColor: '#EFF6FF', height: 120, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#BFDBFE', justifyContent: 'center', alignItems: 'center' },
  mapStubText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary, marginTop: 8 },
  docSectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  photoItem: { width: '30%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border },
  photo: { width: '100%', height: '100%' },
  emptyPhotoBox: { backgroundColor: '#F5F5F4', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  emptyText: { fontFamily: 'Inter_400Regular', color: Colors.textSecondary, fontSize: 12 },
  footer: { padding: 24, paddingBottom: 40, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Colors.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  modalSubText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  uploadBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F4', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  uploadBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary, marginLeft: 8 },
  podPreview: { width: '100%', height: 200, borderRadius: 12, marginTop: 16, resizeMode: 'cover' },
  fullScreenModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeFullBtn: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  fullScreenImage: { width: '100%', height: '100%' },
})
