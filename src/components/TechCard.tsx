import React from 'react'
import { View, Text, TouchableOpacity, Linking, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, waLink } from '../lib/constants'
import { optimizeUrl } from '../lib/cloudinary'
import type { Tecnico } from '../lib/types'

type Props = {
  tech: Tecnico
}

export const TechCard = React.memo(function TechCard({ tech }: Props) {
  const router = useRouter()

  return (
    <TouchableOpacity
      onPress={() => router.push(`/tecnico/${tech.id}`)}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {tech.foto_url ? (
          <Image source={{ uri: optimizeUrl(tech.foto_url, { width: 48, height: 48 }) }} style={{ width: 48, height: 48, borderRadius: 12, marginRight: 10 }} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.pri }}>{tech.nombre?.charAt(0) || 'T'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{tech.nombre}</Text>
            {tech.verificado && (
              <Ionicons name="checkmark-circle" size={16} color={COLORS.acc} />
            )}
            {(tech.plan === 'premium' || tech.plan === 'pro') && (
              <View style={{ backgroundColor: COLORS.pri, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: COLORS.white, fontSize: 9, fontWeight: '800' }}>PRO</Text>
              </View>
            )}
            {tech.plan === 'elite' && (
              <View style={{ backgroundColor: '#FFD700', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: '#1A1A2E', fontSize: 9, fontWeight: '800' }}>ELITE</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 2 }}>{tech.oficio}</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray2, marginTop: 2 }}>
            <Ionicons name="location-outline" size={12} color={COLORS.gray2} /> {tech.distrito}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={14} color={COLORS.yellow} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>
              {tech.calificacion?.toFixed(1) || '0.0'}
            </Text>
          </View>
          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>{tech.num_resenas || 0} reseñas</Text>
          {tech.precio_desde && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.pri, marginTop: 4 }}>
              Desde S/{tech.precio_desde}
            </Text>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          onPress={() => Linking.openURL(waLink(tech.whatsapp, `Hola ${tech.nombre}, te encontré en SOLU.`))}
          style={{
            flex: 1,
            backgroundColor: '#25D366',
            borderRadius: 10,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/tecnico/${tech.id}`)}
          style={{
            flex: 1,
            backgroundColor: COLORS.priLight,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: COLORS.pri, fontWeight: '700', fontSize: 13 }}>Ver perfil</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})
