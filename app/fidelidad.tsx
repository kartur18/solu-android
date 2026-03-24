import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'

const REWARDS = [
  { pts: 50, label: '10% descuento', emoji: '🎟️' },
  { pts: 100, label: '20% descuento', emoji: '🎫' },
  { pts: 200, label: 'Servicio gratis', emoji: '🎁' },
  { pts: 500, label: 'VIP SOLU', emoji: '👑' },
]

export default function FidelidadScreen() {
  const [wa, setWa] = useState('')
  const [loading, setLoading] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  const [history, setHistory] = useState<{ type: string; pts: number; date: string }[]>([])

  async function loadPoints() {
    if (!wa.trim()) return Alert.alert('Error', 'Ingresa tu WhatsApp')
    setLoading(true)

    // Count services as client
    const { data: services } = await supabase
      .from('clientes')
      .select('id, created_at, servicio')
      .eq('whatsapp', wa)
      .eq('estado', 'Completado')

    // Count reviews
    const { data: reviews } = await supabase
      .from('resenas')
      .select('id, created_at')
      .eq('whatsapp_cliente', wa)

    const svcPts = (services?.length || 0) * 10
    const revPts = (reviews?.length || 0) * 5
    setPoints(svcPts + revPts)

    const hist: { type: string; pts: number; date: string }[] = []
    services?.forEach(s => hist.push({ type: `Servicio: ${s.servicio}`, pts: 10, date: s.created_at.split('T')[0] }))
    reviews?.forEach(r => hist.push({ type: 'Reseña enviada', pts: 5, date: r.created_at.split('T')[0] }))
    hist.sort((a, b) => b.date.localeCompare(a.date))
    setHistory(hist)
    setLoading(false)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* Header */}
      <View style={{ backgroundColor: '#FFD700', padding: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#1A1A2E' }}>Programa de Fidelidad</Text>
        <Text style={{ fontSize: 13, color: '#1A1A2E', opacity: 0.7, marginTop: 4 }}>
          Acumula puntos y gana recompensas
        </Text>
      </View>

      <View style={{ padding: 20 }}>
        {points === null ? (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Consulta tus puntos</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 16 }}>Ingresa el WhatsApp con el que solicitas servicios</Text>
            <TextInput
              placeholder="Tu WhatsApp: 999 888 777"
              value={wa}
              onChangeText={setWa}
              keyboardType="phone-pad"
              style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, textAlign: 'center' }}
              placeholderTextColor={COLORS.gray2}
            />
            <TouchableOpacity
              onPress={loadPoints}
              disabled={loading}
              style={{ backgroundColor: COLORS.pri, borderRadius: 12, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 15 }}>{loading ? 'Consultando...' : 'Ver mis puntos'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Points display */}
            <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 48, fontWeight: '900', color: COLORS.pri }}>{points}</Text>
              <Text style={{ fontSize: 14, color: COLORS.gray, fontWeight: '600' }}>puntos acumulados</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 4 }}>10 pts/servicio · 5 pts/reseña</Text>
            </View>

            {/* Rewards */}
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Recompensas</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {REWARDS.map((r) => (
                <View key={r.pts} style={{
                  width: '48%', backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
                  borderWidth: 2, borderColor: points >= r.pts ? COLORS.acc : COLORS.border,
                  opacity: points >= r.pts ? 1 : 0.5,
                }}>
                  <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginTop: 4 }}>{r.label}</Text>
                  <Text style={{ fontSize: 11, color: points >= r.pts ? COLORS.acc : COLORS.gray2 }}>
                    {points >= r.pts ? 'Disponible' : `${r.pts - points} pts más`}
                  </Text>
                </View>
              ))}
            </View>

            {/* History */}
            {history.length > 0 && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Historial</Text>
                {history.slice(0, 10).map((h, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark }}>{h.type}</Text>
                      <Text style={{ fontSize: 11, color: COLORS.gray2 }}>{h.date}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.acc }}>+{h.pts}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}
