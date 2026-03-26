import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink, SUPPORT_PHONE, ESTADOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'

const REWARDS = [
  { pts: 50, label: '10% de descuento', desc: 'En tu próximo servicio', emoji: '🎟️', code: 'SOLU10' },
  { pts: 100, label: '20% de descuento', desc: 'En cualquier servicio', emoji: '🎫', code: 'SOLU20' },
  { pts: 200, label: 'Servicio gratis', desc: 'Un servicio básico gratis', emoji: '🎁', code: 'SOLUGRATIS' },
  { pts: 500, label: 'Cliente VIP', desc: 'Prioridad + descuentos permanentes', emoji: '👑', code: 'SOLUVIP' },
]

const HOW_TO_EARN = [
  { action: 'Solicitar un servicio', pts: 10, icon: 'build' as const },
  { action: 'Completar un servicio', pts: 15, icon: 'checkmark-circle' as const },
  { action: 'Dejar una reseña', pts: 5, icon: 'star' as const },
  { action: 'Referir un amigo', pts: 20, icon: 'people' as const },
  { action: 'Primera solicitud', pts: 25, icon: 'gift' as const },
]

export default function FidelidadScreen() {
  const [wa, setWa] = useState('')
  const [loading, setLoading] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [history, setHistory] = useState<{ type: string; pts: number; date: string }[]>([])
  const [selectedReward, setSelectedReward] = useState<typeof REWARDS[0] | null>(null)

  async function loadPoints() {
    const waClean = wa.replace(/\D/g, '')
    if (!waClean || waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) return Alert.alert('Error', 'Ingresa un WhatsApp válido (9 dígitos, empieza con 9)')
    setLoading(true)
    try {
      // Count completed services as client
      const { data: services } = await supabase
        .from('clientes')
        .select('id, created_at, servicio, estado')
        .eq('whatsapp', wa)

      // Count reviews
      const { data: reviews } = await supabase
        .from('resenas')
        .select('id, created_at')
        .eq('whatsapp_cliente', wa)

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
      Alert.alert('Error', 'No se pudieron cargar los puntos')
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
            Linking.openURL(waLink(SUPPORT_PHONE, msg))
          },
        },
      ]
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1E3A5F', padding: 24, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>Programa de Fidelidad</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
          Acumula puntos con cada servicio y canjea descuentos
        </Text>
      </View>

      <View style={{ padding: 16 }}>
        {points === null ? (
          <>
            {/* How it works */}
            <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>¿Cómo funciona?</Text>
              {HOW_TO_EARN.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i < HOW_TO_EARN.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.pri + '12', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon} size={18} color={COLORS.pri} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.dark }}>{item.action}</Text>
                  <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.blue }}>+{item.pts}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Check points */}
            <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Consulta tus puntos</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 14 }}>Ingresa el WhatsApp con el que solicitas servicios</Text>
              <TextInput
                placeholder="999 888 777"
                value={wa}
                onChangeText={setWa}
                keyboardType="phone-pad"
                style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, textAlign: 'center', fontWeight: '600' }}
                placeholderTextColor={COLORS.gray2}
              />
              <TouchableOpacity
                onPress={loadPoints}
                disabled={loading}
                style={{ backgroundColor: '#1E3A5F', borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{loading ? 'Consultando...' : 'Ver mis puntos →'}</Text>
              </TouchableOpacity>
            </View>

            {/* Preview rewards */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Recompensas disponibles</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {REWARDS.map((r) => (
                  <View key={r.pts} style={{ width: 140, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginRight: 8 }}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>{r.emoji}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark }}>{r.label}</Text>
                    <Text style={{ fontSize: 10, color: COLORS.gray, marginTop: 2 }}>{r.desc}</Text>
                    <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.blue }}>{r.pts} pts</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        ) : (
          <>
            {/* Points display */}
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 52, fontWeight: '900', color: '#1E3A5F' }}>{points}</Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, fontWeight: '600' }}>puntos acumulados</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.green }}>+10 pts/solicitud</Text>
                </View>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.green }}>+15 pts/completado</Text>
                </View>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.green }}>+5 pts/reseña</Text>
                </View>
              </View>
            </View>

            {/* Rewards - Claimable */}
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Canjear recompensa</Text>
            {REWARDS.map((r) => {
              const canClaim = points >= r.pts
              return (
                <TouchableOpacity
                  key={r.pts}
                  onPress={() => canClaim && claimReward(r)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
                    borderWidth: 2, borderColor: canClaim ? COLORS.green : '#E2E8F0',
                    opacity: canClaim ? 1 : 0.6,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{r.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{r.label}</Text>
                    <Text style={{ fontSize: 10, color: COLORS.gray }}>{r.desc}</Text>
                  </View>
                  {canClaim ? (
                    <View style={{ backgroundColor: COLORS.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Canjear</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.gray2 }}>{r.pts - points} pts más</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}

            {/* History */}
            {history.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Historial de puntos</Text>
                {history.slice(0, 15).map((h, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark }}>{h.type}</Text>
                      <Text style={{ fontSize: 10, color: COLORS.gray2 }}>{h.date}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.green }}>+{h.pts}</Text>
                  </View>
                ))}
              </View>
            )}

            {history.length === 0 && (
              <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="time-outline" size={32} color={COLORS.gray2} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark, marginTop: 8 }}>Aún no tienes actividad</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>
                  Solicita tu primer servicio para empezar a acumular puntos
                </Text>
              </View>
            )}

            {/* Reset */}
            <TouchableOpacity
              onPress={() => { setPoints(null); setHistory([]); setWa('') }}
              style={{ alignItems: 'center', marginTop: 16 }}
            >
              <Text style={{ color: COLORS.gray2, fontSize: 12 }}>Consultar con otro número</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  )
}
