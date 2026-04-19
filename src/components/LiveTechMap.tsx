import { View, Text } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'

interface Props {
  lat: number
  lng: number
  updatedAt?: string | null
  techNombre?: string
}

/**
 * Live map showing the técnico's current location during "En camino".
 * Subscribes via the tracking screen's Supabase Realtime — this component just renders.
 */
export function LiveTechMap({ lat, lng, updatedAt, techNombre }: Props) {
  const minsAgo = updatedAt
    ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000))
    : null

  return (
    <View style={{
      backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: COLORS.border,
      marginHorizontal: 16, marginBottom: 12,
    }}>
      <View style={{ padding: 12, backgroundColor: '#EFF6FF', borderBottomWidth: 1, borderBottomColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
        <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: '#1E3A8A' }}>
          {techNombre ? `${techNombre} en camino` : 'Técnico en camino'}
        </Text>
        {minsAgo != null ? (
          <Text style={{ fontSize: 10, color: '#1E40AF', fontWeight: '600' }}>
            actualizado hace {minsAgo < 1 ? '<1' : minsAgo} min
          </Text>
        ) : null}
      </View>
      <MapView
        style={{ width: '100%', height: 240 }}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        region={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={techNombre || 'Técnico'} description="Ubicación en vivo">
          <View style={{ backgroundColor: '#EA580C', padding: 6, borderRadius: 16, borderWidth: 2, borderColor: '#fff' }}>
            <Ionicons name="car" size={16} color="#fff" />
          </View>
        </Marker>
      </MapView>
    </View>
  )
}
