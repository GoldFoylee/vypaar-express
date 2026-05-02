import React from 'react'
import { View, Text, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LogOut } from 'lucide-react-native'
import { Colors } from '../../constants/Colors'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

export default function ProfileScreen() {
  const router = useRouter()

  const handleLogout = async () => {
    const doLogout = () => {
      supabase.auth.signOut().then(() => {
        useStore.getState().setSession(null)
        useStore.getState().setTenantId(null)
        router.replace('/(onboarding)/login')
      }).catch((err) => {
        console.error(err)
      })
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        doLogout()
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: doLogout }
        ]
      )
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={{ flex: 1 }}>
          {/* Future profile options could go here */}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut color={Colors.danger} size={20} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 24, color: Colors.textPrimary },
  content: { flex: 1, padding: 24, justifyContent: 'space-between' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 16 },
  logoutText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.danger, marginLeft: 8 },
  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
})
