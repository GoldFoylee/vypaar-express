import React, { useState } from 'react'
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/Colors'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter a valid email address')
      return
    }
    
    setError('')
    setLoading(true)

    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      email,
    })

    setLoading(false)

    if (supabaseError) {
      Alert.alert('Error', supabaseError.message)
    } else {
      router.push({
        pathname: '/(onboarding)/verify',
        params: { email }
      })
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Enter your email address</Text>
              <Text style={styles.subtext}>We'll send you a one-time password</Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="example@company.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text)
                  setError('')
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={error}
              />
            </View>

            <View style={styles.footer}>
              <Button 
                title="Send OTP" 
                onPress={handleSendOTP} 
                loading={loading}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    flex: 1,
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 0 : 24,
  },
})
