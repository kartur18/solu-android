import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNetworkStatus } from '../lib/useNetworkStatus'

/**
 * Reusable offline banner. Shows a warning when the device is not connected.
 * Place at the top of any screen that requires network.
 */
export function OfflineBanner() {
  const isConnected = useNetworkStatus()

  if (isConnected) return null

  return (
    <View style={{
      backgroundColor: '#FEF3C7',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    }}>
      <Ionicons name="cloud-offline" size={18} color="#92400E" />
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' }}>
        Sin conexión a internet
      </Text>
    </View>
  )
}
