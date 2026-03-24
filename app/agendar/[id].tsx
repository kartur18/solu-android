import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { COLORS } from '../../src/lib/constants'
import { ENV } from '../../src/lib/env'
import { supabase } from '../../src/lib/supabase'
import { AvailabilityPicker } from '../../src/components/AvailabilityPicker'
import { YapeQR } from '../../src/components/YapeQR'

export default function AgendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [selectedTime, setSelectedTime] = useState<{ fecha: string; horaInicio: string; horaFin: string } | null>(null)
  const [showYape, setShowYape] = useState(false)
  const [selectedPay, setSelectedPay] = useState('yape')
  const [booked, setBooked] = useState(false)
  const [precio, setPrecio] = useState(60)

  const techId = parseInt(id as string)
  useEffect(() => {
    if (!isNaN(techId)) {
      supabase.from('tecnicos').select('precio_desde').eq('id', techId).single()
        .then(({ data }) => { if (data?.precio_desde) setPrecio(data.precio_desde) })
    }
  }, [techId])

  if (!id || isNaN(techId)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: COLORS.gray }}>Técnico no encontrado</Text>
      </View>
    )
  }

  async function handleTimeSelect(fecha: string, horaInicio: string, horaFin: string) {
    setSelectedTime({ fecha, horaInicio, horaFin })

    // Create appointment
    try {
      const res = await fetch(`${ENV.API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tecnicoId: techId,
          fecha,
          horaInicio,
          horaFin,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBooked(true)
        Alert.alert(
          '¡Cita agendada!',
          `Tu cita fue confirmada para el ${fecha} de ${horaInicio} a ${horaFin}`,
          [{ text: 'OK', onPress: () => router.back() }]
        )
      } else {
        Alert.alert('Error', data.error || 'No se pudo agendar')
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Agendar servicio</Text>
        <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Elige el mejor horario para ti</Text>

        <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 12 }}>Selecciona fecha y hora</Text>
          <AvailabilityPicker tecnicoId={parseInt(id)} onSelect={handleTimeSelect} />
        </View>

        {/* Payment option */}
        {!booked && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 12 }}>Método de pago</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {[
                { key: 'yape', icon: '💜', name: 'Yape' },
                { key: 'plin', icon: '💚', name: 'Plin' },
                { key: 'efectivo', icon: '💵', name: 'Efectivo' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setSelectedPay(m.key)}
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: selectedPay === m.key ? (m.key === 'yape' ? '#6C2EB9' : m.key === 'plin' ? '#10B981' : COLORS.pri) : COLORS.border,
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.dark }}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedPay === 'yape' && (
              <YapeQR amount={precio} reference={`SOLU-${techId}-${Date.now().toString(36).toUpperCase()}`} />
            )}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
