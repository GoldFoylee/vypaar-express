import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { ActivityIndicator, View } from 'react-native'
import { Colors } from '../constants/Colors'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  })
  
  const [authInitialized, setAuthInitialized] = useState(false)
  const setSession = useStore((state) => state.setSession)
  const setTenantId = useStore((state) => state.setTenantId)

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      await checkTenant(session?.user?.id)
      setAuthInitialized(true)
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      await checkTenant(session?.user?.id)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const checkTenant = async (userId: string | undefined) => {
    if (!userId) {
      setTenantId(null)
      return
    }
    const { data, error } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single()
      
    if (data && !error) {
      setTenantId(data.tenant_id)
    } else {
      setTenantId(null)
    }
  }

  if (!fontsLoaded || !authInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}
