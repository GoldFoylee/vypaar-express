import { Stack } from 'expo-router'
import { Colors } from '../../constants/Colors'

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
      }}
    >
      <Stack.Screen name="step1" options={{ title: 'Step 1: Parties' }} />
      <Stack.Screen name="step2" options={{ title: 'Step 2: Goods' }} />
      <Stack.Screen name="step3" options={{ title: 'Step 3: Assign' }} />
      <Stack.Screen name="preview" options={{ title: 'Lorry Receipt' }} />
    </Stack>
  )
}
