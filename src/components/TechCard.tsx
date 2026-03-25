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

const PLAN_COLORS: Record<string, { bg: string; text: string; label: string; border: string }> = {
  elite: { bg: '#FFD700', text: '#1A1A2E', label: 'ELITE', border: '#FFD700' },
  premium: { bg: COLORS.pri, text: '#FFFFFF', label: 'PRO', border: COLORS.pri },
  pro: { bg: COLORS.pri, text: '#FFFFFF', label: 'PRO', border: COLORS.pri },
  profesional: { bg: COLORS.blue, text: '#FFFFFF', label: 'PRO', border: COLORS.blue },
}

export const TechCard = React.memo(function TechCard({ tech }: Props) {
  const router = useRouter()
  const planStyle = PLAN_COLORS[tech.plan] || null

  return (
    <TouchableOpacity
      onPress={() => router.push(`/tecnico/${tech.id}`)}
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: planStyle ? planStyle.border + '30' : COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Plan indicator bar */}
      {planStyle && (
        <View style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 3, backgroundColor: planStyle.bg, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }} />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Avatar */}
        {tech.foto_url ? (
          <Image source={{ uri: optimizeUrl(tech.foto_url, { width: 56, height: 56 }) }} style={{ width: 56, height: 56, borderRadius: 16, marginRight: 12 }} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.charAt(0) || 'T'}</Text>
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{tech.nombre}</Text>
            {tech.verificado && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E8FFF3', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.acc} />
                <Text style={{ fontSize: 8, fontWeight: '700', color: COLORS.acc }}>Verificado</Text>
              </View>
            )}
            {planStyle && (
              <View style={{ backgroundColor: planStyle.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: planStyle.text, fontSize: 9, fontWeight: '800' }}>{planStyle.label}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 13, color: COLORS.dark, marginTop: 3, fontWeight: '600' }}>{tech.oficio}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="location-outline" size={12} color={COLORS.gray2} />
            <Text style={{ fontSize: 12, color: COLORS.gray2 }}>{tech.distrito}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Ionicons name="star" size={13} color={COLORS.yellow} />
            <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.dark }}>
              {tech.calificacion?.toFixed(1) || '0.0'}
            </Text>
          </View>
          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>{tech.num_resenas || 0} reseñas</Text>
          {tech.precio_desde ? (
            <View style={{ backgroundColor: COLORS.priLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.pri }}>
                S/{tech.precio_desde}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); Linking.openURL(waLink(tech.whatsapp, `Hola ${tech.nombre}, te encontré en SOLU.`)) }}
          style={{
            flex: 1,
            backgroundColor: '#25D366',
            borderRadius: 12,
            paddingVertical: 11,
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
            backgroundColor: COLORS.dark,
            borderRadius: 12,
            paddingVertical: 11,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="person-outline" size={16} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>Ver perfil</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})
