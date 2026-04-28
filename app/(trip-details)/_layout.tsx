import { Stack } from 'expo-router'
import { Colors } from '../../constants/Colors'

export default function TripDetailsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        title: 'Trip Details',
      }}
    />
  )
}
