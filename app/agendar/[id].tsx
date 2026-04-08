import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { ENV, fetchWithTimeout } from '../../src/lib/env'
import { supabase } from '../../src/lib/supabase'
import { AvailabilityPicker } from '../../src/components/AvailabilityPicker'
import { YapeQR } from '../../src/components/YapeQR'
import { PlinQR } from '../../src/components/PlinQR'

export default function AgendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [selectedTime, setSelectedTime] = useState<{ fecha: string; horaInicio: string; horaFin: string } | null>(null)
  const [selectedPay, setSelectedPay] = useState('yape')
  const [booked, setBooked] = useState(false)
  const [booking, setBooking] = useState(false)
  const [precio, setPrecio] = useState(60)
  const referenceRef = useRef(`SOLU-${id}-${Date.now().toString(36).toUpperCase()}`)

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
          metodo_pago: selectedPay,
          referencia_pago: referenceRef.current,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBooked(true)
        Alert.alert(
          'Cita agendada',
          `Tu cita fue confirmada para el ${selectedTime.fecha} de ${selectedTime.horaInicio} a ${selectedTime.horaFin}.\n\n${selectedPay === 'efectivo' ? 'Pagarás al técnico directamente.' : 'Recuerda enviar el comprobante de pago.'}`,
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
              <YapeQR amount={precio} reference={referenceRef.current} onConfirm={confirmBooking} />
            )}
            {selectedPay === 'plin' && (
              <PlinQR amount={precio} reference={referenceRef.current} onConfirm={confirmBooking} />
            )}
            {selectedPay === 'efectivo' && (
              <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>💵</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Pago en efectivo</Text>
                <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginBottom: 16 }}>
                  Pagarás S/{precio} directamente al técnico cuando llegue.
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
            )}
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
