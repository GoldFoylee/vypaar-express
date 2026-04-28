import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { TrendingUp, Truck, Package, AlertCircle } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { StatusPill } from '../../components/ui/StatusPill'
import { useStore } from '../../store/useStore'
import { supabase } from '../../lib/supabase'

export default function DashboardScreen() {
  const router = useRouter()
  const tenantId = useStore((state) => state.tenantId)
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [metrics, setMetrics] = useState({ activeTrips: 0, availableTrucks: 0, totalFreight: 0 })
  const [recentTrips, setRecentTrips] = useState<any[]>([])

  const fetchDashboardData = useCallback(async () => {
    if (!tenantId) return

    // Active Trips
    const { count: activeTripsCount } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['LR_CREATED', 'IN_TRANSIT'])

    // Available Trucks
    const { count: availableTrucksCount } = await supabase
      .from('trucks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'AVAILABLE')

    // Monthly Freight (Simple approximation for current month)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const { data: freightData } = await supabase
      .from('trips')
      .select('freight_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString())

    const totalFreight = freightData?.reduce((sum, trip) => sum + (trip.freight_amount || 0), 0) || 0

    // Recent Trips
    const { data: recentTripsData } = await supabase
      .from('trips')
      .select('id, lr_number, origin, destination, created_at, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5)

    setMetrics({
      activeTrips: activeTripsCount || 0,
      availableTrucks: availableTrucksCount || 0,
      totalFreight
    })
    setRecentTrips(recentTripsData || [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchDashboardData()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={[styles.metricIconBox, { backgroundColor: '#DBEAFE' }]}>
              <Package color={Colors.primary} size={24} />
            </View>
            <Text style={styles.metricValue}>{metrics.activeTrips}</Text>
            <Text style={styles.metricLabel}>Active Trips</Text>
          </View>
          
          <View style={styles.metricCard}>
            <View style={[styles.metricIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Truck color={Colors.success} size={24} />
            </View>
            <Text style={styles.metricValue}>{metrics.availableTrucks}</Text>
            <Text style={styles.metricLabel}>Available Trucks</Text>
          </View>

          <View style={[styles.metricCard, { width: '100%' }]}>
            <View style={[styles.metricIconBox, { backgroundColor: '#F3E8FF' }]}>
              <TrendingUp color="#9333EA" size={24} />
            </View>
            <View style={styles.metricTextRow}>
              <View>
                <Text style={styles.metricValue}>₹{metrics.totalFreight.toLocaleString('en-IN')}</Text>
                <Text style={styles.metricLabel}>Total Freight (This Month)</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expiring Soon</Text>
          {/* Mocked Expiries since real fields weren't strictly provided in prompt schema */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expiriesScroll}>
            <View style={styles.expiryCard}>
              <AlertCircle color={Colors.warning} size={20} />
              <View style={styles.expiryContent}>
                <Text style={styles.expiryTitle}>Truck MH12AB1234</Text>
                <Text style={styles.expirySub}>Insurance expires in 5 days</Text>
              </View>
            </View>
            <View style={styles.expiryCard}>
              <AlertCircle color={Colors.warning} size={20} />
              <View style={styles.expiryContent}>
                <Text style={styles.expiryTitle}>Driver Ramesh Kumar</Text>
                <Text style={styles.expirySub}>License expires in 12 days</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/trips')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTrips.map(trip => (
            <TouchableOpacity 
              key={trip.id} 
              style={styles.activityCard}
              onPress={() => router.push(`/(trip-details)/${trip.id}`)}
            >
              <View style={styles.activityHeader}>
                <Text style={styles.lrNumber}>{trip.lr_number}</Text>
                <StatusPill status={trip.status} />
              </View>
              <View style={styles.routeContainer}>
                <Text style={styles.cityText}>{trip.origin}</Text>
                <Text style={styles.arrowText}>→</Text>
                <Text style={styles.cityText}>{trip.destination}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {recentTrips.length === 0 && (
            <Text style={styles.emptyText}>No recent trips found.</Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 24 },
  greeting: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.textSecondary },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 28, color: Colors.textPrimary, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginBottom: 32 },
  metricCard: { width: '47%', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  metricIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricValue: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: Colors.textPrimary },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  metricTextRow: { position: 'absolute', top: 16, left: 80 },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  viewAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary },
  expiriesScroll: { gap: 12, paddingRight: 24 },
  expiryCard: { flexDirection: 'row', backgroundColor: '#FFFBEB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FEF3C7', width: 260, alignItems: 'center' },
  expiryContent: { marginLeft: 12 },
  expiryTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  expirySub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.warning, marginTop: 2 },
  activityCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  lrNumber: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textPrimary },
  routeContainer: { flexDirection: 'row', alignItems: 'center' },
  cityText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  arrowText: { marginHorizontal: 8, color: Colors.textSecondary },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },
})
