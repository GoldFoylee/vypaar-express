import React, { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '../../constants/Colors'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

export default function VerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()
  
  const [errorMsg, setErrorMsg] = useState('')
  
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)

  const inputRefs = useRef<Array<TextInput | null>>([])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendTimer])

  const handleTextChange = (text: string, index: number) => {
    const newCode = [...code]
    newCode[index] = text
    setCode(newCode)

    if (text.length === 1 && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && code[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const newCode = [...code]
      newCode[index - 1] = ''
      setCode(newCode)
    }
  }

  const handleVerify = async () => {
    const token = code.join('')
    if (token.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code')
      return
    }
    
    setErrorMsg('')
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })

      if (error) {
        setCode(['', '', '', '', '', ''])
        setErrorMsg('Incorrect or expired code. Please try again.')
        Alert.alert(
          'Invalid Code',
          'The code you entered is incorrect or has expired. Please check your email and try again.',
          [{ text: 'OK' }]
        )
        return
      }

      if (data.user) {
        // Check if user row exists
        const { data: userRow, error: userError } = await supabase
          .from('users')
          .select('id, tenant_id, role')
          .eq('id', data.user.id)
          .maybeSingle()

        if (userError) {
          Alert.alert('Error', 'Could not verify your account. Please try again.')
          await supabase.auth.signOut()
          router.replace('/(onboarding)/login')
          return
        }

        if (!userRow) {
          // No user row means this is a new signup
          router.replace('/(onboarding)/setup-company')
          return
        }

        if (!userRow.tenant_id) {
          router.replace('/(onboarding)/setup-company')
          return
        }

        router.replace('/(tabs)')
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setResendTimer(60)
      Alert.alert('Success', 'A new OTP has been sent to your email.')
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
              <Text style={styles.title}>Enter verification code</Text>
              <Text style={styles.subtext}>Code sent to {email}</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.otpContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={styles.otpInput}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(text) => handleTextChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Text 
                style={[styles.resendText, resendTimer === 0 && styles.resendActive]} 
                onPress={handleResend}
              >
                {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
              </Text>
              {errorMsg ? (
                <Text style={{ color: Colors.danger, fontFamily: 'Inter_400Regular', marginTop: 12 }}>
                  {errorMsg}
                </Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              <Button 
                title="Verify & Continue" 
                onPress={handleVerify} 
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
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textPrimary,
  },
  resendText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resendActive: {
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 0 : 24,
  },
})
