import { useState } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { AvailabilityPicker } from '../../src/components/AvailabilityPicker'
import { YapeQR } from '../../src/components/YapeQR'

export default function AgendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [selectedTime, setSelectedTime] = useState<{ fecha: string; horaInicio: string; horaFin: string } | null>(null)
  const [showYape, setShowYape] = useState(false)
  const [booked, setBooked] = useState(false)

  async function handleTimeSelect(fecha: string, horaInicio: string, horaFin: string) {
    setSelectedTime({ fecha, horaInicio, horaFin })

    // Create appointment
    try {
      const res = await fetch('https://solu.pe/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tecnicoId: parseInt(id),
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { key: 'yape', icon: '💜', name: 'Yape' },
                { key: 'plin', icon: '💚', name: 'Plin' },
                { key: 'efectivo', icon: '💵', name: 'Efectivo' },
              ].map((m) => (
                <View
                  key={m.key}
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.white,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: showYape && m.key === 'yape' ? '#6C2EB9' : COLORS.border,
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.dark }}>{m.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
