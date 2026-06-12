import { useState } from 'react'
import { View, Text, ScrollView, TextInput, Alert, Linking, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { waLink, SUPPORT_PHONE, ESTADOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { fetchClienteServicios } from '../src/lib/servicios'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

const REWARDS = [
  { pts: 50, label: '10% de descuento', desc: 'En tu próximo servicio', emoji: '🎟️', code: 'SOLU10' },
  { pts: 100, label: '20% de descuento', desc: 'En cualquier servicio', emoji: '🎫', code: 'SOLU20' },
  { pts: 200, label: '30% de descuento', desc: 'En tu próximo servicio', emoji: '🎁', code: 'SOLU30' },
  { pts: 500, label: 'Cliente VIP', desc: 'Prioridad + descuentos permanentes', emoji: '👑', code: 'SOLUVIP' },
]

const HOW_TO_EARN = [
  { action: 'Solicitar un servicio', pts: 10, icon: 'build' as const },
  { action: 'Completar un servicio', pts: 15, icon: 'checkmark-circle' as const },
  { action: 'Dejar una reseña', pts: 5, icon: 'star' as const },
  { action: 'Referir un amigo', pts: 20, icon: 'people' as const },
  { action: 'Primera solicitud', pts: 25, icon: 'gift' as const },
]

// Tiers de lealtad — derivados de los puntos solo para display (no toca lógica)
const TIERS = [
  { name: 'Bronce', min: 0, color: THEME.color.bronce, emoji: '🥉' },
  { name: 'Plata', min: 100, color: THEME.color.plata, emoji: '🥈' },
  { name: 'Oro', min: 250, color: THEME.color.oro, emoji: '🥇' },
  { name: 'Platino', min: 500, color: THEME.color.platino, emoji: '🏆' },
]

function tierFor(points: number) {
  let current = TIERS[0]
  let next: typeof TIERS[0] | null = TIERS[1] ?? null
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) {
      current = TIERS[i]
      next = TIERS[i + 1] ?? null
    }
  }
  return { current, next }
}

export default function FidelidadScreen() {
  const [wa, setWa] = useState('')
  const [loading, setLoading] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [history, setHistory] = useState<{ type: string; pts: number; date: string }[]>([])

  async function loadPoints() {
    const waClean = wa.replace(/\D/g, '')
    if (!waClean || waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) return Alert.alert('Número incompleto', 'Ingresa tu WhatsApp de 9 dígitos (empieza con 9)')
    setLoading(true)
    try {
      // Consultar con el número sin espacios (el input sugiere "999 888 777")
      // Lectura de `clientes` migrada a endpoint server-side (anon cerrado por PII).
      const services = await fetchClienteServicios(waClean)

      const { data: reviews } = await supabase
        .from('resenas')
        .select('id, created_at')
        .eq('whatsapp_cliente', waClean)

      const solicitudes = services?.length || 0
      const completados = services?.filter(s => s.estado === ESTADOS.COMPLETADO || s.estado === ESTADOS.CALIFICADO).length || 0
      const resenasCount = reviews?.length || 0

      // Calculate points
      let totalPts = 0
      totalPts += solicitudes * 10      // 10 pts por solicitud
      totalPts += completados * 15      // 15 pts extra por completado
      totalPts += resenasCount * 5      // 5 pts por reseña
      if (solicitudes > 0) totalPts += 25 // 25 pts bonus primera solicitud

      setPoints(totalPts)

      // Build history
      const hist: { type: string; pts: number; date: string }[] = []
      if (solicitudes > 0) {
        hist.push({ type: '🎉 Bonus primera solicitud', pts: 25, date: services![0].created_at.split('T')[0] })
      }
      services?.forEach(s => {
        hist.push({ type: `📋 Solicitud: ${s.servicio}`, pts: 10, date: s.created_at.split('T')[0] })
        if (s.estado === ESTADOS.COMPLETADO || s.estado === ESTADOS.CALIFICADO) {
          hist.push({ type: `✅ Servicio completado`, pts: 15, date: s.created_at.split('T')[0] })
        }
      })
      reviews?.forEach(r => hist.push({ type: '⭐ Reseña enviada', pts: 5, date: r.created_at.split('T')[0] }))
      hist.sort((a, b) => b.date.localeCompare(a.date))
      setHistory(hist)
    } catch {
      Alert.alert('No pudimos cargar tus puntos', 'Revisa tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function claimReward(reward: typeof REWARDS[0]) {
    if (points === null || points < reward.pts) {
      Alert.alert('Puntos insuficientes', `Necesitas ${reward.pts - (points || 0)} puntos más`)
      return
    }

    const msg = `Hola, quiero canjear mi recompensa SOLU:\n\n🎁 ${reward.label}\n📱 Mi WhatsApp: ${wa}\n🔑 Código: ${reward.code}\n⭐ Mis puntos: ${points}\n\nPor favor confirmen mi canje.`

    Alert.alert(
      'Canjear recompensa',
      `¿Canjear "${reward.label}" por ${reward.pts} puntos?\n\nSe enviará tu solicitud por WhatsApp para confirmación.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Canjear',
          onPress: () => {
            haptics.success()
            Linking.openURL(waLink(SUPPORT_PHONE, msg))
          },
        },
      ]
    )
  }

  const tier = points !== null ? tierFor(points) : null
  const progressPct = tier
    ? tier.next
      ? Math.min(100, Math.round(((points! - tier.current.min) / (tier.next.min - tier.current.min)) * 100))
      : 100
    : 0

  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ paddingBottom: THEME.space.xxxl + THEME.space.xxl }}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={{ backgroundColor: THEME.color.navy, paddingHorizontal: THEME.space.xxl, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.lg, paddingBottom: THEME.space.xxl, borderBottomLeftRadius: THEME.radius.xxl, borderBottomRightRadius: THEME.radius.xxl, ...THEME.shadow.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
          <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: 'rgba(242,107,33,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ribbon" size={24} color={THEME.color.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.h1, color: THEME.color.white }}>Fidelidad SOLU</Text>
            <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              Acumula puntos y canjea descuentos
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: THEME.space.lg }}>
        {points === null ? (
          <>
            {/* How it works */}
            <FadeInUp delay={0}>
              <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.sm }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.md }}>¿Cómo funciona?</Text>
                {HOW_TO_EARN.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, paddingVertical: THEME.space.sm, borderBottomWidth: i < HOW_TO_EARN.length - 1 ? 1 : 0, borderBottomColor: THEME.color.lineSoft }}>
                    <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={item.icon} size={19} color={THEME.color.brand} />
                    </View>
                    <Text style={{ flex: 1, ...THEME.font.body, color: THEME.color.ink }}>{item.action}</Text>
                    <View style={{ backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 3 }}>
                      <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.success }}>+{item.pts}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </FadeInUp>

            {/* Tiers preview */}
            <FadeInUp delay={60}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.sm }}>Niveles de cliente</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: THEME.space.sm, paddingBottom: THEME.space.xs }}>
                {TIERS.map((t) => (
                  <View key={t.name} style={{ width: 132, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.md, ...THEME.shadow.sm }}>
                    <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: t.color + '22', alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.sm }}>
                      <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
                    </View>
                    <Text style={{ ...THEME.font.h3, color: t.color }}>{t.name}</Text>
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Desde {t.min} pts</Text>
                  </View>
                ))}
              </ScrollView>
            </FadeInUp>

            {/* Check points */}
            <FadeInUp delay={120}>
              <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginTop: THEME.space.md, ...THEME.shadow.sm }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.xs }}>Consulta tus puntos</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginBottom: THEME.space.md }}>Ingresa el WhatsApp con el que solicitas servicios</Text>
                <TextInput
                  placeholder="999 888 777"
                  value={wa}
                  onChangeText={setWa}
                  keyboardType="phone-pad"
                  style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: THEME.space.lg, ...THEME.font.h3, marginBottom: THEME.space.md, textAlign: 'center', color: THEME.color.ink }}
                  placeholderTextColor={THEME.color.inkMuted}
                />
                <PressableScale
                  onPress={loadPoints}
                  disabled={loading}
                  accessibilityLabel="Ver mis puntos"
                  style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.sm, ...THEME.shadow.brand }}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>{loading ? 'Consultando…' : 'Ver mis puntos'}</Text>
                  {!loading && <Ionicons name="arrow-forward" size={18} color={THEME.color.white} />}
                </PressableScale>
              </View>
            </FadeInUp>

            {/* Preview rewards */}
            <FadeInUp delay={180}>
              <View style={{ marginTop: THEME.space.lg }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.sm }}>Recompensas disponibles</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: THEME.space.sm }}>
                  {REWARDS.map((r) => (
                    <View key={r.pts} style={{ width: 150, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.md, ...THEME.shadow.sm }}>
                      <Text style={{ fontSize: 30, marginBottom: THEME.space.xs }}>{r.emoji}</Text>
                      <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>{r.label}</Text>
                      <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>{r.desc}</Text>
                      <View style={{ backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 3, marginTop: THEME.space.sm, alignSelf: 'flex-start' }}>
                        <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.brand }}>{r.pts} pts</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </FadeInUp>
          </>
        ) : (
          <>
            {/* Points + tier display */}
            <FadeInUp delay={0}>
              <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xl, alignItems: 'center', marginBottom: THEME.space.md, ...THEME.shadow.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: tier!.current.color + '1F', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs, marginBottom: THEME.space.md }}>
                  <Text style={{ fontSize: 15 }}>{tier!.current.emoji}</Text>
                  <Text style={{ ...THEME.font.label, fontWeight: '800', color: tier!.current.color }}>Nivel {tier!.current.name}</Text>
                </View>
                <Text style={{ ...THEME.font.display, fontSize: 54, color: THEME.color.brand }}>{points}</Text>
                <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, fontWeight: '600' }}>puntos acumulados</Text>

                {/* Progress to next tier */}
                <View style={{ width: '100%', marginTop: THEME.space.lg }}>
                  <View style={{ height: 10, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, overflow: 'hidden' }}>
                    <View style={{ width: `${progressPct}%`, height: '100%', borderRadius: THEME.radius.full, backgroundColor: tier!.next?.color ?? THEME.color.platino }} />
                  </View>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.sm, textAlign: 'center' }}>
                    {tier!.next
                      ? `Te faltan ${tier!.next.min - points} pts para nivel ${tier!.next.name}`
                      : '¡Estás en el nivel máximo, Platino! 🏆'}
                  </Text>
                </View>
              </View>
            </FadeInUp>

            {/* Rewards - Claimable */}
            <FadeInUp delay={60}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.sm }}>Canjear recompensa</Text>
              {REWARDS.map((r) => {
                const canClaim = points >= r.pts
                return (
                  <PressableScale
                    key={r.pts}
                    onPress={() => canClaim && claimReward(r)}
                    disabled={!canClaim}
                    accessibilityLabel={`Canjear ${r.label}`}
                    haptic={canClaim}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
                      backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.md, marginBottom: THEME.space.sm,
                      opacity: canClaim ? 1 : 0.65,
                      ...(canClaim ? THEME.shadow.md : THEME.shadow.sm),
                    }}
                  >
                    <Text style={{ fontSize: 30 }}>{r.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...THEME.font.body, fontWeight: '700', color: THEME.color.ink }}>{r.label}</Text>
                      <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{r.desc}</Text>
                    </View>
                    {canClaim ? (
                      <View style={{ backgroundColor: THEME.color.success, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs + 2 }}>
                        <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.white }}>Canjear</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: THEME.color.surfaceSunken, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs + 2 }}>
                        <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkMuted }}>{r.pts - points} pts más</Text>
                      </View>
                    )}
                  </PressableScale>
                )
              })}
            </FadeInUp>

            {/* History */}
            {history.length > 0 && (
              <FadeInUp delay={120}>
                <View style={{ marginTop: THEME.space.sm }}>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.sm }}>Historial de puntos</Text>
                  {history.slice(0, 15).map((h, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: THEME.color.surface, borderRadius: THEME.radius.md, padding: THEME.space.md, marginBottom: THEME.space.xs + 2, ...THEME.shadow.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...THEME.font.bodySm, fontWeight: '600', color: THEME.color.ink }}>{h.type}</Text>
                        <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>{h.date}</Text>
                      </View>
                      <Text style={{ ...THEME.font.h3, color: THEME.color.success }}>+{h.pts}</Text>
                    </View>
                  ))}
                </View>
              </FadeInUp>
            )}

            {history.length === 0 && (
              <FadeInUp delay={120}>
                <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.xl, alignItems: 'center', marginTop: THEME.space.sm, ...THEME.shadow.sm }}>
                  <View style={{ width: 64, height: 64, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.md }}>
                    <Ionicons name="time-outline" size={30} color={THEME.color.brand} />
                  </View>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Aún no tienes actividad</Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs, lineHeight: 19 }}>
                    Solicita tu primer servicio para empezar a acumular puntos
                  </Text>
                </View>
              </FadeInUp>
            )}

            {/* Reset */}
            <PressableScale
              onPress={() => { setPoints(null); setHistory([]); setWa('') }}
              haptic={false}
              accessibilityLabel="Consultar con otro número"
              style={{ alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.lg, minHeight: 44 }}
            >
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkMuted }}>Consultar con otro número</Text>
            </PressableScale>
          </>
        )}
      </View>
    </ScrollView>
  )
}
