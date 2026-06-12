import React from 'react'
import { View, Text, TouchableOpacity, Image, Share } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { openTechWhatsapp } from '../lib/contacto'
import { THEME } from '../lib/theme'
import { PressableScale, PulseDot } from './ui/Motion'
import { optimizeUrl } from '../lib/cloudinary'
import type { Tecnico } from '../lib/types'

type Props = {
  tech: Tecnico
  onToggleFavorite?: (techId: number) => void
  isFavorite?: boolean
}

// Los nombres de planes legacy (modelo viejo) no se muestran al usuario:
// se mapean a badges neutrales de calidad (TOP / DESTACADO).
const PLAN_COLORS: Record<string, { label: string; gradient: [string, string] }> = {
  elite: { label: 'TOP', gradient: ['#F59E0B', '#F26B21'] },
  premium: { label: 'DESTACADO', gradient: [THEME.color.brand, THEME.color.brandDark] },
  pro: { label: 'DESTACADO', gradient: [THEME.color.brand, THEME.color.brandDark] },
}

// Color por tier de fidelidad (THEME.color.{bronce,plata,oro,platino}).
const TIER_LABEL: Record<string, string> = {
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
  platino: 'Platino',
}

const AVATAR_GRADIENTS: [string, string][] = [
  [THEME.color.navy, '#2563EB'],
  [THEME.color.brand, '#F59E0B'],
  ['#8B5CF6', '#6366F1'],
  ['#10B981', '#059669'],
]

function capitalizar(nombre: string): string {
  return nombre.split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

export const TechCard = React.memo(function TechCard({ tech, onToggleFavorite, isFavorite }: Props) {
  const router = useRouter()
  // V3.1: tech.plan ahora es opcional. Mapeamos string vacío al fallback.
  const planStyle = PLAN_COLORS[tech.plan ?? ''] ?? null
  const avatarGradient = AVATAR_GRADIENTS[(tech.id || 0) % AVATAR_GRADIENTS.length]
  const tierColor = tech.tier ? THEME.color[tech.tier] : null

  async function handleShare() {
    try {
      await Share.share({
        message: `👷 ${tech.nombre} - ${tech.oficio} en SOLU\n⭐ ${tech.calificacion?.toFixed(1) || '0.0'} · ${tech.distrito}\n\nEncuéntralo en: https://solu.pe/buscar?tech=${tech.id}`,
        title: `Técnico SOLU: ${tech.nombre}`,
      })
    } catch {}
  }

  return (
    <PressableScale
      onPress={() => router.push(`/tecnico/${tech.id}`)}
      scaleTo={0.97}
      accessibilityLabel={`Ver perfil de ${tech.nombre}`}
      style={{
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.xl,
        marginBottom: THEME.space.md,
        ...THEME.shadow.md,
      }}
    >
      <View style={{ padding: THEME.space.lg }}>
        {/* Acciones flotantes: favorito + compartir */}
        <View style={{ position: 'absolute', top: THEME.space.md, right: THEME.space.md, flexDirection: 'row', gap: THEME.space.sm, zIndex: 10 }}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); handleShare() }}
            accessibilityLabel="Compartir técnico"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 34,
              height: 34,
              borderRadius: THEME.radius.full,
              backgroundColor: THEME.color.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="share-social-outline" size={16} color={THEME.color.inkSoft} />
          </TouchableOpacity>
          {onToggleFavorite && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onToggleFavorite(tech.id) }}
              accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 34,
                height: 34,
                borderRadius: THEME.radius.full,
                backgroundColor: isFavorite ? THEME.color.dangerBg : THEME.color.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? THEME.color.danger : THEME.color.inkMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Avatar con borde y dot de disponible */}
          <View style={{ position: 'relative', marginRight: THEME.space.md }}>
            {tech.foto_url ? (
              <Image
                source={{ uri: optimizeUrl(tech.foto_url, { width: 64, height: 64 }) }}
                style={{ width: 64, height: 64, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.color.line }}
              />
            ) : (
              <LinearGradient
                colors={avatarGradient}
                style={{ width: 64, height: 64, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 26, fontWeight: '800', color: THEME.color.white }}>{tech.nombre?.charAt(0) || 'T'}</Text>
              </LinearGradient>
            )}

            {/* Dot "disponible ahora" con pulso */}
            {tech.disponible && (
              <View style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: THEME.color.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <PulseDot color={THEME.color.success} size={10} />
              </View>
            )}
          </View>

          {/* Info principal */}
          <View style={{ flex: 1, paddingRight: 72 }}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink }} numberOfLines={1}>
              {capitalizar(tech.nombre)}
            </Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 2 }} numberOfLines={1}>
              {tech.oficio}
            </Text>

            {/* Rating + distancia/distrito */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.sm }}>
              {(tech.num_resenas || 0) > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="star" size={13} color={THEME.color.warning} />
                  <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>
                    {tech.calificacion?.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>
                    ({tech.num_resenas})
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="sparkles" size={12} color={THEME.color.brand} />
                  <Text style={{ ...THEME.font.label, color: THEME.color.brand }}>Nuevo</Text>
                </View>
              )}
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: THEME.color.inkMuted }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 }}>
                <Ionicons name="location-outline" size={12} color={THEME.color.inkMuted} />
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }} numberOfLines={1}>
                  {tech.distrito}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Badges: verificado, plan (TOP/DESTACADO), tier */}
        <View style={{ flexDirection: 'row', gap: THEME.space.xs, marginTop: THEME.space.md, flexWrap: 'wrap' }}>
          {tech.verificado && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
              <Ionicons name="checkmark-circle" size={13} color={THEME.color.success} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>Verificado</Text>
            </View>
          )}
          {planStyle && (
            <LinearGradient
              colors={planStyle.gradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4, justifyContent: 'center' }}
            >
              <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.white }}>{planStyle.label}</Text>
            </LinearGradient>
          )}
          {tierColor && tech.tier && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: tierColor + '1A', borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
              <Ionicons name="medal" size={12} color={tierColor} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: tierColor }}>{TIER_LABEL[tech.tier]}</Text>
            </View>
          )}
          {(tech.servicios_completados || 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
              <Ionicons name="people" size={12} color={THEME.color.inkSoft} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft }}>Contratado {tech.servicios_completados}x</Text>
            </View>
          )}
          {(tech.servicios_completados || 0) > 5 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
              <Ionicons name="flash" size={12} color={THEME.color.info} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>Responde rápido</Text>
            </View>
          )}
        </View>

        {/* Acciones: Contactar (primaria brand) + WhatsApp */}
        <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.lg }}>
          <PressableScale
            onPress={() => router.push(`/tecnico/${tech.id}`)}
            accessibilityLabel={`Contactar a ${tech.nombre}`}
            style={{
              flex: 1,
              height: 48,
              backgroundColor: THEME.color.brand,
              borderRadius: THEME.radius.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: THEME.space.xs,
              ...THEME.shadow.brand,
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={17} color={THEME.color.white} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Contactar</Text>
          </PressableScale>
          <PressableScale
            onPress={() => { openTechWhatsapp(tech.id, tech.nombre) }}
            accessibilityLabel={`Escribir por WhatsApp a ${tech.nombre}`}
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#25D366',
              borderRadius: THEME.radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="logo-whatsapp" size={22} color={THEME.color.white} />
          </PressableScale>
        </View>
      </View>
    </PressableScale>
  )
})
