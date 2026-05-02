import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Search, Plus } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { StatusPill } from '../../components/ui/StatusPill'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'

export default function TripsScreen() {
  const router = useRouter()
  const tenantId = useStore((state) => state.tenantId)
  
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE')
  const [searchQuery, setSearchQuery] = useState('')
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTrips = useCallback(async () => {
    if (!tenantId) return
    
    let query = supabase
      .from('trips')
      .select('id, lr_number, origin, destination, created_at, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (activeTab === 'ACTIVE') {
      query = query.in('status', ['LR_CREATED', 'IN_TRANSIT'])
    } else {
      query = query.in('status', ['DELIVERED', 'SETTLED'])
    }

    if (searchQuery) {
      query = query.ilike('lr_number', `%${searchQuery}%`)
    }

    const { data, error } = await query
    
    if (!error && data) {
      setTrips(data)
    }
    setLoading(false)
  }, [tenantId, activeTab, searchQuery])

  useEffect(() => {
    fetchTrips()
  }, [fetchTrips])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchTrips()
    setRefreshing(false)
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.7}
      onPress={() => router.push(`/(trip-details)/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.lrNumber}>{item.lr_number}</Text>
        <StatusPill status={item.status} />
      </View>
      <View style={styles.routeContainer}>
        <Text style={styles.cityText}>{item.origin}</Text>
        <Text style={styles.arrowText}>→</Text>
        <Text style={styles.cityText}>{item.destination}</Text>
      </View>
      <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString('en-GB')}</Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>All Trips</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search color={Colors.textSecondary} size={20} style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search LR Number..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'ACTIVE' && styles.activeTab]} 
          onPress={() => setActiveTab('ACTIVE')}
        >
          <Text style={[styles.tabText, activeTab === 'ACTIVE' && styles.activeTabText]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'COMPLETED' && styles.activeTab]} 
          onPress={() => setActiveTab('COMPLETED')}
        >
          <Text style={[styles.tabText, activeTab === 'COMPLETED' && styles.activeTabText]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No trips found.</Text>
            </View>
          )}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/(trip)/choose-method')}
        activeOpacity={0.8}
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: Colors.textPrimary },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 24, marginBottom: 16, borderRadius: 12, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textPrimary },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border },
  activeTab: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textSecondary },
  activeTabText: { color: '#FFFFFF' },
  list: { padding: 24, paddingTop: 0 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  lrNumber: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  routeContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cityText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  arrowText: { marginHorizontal: 8, color: Colors.textSecondary },
  dateText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
})
