import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ENV, fetchWithTimeout } from '../../src/lib/env'
import { supabase } from '../../src/lib/supabase'
import { AvailabilityPicker } from '../../src/components/AvailabilityPicker'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../../src/components/ui/Motion'

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxl, backgroundColor: THEME.color.surfaceAlt }}>
        <View style={{ width: 72, height: 72, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
          <Ionicons name="search-outline" size={32} color={THEME.color.inkMuted} />
        </View>
        <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>No encontramos a este técnico</Text>
        <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center', lineHeight: 20 }}>
          Vuelve atrás y elige otro técnico disponible.
        </Text>
        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Volver"
          style={{ marginTop: THEME.space.xl, height: 52, paddingHorizontal: THEME.space.xxl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Volver</Text>
        </PressableScale>
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
        haptics.success()
        setBooked(true)
      } else {
        Alert.alert('No se pudo agendar', data.error || 'Ese horario ya no está disponible. Elige otro e intenta de nuevo.')
      }
    } catch {
      Alert.alert('Sin conexión', 'Revisa tu internet e intenta de nuevo. Tu selección no se perdió.')
    } finally {
      setBooking(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ padding: THEME.space.xl }}>
        {/* Encabezado */}
        <FadeInUp delay={0}>
          <View style={{ marginBottom: THEME.space.xl }}>
            <Text style={{ ...THEME.font.display, color: THEME.color.ink }}>Agendar servicio</Text>
            <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.xs }}>Elige el mejor horario para ti</Text>
          </View>
        </FadeInUp>

        {/* Paso 1: seleccionar horario */}
        <FadeInUp delay={60}>
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.xl, ...THEME.shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
              <View style={{ width: 28, height: 28, borderRadius: THEME.radius.full, backgroundColor: selectedTime ? THEME.color.success : THEME.color.brand, alignItems: 'center', justifyContent: 'center' }}>
                {selectedTime ? <Ionicons name="checkmark" size={16} color={THEME.color.white} /> : <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.white }}>1</Text>}
              </View>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Selecciona fecha y hora</Text>
            </View>
            <AvailabilityPicker tecnicoId={parseInt(id)} onSelect={handleTimeSelect} />
          </View>
        </FadeInUp>

        {/* Paso 2: método de pago (tras elegir horario) */}
        {selectedTime && !booked && (
          <FadeInUp delay={0}>
            <View style={{ marginBottom: THEME.space.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
                <View style={{ width: 28, height: 28, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.white }}>2</Text>
                </View>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Confirma tu cita</Text>
              </View>

              {/* Resumen de la selección */}
              <View style={{ backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
                <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar" size={22} color={THEME.color.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft }}>Tu horario</Text>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: 1 }}>{selectedTime.fecha}</Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark }}>{selectedTime.horaInicio} a {selectedTime.horaFin}</Text>
                </View>
              </View>

              {/* Pago directo */}
              <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xl, alignItems: 'center', ...THEME.shadow.sm }}>
                <View style={{ width: 56, height: 56, borderRadius: THEME.radius.full, backgroundColor: THEME.color.infoBg, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.md }}>
                  <Ionicons name="wallet" size={26} color={THEME.color.info} />
                </View>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.xs }}>Pagas al técnico directo</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', lineHeight: 19, marginBottom: THEME.space.lg }}>
                  Desde S/{precio} — le pagas con Yape, Plin, efectivo o tarjeta cuando llegue. No pagas comisión por agendar.
                </Text>
                <PressableScale
                  onPress={confirmBooking}
                  disabled={booking}
                  accessibilityLabel="Confirmar cita"
                  style={{ width: '100%', height: 52, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
                >
                  {booking ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                      <ActivityIndicator color={THEME.color.white} />
                      <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Agendando...</Text>
                    </View>
                  ) : (
                    <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Confirmar cita</Text>
                  )}
                </PressableScale>
              </View>
            </View>
          </FadeInUp>
        )}

        {/* Estado de éxito */}
        {booked && (
          <FadeInUp delay={0}>
            <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xxl, alignItems: 'center', ...THEME.shadow.md }}>
              <View style={{ width: 80, height: 80, borderRadius: THEME.radius.full, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.md }}>
                <Ionicons name="checkmark-circle" size={52} color={THEME.color.success} />
              </View>
              <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>¡Cita confirmada!</Text>
              <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs }}>
                {selectedTime?.fecha} de {selectedTime?.horaInicio} a {selectedTime?.horaFin}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: THEME.space.sm, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, padding: THEME.space.md, marginTop: THEME.space.lg }}>
                <Ionicons name="wallet-outline" size={18} color={THEME.color.success} />
                <Text style={{ ...THEME.font.bodySm, color: '#15803D', flex: 1, lineHeight: 19 }}>
                  Pagarás directo al técnico cuando llegue: Yape, Plin, efectivo o tarjeta.
                </Text>
              </View>
              <PressableScale
                onPress={() => router.back()}
                accessibilityLabel="Volver"
                style={{ marginTop: THEME.space.xl, height: 52, paddingHorizontal: THEME.space.xxxl, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.xs }}
              >
                <Ionicons name="home" size={18} color={THEME.color.ink} />
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Volver al inicio</Text>
              </PressableScale>
            </View>
          </FadeInUp>
        )}
      </View>
    </ScrollView>
  )
}
