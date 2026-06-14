import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Image, Modal, FlatList, Dimensions, Share, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getTechLevel } from '../../src/lib/constants'
import { openTechWhatsapp, fetchTechWhatsapp } from '../../src/lib/contacto'
import { useContactLead } from '../../src/lib/useContactLead'
import { ContactLeadModal } from '../../src/components/ContactLeadModal'
import { supabase } from '../../src/lib/supabase'
import { TECNICO_PUBLIC_SELECT, tierFromServicios } from '../../src/lib/tecnico-columns'
import type { Tecnico, Resena } from '../../src/lib/types'
import { ProfileSkeleton } from '../../src/components/SkeletonLoader'
import { RatingBreakdown } from '../../src/components/RatingBreakdown'
import { optimizeUrl } from '../../src/lib/cloudinary'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, PulseDot } from '../../src/components/ui/Motion'

const AVATAR_GRADIENTS: [string, string][] = [
  [THEME.color.navy, '#2563EB'],
  [THEME.color.brand, '#F59E0B'],
  ['#8B5CF6', '#6366F1'],
  ['#10B981', '#059669'],
]

const TIER_LABEL: Record<string, string> = {
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
  platino: 'Platino',
}

function capitalizar(nombre?: string): string {
  if (!nombre) return ''
  return nombre.split(' ').map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

export default function TecnicoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  // Flujo de contacto primario in-app (crea lead + abre chat).
  const lead = useContactLead()
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [reviews, setReviews] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const [techRes, revRes] = await Promise.all([
        supabase.from('tecnicos').select(TECNICO_PUBLIC_SELECT).eq('id', id).single(),
        supabase.from('resenas').select('*').eq('tecnico_id', id).order('created_at', { ascending: false }).limit(20),
      ])
      if (techRes.error || !techRes.data) {
        setError(true)
      } else {
        setTech(techRes.data as unknown as Tecnico)
        setReviews(revRes.data || [])
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  if (loading) return <ProfileSkeleton />

  // Estado de error: ícono + mensaje + reintentar
  if (error || !tech) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxl, backgroundColor: THEME.color.surfaceAlt }}>
        <View style={{ width: 72, height: 72, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
          <Ionicons name="person-remove-outline" size={32} color={THEME.color.inkMuted} />
        </View>
        <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>No encontramos a este técnico</Text>
        <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.sm, lineHeight: 20 }}>
          Puede que ya no esté disponible. Revisa tu conexión e intenta de nuevo.
        </Text>
        <PressableScale
          onPress={load}
          accessibilityLabel="Reintentar"
          style={{ marginTop: THEME.space.xl, height: 52, paddingHorizontal: THEME.space.xxl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, ...THEME.shadow.brand }}
        >
          <Ionicons name="refresh" size={18} color={THEME.color.white} />
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Reintentar</Text>
        </PressableScale>
        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Volver"
          style={{ marginTop: THEME.space.md, height: 48, paddingHorizontal: THEME.space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs }}
        >
          <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft }}>Volver atrás</Text>
        </PressableScale>
      </View>
    )
  }

  const avatarGradient = AVATAR_GRADIENTS[(tech.id || 0) % AVATAR_GRADIENTS.length]
  // Tier derivado de servicios_completados (no es columna). Bronce = base, sin badge.
  const tier = tierFromServicios(tech.servicios_completados)
  const tierColor = tier !== 'bronce' ? THEME.color[tier] : null
  const level = getTechLevel(tech.servicios_completados || 0)

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero oscuro con avatar grande ── */}
        <FadeInUp delay={0}>
          <LinearGradient
            colors={[THEME.color.navy, THEME.color.navy700]}
            style={{ paddingTop: 56, paddingBottom: THEME.space.xxxl, paddingHorizontal: THEME.space.xl, borderBottomLeftRadius: THEME.radius.xxl, borderBottomRightRadius: THEME.radius.xxl, alignItems: 'center' }}
          >
            {/* Botón volver + compartir flotantes */}
            <View style={{ position: 'absolute', top: 50, left: THEME.space.lg, right: THEME.space.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                accessibilityLabel="Volver"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 40, height: 40, borderRadius: THEME.radius.full, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={22} color={THEME.color.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Share.share({
                  message: `Mira a ${tech.nombre}, ${tech.oficio} verificado en SOLU. https://solu.pe/tecnico/${tech.id}`,
                  title: `${tech.nombre} - SOLU`,
                })}
                accessibilityLabel="Compartir técnico"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 40, height: 40, borderRadius: THEME.radius.full, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="share-social" size={18} color={THEME.color.white} />
              </TouchableOpacity>
            </View>

            {/* Avatar grande */}
            <View style={{ position: 'relative', marginBottom: THEME.space.md }}>
              {tech.foto_url ? (
                <Image
                  source={{ uri: optimizeUrl(tech.foto_url, { width: 220, height: 220 }) }}
                  style={{ width: 104, height: 104, borderRadius: THEME.radius.xxl, borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' }}
                />
              ) : (
                <LinearGradient
                  colors={avatarGradient}
                  style={{ width: 104, height: 104, borderRadius: THEME.radius.xxl, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  <Text style={{ fontSize: 42, fontWeight: '800', color: THEME.color.white }}>{tech.nombre?.charAt(0) || 'T'}</Text>
                </LinearGradient>
              )}
              {tech.disponible && (
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: THEME.color.navy, alignItems: 'center', justifyContent: 'center' }}>
                  <PulseDot color={THEME.color.success} size={14} />
                </View>
              )}
            </View>

            {/* Nombre + verificado */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs }}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.white, textAlign: 'center' }}>{capitalizar(tech.nombre)}</Text>
              {tech.verificado && <Ionicons name="checkmark-circle" size={22} color={THEME.color.brand} />}
            </View>
            <Text style={{ ...THEME.font.body, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{tech.oficio}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: THEME.space.xs }}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.6)' }}>{tech.distrito}</Text>
              {tech.disponible && (
                <>
                  <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 2 }} />
                  <Text style={{ ...THEME.font.label, color: THEME.color.success }}>Disponible ahora</Text>
                </>
              )}
            </View>

            {/* Badges hero */}
            <View style={{ flexDirection: 'row', gap: THEME.space.xs, marginTop: THEME.space.md, flexWrap: 'wrap', justifyContent: 'center' }}>
              {tech.verificado && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(22,163,74,0.18)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: 5 }}>
                  <Ionicons name="shield-checkmark" size={13} color={THEME.color.success} />
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: '#4ADE80' }}>DNI verificado</Text>
                </View>
              )}
              {tierColor && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tierColor + '2E', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: 5 }}>
                  <Ionicons name="medal" size={13} color={tierColor} />
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: tierColor }}>{TIER_LABEL[tier]}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(242,107,33,0.2)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: 5 }}>
                <Text style={{ fontSize: 13 }}>{level.emoji}</Text>
                <Text style={{ ...THEME.font.caption, fontWeight: '700', color: '#FDBA74' }}>{level.name}</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeInUp>

        {/* ── Stats card flotante ── */}
        <FadeInUp delay={60}>
          <View style={{ marginHorizontal: THEME.space.xl, marginTop: -THEME.space.xl, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, flexDirection: 'row', ...THEME.shadow.md }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={18} color={THEME.color.warning} />
                <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
              </View>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>{tech.num_resenas || 0} reseñas</Text>
            </View>
            <View style={{ width: 1, backgroundColor: THEME.color.line, marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>{tech.servicios_completados || 0}</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>servicios</Text>
            </View>
            {tech.precio_desde ? (
              <>
                <View style={{ width: 1, backgroundColor: THEME.color.line, marginVertical: 4 }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ ...THEME.font.h1, color: THEME.color.brand }}>S/{tech.precio_desde}</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>desde</Text>
                </View>
              </>
            ) : null}
          </View>
        </FadeInUp>

        {/* ── Descripción ── */}
        {tech.descripcion ? (
          <FadeInUp delay={120}>
            <View style={{ marginHorizontal: THEME.space.xl, marginTop: THEME.space.lg, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, ...THEME.shadow.sm }}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.sm }}>Sobre {capitalizar(tech.nombre?.split(' ')[0])}</Text>
              <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, lineHeight: 22 }}>{tech.descripcion}</Text>
            </View>
          </FadeInUp>
        ) : null}

        {/* ── Galería de trabajos ── */}
        {tech.galeria && tech.galeria.length > 0 ? (
          <FadeInUp delay={180}>
            <View style={{ marginTop: THEME.space.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs, paddingHorizontal: THEME.space.xl, marginBottom: THEME.space.md }}>
                <Ionicons name="images" size={18} color={THEME.color.brand} />
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Galería de trabajos</Text>
              </View>
              <FlatList
                data={tech.galeria}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: THEME.space.xl, gap: THEME.space.md }}
                keyExtractor={(item, index) => `gallery-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setSelectedPhoto(item)}>
                    <Image
                      source={{ uri: optimizeUrl(item, { width: 320, height: 240 }) }}
                      style={{ width: 200, height: 150, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.surfaceSunken }}
                    />
                  </TouchableOpacity>
                )}
              />
            </View>
          </FadeInUp>
        ) : null}

        {/* ── Reseñas ── */}
        <FadeInUp delay={240}>
          <View style={{ paddingHorizontal: THEME.space.xl, marginTop: THEME.space.xxl }}>
            <Text style={{ ...THEME.font.h2, color: THEME.color.ink, marginBottom: THEME.space.md }}>Reseñas ({reviews.length})</Text>
            <RatingBreakdown reviews={reviews} averageRating={tech.calificacion || 0} totalReviews={tech.num_resenas || 0} />
            {reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: THEME.space.sm }}>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons key={s} name="star" size={15} color={s <= r.calificacion ? THEME.color.warning : THEME.color.line} />
                    ))}
                  </View>
                </View>
                <Text style={{ ...THEME.font.body, color: THEME.color.ink, lineHeight: 21 }}>{r.comentario}</Text>
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.sm }}>— {r.nombre_cliente} · {r.servicio}</Text>
              </View>
            ))}
            {reviews.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: THEME.space.xxxl }}>
                <View style={{ width: 64, height: 64, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.md }}>
                  <Ionicons name="chatbubbles-outline" size={28} color={THEME.color.brand} />
                </View>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Aún sin reseñas</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs }}>
                  Sé el primero en contratarlo y dejar tu opinión.
                </Text>
              </View>
            )}
          </View>
        </FadeInUp>
      </ScrollView>

      {/* ── Barra de acción fija abajo ── */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: THEME.color.surface, paddingHorizontal: THEME.space.xl, paddingTop: THEME.space.md, paddingBottom: 28, borderTopWidth: 1, borderTopColor: THEME.color.line, ...THEME.shadow.lg }}>
        {/* Acción primaria: Contactar (chat in-app, crea lead) + WhatsApp respaldo */}
        <View style={{ flexDirection: 'row', gap: THEME.space.sm }}>
          <PressableScale
            onPress={() => lead.contactar(tech)}
            disabled={lead.enviando}
            accessibilityLabel={`Contactar a ${tech.nombre}`}
            style={{ flex: 1, height: 52, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs, ...THEME.shadow.brand }}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={THEME.color.white} />
            <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Contactar</Text>
          </PressableScale>
          <PressableScale
            onPress={async () => {
              const ok = await openTechWhatsapp(tech.id, tech.nombre, `Hola ${tech.nombre}, te encontré en SOLU y necesito un servicio de ${tech.oficio}.`)
              if (!ok) Alert.alert('No disponible', 'No pudimos abrir WhatsApp ahora. Intenta de nuevo o usa "Contactar" para chatear dentro de SOLU.')
            }}
            accessibilityLabel="Contactar por WhatsApp"
            style={{ width: 52, height: 52, backgroundColor: '#25D366', borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="logo-whatsapp" size={24} color={THEME.color.white} />
          </PressableScale>
        </View>
        {/* Acciones secundarias: solicitar servicio, llamar, agendar */}
        <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.sm }}>
          <PressableScale
            onPress={() => router.push({ pathname: '/solicitar', params: { tecnicoId: String(tech.id), tecnicoNombre: tech.nombre, tecnicoOficio: tech.oficio } })}
            accessibilityLabel="Solicitar servicio"
            style={{ flex: 1, height: 44, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="construct" size={17} color={THEME.color.brand} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>Solicitar</Text>
          </PressableScale>
          <PressableScale
            onPress={async () => {
              const wa = await fetchTechWhatsapp(tech.id)
              if (!wa) { Alert.alert('No disponible', 'No pudimos obtener el número del técnico ahora. Intenta de nuevo en un momento.'); return }
              const phone = wa.length === 9 ? '+51' + wa : wa
              Linking.openURL(`tel:${phone}`)
            }}
            accessibilityLabel="Llamar al técnico"
            style={{ flex: 1, height: 44, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="call" size={17} color={THEME.color.brand} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>Llamar</Text>
          </PressableScale>
          <PressableScale
            onPress={() => router.push(`/agendar/${tech.id}`)}
            accessibilityLabel="Agendar cita"
            style={{ flex: 1, height: 44, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="calendar" size={17} color={THEME.color.brand} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>Agendar</Text>
          </PressableScale>
        </View>
      </View>

      {/* ── Modal de datos del cliente (solo si falta nombre/WhatsApp) ── */}
      <ContactLeadModal
        visible={lead.modalVisible}
        initialNombre={lead.initialNombre}
        initialWhatsapp={lead.initialWhatsapp}
        enviando={lead.enviando}
        onConfirm={lead.confirmarModal}
        onClose={lead.cerrarModal}
      />

      {/* ── Modal foto pantalla completa ── */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedPhoto(null)}
            accessibilityLabel="Cerrar foto"
            style={{ position: 'absolute', top: 50, right: THEME.space.xl, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color={THEME.color.white} />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: optimizeUrl(selectedPhoto, { width: Dimensions.get('window').width * 2 }) }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.7 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  )
}
