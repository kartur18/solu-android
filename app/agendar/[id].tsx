import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { ENV, fetchWithTimeout } from '../../src/lib/env'
import { supabase } from '../../src/lib/supabase'
import { AvailabilityPicker } from '../../src/components/AvailabilityPicker'

export default function AgendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [selectedTime, setSelectedTime] = useState<{ fecha: string; horaInicio: string; horaFin: string } | null>(null)
  const [booked, setBooked] = useState(false)
  const [booking, setBooking] = useState(false)
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

  function handleTimeSelect(fecha: string, horaInicio: string, horaFin: string) {
    setSelectedTime({ fecha, horaInicio, horaFin })
  }

  async function confirmBooking() {
    if (!selectedTime) return
    setBooking(true)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tecnicoId: techId,
          fecha: selectedTime.fecha,
          horaInicio: selectedTime.horaInicio,
          horaFin: selectedTime.horaFin,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBooked(true)
        Alert.alert(
          'Cita agendada',
          `Tu cita fue confirmada para el ${selectedTime.fecha} de ${selectedTime.horaInicio} a ${selectedTime.horaFin}.\n\nPagarás al técnico directamente cuando llegue (Yape, Plin o efectivo).`,
          [{ text: 'OK', onPress: () => router.back() }]
        )
      } else {
        Alert.alert('Error', data.error || 'No se pudo agendar')
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Agendar servicio</Text>
        <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Elige el mejor horario para ti</Text>

        {/* Step 1: Select time */}
        <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: selectedTime ? COLORS.acc : COLORS.pri, alignItems: 'center', justifyContent: 'center' }}>
              {selectedTime ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 12 }}>1</Text>}
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark }}>Selecciona fecha y hora</Text>
          </View>
          <AvailabilityPicker tecnicoId={parseInt(id)} onSelect={handleTimeSelect} />
        </View>

        {/* Step 2: Payment method (only after time selected) */}
        {selectedTime && !booked && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.pri, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 12 }}>2</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark }}>Método de pago</Text>
            </View>
            <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>💳</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Pagas al técnico directo</Text>
              <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginBottom: 16 }}>
                S/{precio} — Yape, Plin o efectivo. Coordinas con el técnico el método cuando llegue.
              </Text>
              <TouchableOpacity
                onPress={confirmBooking}
                disabled={booking}
                style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center', width: '100%' }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 15 }}>
                  {booking ? 'Agendando...' : 'Confirmar cita'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Success state */}
        {booked && (
          <View style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark, marginTop: 8 }}>Cita confirmada</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>
              {selectedTime?.fecha} de {selectedTime?.horaInicio} a {selectedTime?.horaFin}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
