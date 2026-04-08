import React from 'react'
import { View, Text, TouchableOpacity, Linking, Image, Share } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, waLink } from '../lib/constants'
import { optimizeUrl } from '../lib/cloudinary'
import type { Tecnico } from '../lib/types'

type Props = {
  tech: Tecnico
  onToggleFavorite?: (techId: number) => void
  isFavorite?: boolean
}

const PLAN_COLORS: Record<string, { bg: string; text: string; label: string; border: string; gradient: [string, string] }> = {
  elite: { bg: '#FFD700', text: '#1A1A2E', label: 'ELITE', border: '#FFD700', gradient: ['#FFD700', '#FFA500'] },
  premium: { bg: COLORS.pri, text: '#FFFFFF', label: 'PRO', border: COLORS.pri, gradient: [COLORS.pri, '#E55A10'] },
  pro: { bg: COLORS.pri, text: '#FFFFFF', label: 'PRO', border: COLORS.pri, gradient: [COLORS.pri, '#E55A10'] },
  profesional: { bg: COLORS.blue, text: '#FFFFFF', label: 'PRO', border: COLORS.blue, gradient: [COLORS.blue, '#1D4ED8'] },
}

const AVATAR_GRADIENTS: [string, string][] = [
  ['#1E3A5F', '#2563EB'],
  ['#F26B21', '#F59E0B'],
  ['#8B5CF6', '#6366F1'],
  ['#10B981', '#059669'],
]

function StarRating({ rating }: { rating: number }) {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(<Ionicons key={i} name="star" size={11} color="#F59E0B" />)
    } else if (i === fullStars && hasHalf) {
      stars.push(<Ionicons key={i} name="star-half" size={11} color="#F59E0B" />)
    } else {
      stars.push(<Ionicons key={i} name="star-outline" size={11} color="#E5E7EB" />)
    }
  }
  return <View style={{ flexDirection: 'row', gap: 1 }}>{stars}</View>
}

export const TechCard = React.memo(function TechCard({ tech, onToggleFavorite, isFavorite }: Props) {
  const router = useRouter()
  const planStyle = PLAN_COLORS[tech.plan] || null
  const avatarGradient = AVATAR_GRADIENTS[(tech.id || 0) % AVATAR_GRADIENTS.length]

  // Left border color based on plan
  const leftBorderColor = planStyle
    ? planStyle.border
    : '#E2E8F0'

  async function handleShare() {
    try {
      await Share.share({
        message: `👷 ${tech.nombre} - ${tech.oficio} en SOLU\n⭐ ${tech.calificacion?.toFixed(1) || '0.0'} · ${tech.distrito}\n\nEncuéntralo en: https://solu.pe/buscar?tech=${tech.id}`,
        title: `Técnico SOLU: ${tech.nombre}`,
      })
    } catch {}
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/tecnico/${tech.id}`)}
      activeOpacity={0.85}
    >
      <View style={{
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 0,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 3,
        overflow: 'hidden',
      }}>
      {/* Colored left border */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: leftBorderColor, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }} />

      <View style={{ padding: 16, paddingLeft: 20 }}>
        {/* Favorite heart button */}
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onToggleFavorite(tech.id) }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 10,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isFavorite ? '#FEE2E2' : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}

        {/* Share button */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); handleShare() }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            position: 'absolute',
            top: 10,
            right: onToggleFavorite ? 48 : 10,
            zIndex: 10,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F0F9FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="share-social-outline" size={16} color="#0EA5E9" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Avatar with gradient background */}
          <View style={{ position: 'relative' }}>
            {tech.foto_url ? (
              <Image
                source={{ uri: optimizeUrl(tech.foto_url, { width: 60, height: 60 }) }}
                style={{ width: 60, height: 60, borderRadius: 18, marginRight: 12, borderWidth: 2, borderColor: planStyle ? planStyle.border + '40' : '#E2E8F0' }}
              />
            ) : (
              <LinearGradient
                colors={avatarGradient}
                style={{ width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
              >
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF' }}>{tech.nombre?.charAt(0) || 'T'}</Text>
              </LinearGradient>
            )}

            {/* Green "Disponible" dot */}
            {tech.disponible && (
              <View style={{
                position: 'absolute',
                bottom: 2,
                right: 10,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: '#10B981',
                borderWidth: 2.5,
                borderColor: COLORS.white,
              }} />
            )}
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{tech.nombre}</Text>
              {tech.verificado && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E8FFF3', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.acc} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.acc }}>Verificado</Text>
                </View>
              )}
              {planStyle && (
                <LinearGradient
                  colors={planStyle.gradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}
                >
                  <Text style={{ color: planStyle.text, fontSize: 9, fontWeight: '800' }}>{planStyle.label}</Text>
                </LinearGradient>
              )}
            </View>
            <Text style={{ fontSize: 13, color: COLORS.dark, marginTop: 3, fontWeight: '600' }}>{tech.oficio}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Ionicons name="location-outline" size={12} color={COLORS.gray2} />
              <Text style={{ fontSize: 12, color: COLORS.gray2 }}>{tech.distrito}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' }}>
              <StarRating rating={tech.calificacion || 0} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.dark, marginTop: 2 }}>
                {tech.calificacion?.toFixed(1) || '0.0'}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: COLORS.gray2 }}>{tech.num_resenas || 0} reseñas</Text>
          </View>
        </View>

        {/* Trust metrics & badges row */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {/* Response time estimate based on completed services */}
          {(tech.servicios_completados || 0) > 5 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Ionicons name="flash" size={11} color={COLORS.blue} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.blue }}>Responde en ~1h</Text>
            </View>
          )}
          {/* Times hired metric */}
          {(tech.servicios_completados || 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Ionicons name="people" size={11} color="#10B981" />
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Contratado {tech.servicios_completados}x</Text>
            </View>
          )}
          {/* Price */}
          {tech.precio_desde ? (
            <View style={{ backgroundColor: COLORS.priLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.pri }}>
                Desde S/{tech.precio_desde}
              </Text>
            </View>
          ) : null}
          {/* Experience */}
          {tech.experiencia && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Ionicons name="time" size={11} color="#92400E" />
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400E' }}>{tech.experiencia}</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); Linking.openURL(waLink(tech.whatsapp, `Hola ${tech.nombre}, te encontré en SOLU.`)) }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: '#25D366',
              borderRadius: 12,
              paddingVertical: 11,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              shadowColor: '#25D366',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
            <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/tecnico/${tech.id}`)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: '#1E3A5F',
              borderRadius: 12,
              paddingVertical: 11,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              shadowColor: '#1E3A5F',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons name="person-outline" size={16} color={COLORS.white} />
            <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>Ver perfil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    </TouchableOpacity>
  )
})
