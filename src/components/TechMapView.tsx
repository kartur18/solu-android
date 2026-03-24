import React from 'react'
import { View, Text } from 'react-native'
import { COLORS } from '../lib/constants'

// MapView placeholder - requires react-native-maps + expo-location to be installed
// Install: npx expo install react-native-maps expo-location
// Then replace this with actual MapView implementation

type Tech = {
  id: number
  nombre: string
  oficio: string
  distrito: string
  lat?: number
  lng?: number
  calificacion?: number
}

type Props = {
  techs: Tech[]
  onTechPress?: (tech: Tech) => void
}

export function TechMapView({ techs, onTechPress }: Props) {
  // When react-native-maps is installed, replace this with:
  // import MapView, { Marker } from 'react-native-maps'
  // <MapView region={...}>{techs.map(t => <Marker key={t.id} coordinate={{lat, lng}} />)}</MapView>

  return (
    <View style={{
      height: 300,
      backgroundColor: COLORS.light,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <Text style={{ fontSize: 32, marginBottom: 8 }}>🗺️</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark, textAlign: 'center' }}>
        Mapa de técnicos
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>
        {techs.filter(t => t.lat && t.lng).length} técnicos con ubicación disponible
      </Text>
      <Text style={{ fontSize: 10, color: COLORS.gray2, textAlign: 'center', marginTop: 8 }}>
        Instala react-native-maps para activar el mapa interactivo
      </Text>
    </View>
  )
}
