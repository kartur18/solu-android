import React from 'react'
import { View, Text } from 'react-native'
import MapView, { Marker, Callout } from 'react-native-maps'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import type { Tecnico } from '../lib/types'

type Props = {
  techs: Tecnico[]
}

const LIMA_REGION = {
  latitude: -12.0464,
  longitude: -77.0428,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
}

export function TechMapView({ techs }: Props) {
  const router = useRouter()
  const geoTechs = techs.filter(t => t.lat && t.lng)

  if (geoTechs.length === 0) {
    return (
      <View style={{
        height: 300, backgroundColor: COLORS.light, borderRadius: 16,
        borderWidth: 1, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <Ionicons name="map-outline" size={40} color={COLORS.gray2} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark, textAlign: 'center', marginTop: 8 }}>
          Sin ubicaciones disponibles
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>
          Los técnicos aún no tienen ubicación registrada
        </Text>
      </View>
    )
  }

  return (
    <View style={{ height: 350, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={LIMA_REGION}
      >
        {geoTechs.map((tech) => (
          <Marker
            key={tech.id}
            coordinate={{ latitude: tech.lat!, longitude: tech.lng! }}
            pinColor={COLORS.pri}
          >
            <Callout onPress={() => router.push(`/tecnico/${tech.id}`)}>
              <View style={{ padding: 8, maxWidth: 200 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark }}>{tech.nombre}</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>{tech.oficio}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: COLORS.yellow }}>★</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark }}>
                    {tech.calificacion?.toFixed(1) || '0.0'}
                  </Text>
                  {tech.precio_desde && (
                    <Text style={{ fontSize: 11, color: COLORS.pri, marginLeft: 8 }}>
                      Desde S/{tech.precio_desde}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 10, color: COLORS.blue, marginTop: 4 }}>Toca para ver perfil →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  )
}
