import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/Colors'

type StatusType = 'IN_TRANSIT' | 'DELIVERED' | 'LR_CREATED' | 'OVERDUE' | 'AVAILABLE' | 'ON_TRIP'

interface StatusPillProps {
  status: StatusType
}

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  let color = Colors.greyPlaceholder
  let label = status

  switch (status) {
    case 'IN_TRANSIT':
    case 'ON_TRIP':
      color = Colors.warning
      label = status === 'IN_TRANSIT' ? 'In Transit' : 'On Trip'
      break
    case 'DELIVERED':
    case 'AVAILABLE':
      color = Colors.success
      label = status === 'DELIVERED' ? 'Delivered' : 'Available'
      break
    case 'OVERDUE':
      color = Colors.danger
      label = 'Overdue'
      break
    case 'LR_CREATED':
      color = Colors.greyPlaceholder
      label = 'Pending'
      break
  }

  return (
    <View style={[styles.container, { borderColor: color, backgroundColor: `${color}26` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
})
