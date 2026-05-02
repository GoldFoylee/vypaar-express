import { Stack } from 'expo-router'

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="choose-method" />
      <Stack.Screen name="step1-parties" />
      <Stack.Screen name="step2-load" />
      <Stack.Screen name="step3-assign" />
      <Stack.Screen name="lr-preview" />
    </Stack>
  )
}
