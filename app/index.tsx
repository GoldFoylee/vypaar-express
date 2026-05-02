import { View, Text, StyleSheet } from 'react-native'
import { useRouter, useRootNavigationState } from 'expo-router'
import { Colors } from '../constants/Colors'
import { Button } from '../components/ui/Button'
import { Truck } from 'lucide-react-native'
import { useStore } from '../store/useStore'
import { useEffect } from 'react'

export default function SplashScreen() {
  const router = useRouter()
  const rootNavigationState = useRootNavigationState()
  const session = useStore((state) => state.session)
  const tenantId = useStore((state) => state.tenantId)

  useEffect(() => {
    if (!rootNavigationState?.key) return

    if (session) {
      if (tenantId) {
        router.replace('/(tabs)')
      } else {
        router.replace('/(onboarding)/setup-company')
      }
    }
  }, [session, tenantId, rootNavigationState?.key])

  // Don't flash the splash screen if we are already logged in
  if (session) {
    return <View style={styles.container} />
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Truck size={64} color="#FFFFFF" strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Vypaar Express</Text>
        <Text style={styles.tagline}>Run your fleet. No paperwork.</Text>
      </View>
      
      <View style={styles.footer}>
        <Button 
          title="Create Account" 
          onPress={() => router.push('/(onboarding)/signup')} 
          variant="primary"
        />
        <View style={{ height: 16 }} />
        <Button 
          title="Login" 
          onPress={() => router.push('/(onboarding)/login')} 
          variant="secondary"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'space-between',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  footer: {
    width: '100%',
    paddingBottom: 24,
  },
})
