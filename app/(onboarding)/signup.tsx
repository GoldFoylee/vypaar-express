import React, { useState } from 'react'
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TouchableOpacity } from 'react-native'
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

    // Check if user exists
    const { data: userExists, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (checkError) {
      setLoading(false)
      Alert.alert('Error', 'Could not verify email. Please try again.')
      return
    }

    if (userExists) {
      setLoading(false)
      Alert.alert(
        'Account Exists',
        'An account with this email address already exists. Please log in instead.',
        [{ text: 'Log In', onPress: () => router.replace('/(onboarding)/login') }, { text: 'Cancel', style: 'cancel' }]
      )
      return
    }

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
              <TouchableOpacity onPress={() => router.replace('/(onboarding)/login')} style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>
                  Already have an account? <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.primary }}>Log In</Text>
                </Text>
              </TouchableOpacity>
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
