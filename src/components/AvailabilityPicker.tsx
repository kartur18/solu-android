import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { COLORS } from '../lib/constants'
import { ENV } from '../lib/env'

type Props = {
  tecnicoId: number
  onSelect: (fecha: string, horaInicio: string, horaFin: string) => void
}

type TimeSlot = {
  start: string
  end: string
  label: string
  available: boolean
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DEFAULT_SLOTS: TimeSlot[] = [
  { start: '08:00', end: '10:00', label: '8-10 AM', available: true },
  { start: '10:00', end: '12:00', label: '10-12 PM', available: true },
  { start: '12:00', end: '14:00', label: '12-2 PM', available: true },
  { start: '14:00', end: '16:00', label: '2-4 PM', available: true },
  { start: '16:00', end: '18:00', label: '4-6 PM', available: true },
  { start: '18:00', end: '20:00', label: '6-8 PM', available: true },
]

function getNextDays(count: number) {
  const days = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      label: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DAYS[d.getDay()]} ${d.getDate()}`,
      dateStr: d.toISOString().split('T')[0],
    })
  }
  return days
}

export function AvailabilityPicker({ tecnicoId, onSelect }: Props) {
  const days = getNextDays(7)
  const [selectedDate, setSelectedDate] = useState(days[0].dateStr)
  const [slots, setSlots] = useState<TimeSlot[]>(DEFAULT_SLOTS)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadAvailability() {
      setLoading(true)
      try {
        const res = await fetch(`${ENV.API_BASE_URL}/appointments?tecnicoId=${tecnicoId}&date=${selectedDate}`)
        if (cancelled) return
        const data = await res.json()
        if (cancelled) return
        const booked = data.appointments || []
        setSlots(DEFAULT_SLOTS.map(slot => ({
          ...slot,
          available: !booked.some((b: any) => b.hora_inicio < slot.end && b.hora_fin > slot.start),
        })))
      } catch {
        if (!cancelled) setSlots(DEFAULT_SLOTS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAvailability()
    return () => { cancelled = true }
  }, [tecnicoId, selectedDate])

  return (
    <View>
      {/* Date picker */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {days.slice(0, 5).map((d) => (
          <TouchableOpacity
            key={d.dateStr}
            onPress={() => { setSelectedDate(d.dateStr); setSelectedSlot(null) }}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
              backgroundColor: selectedDate === d.dateStr ? COLORS.pri : COLORS.white,
              borderWidth: 1, borderColor: selectedDate === d.dateStr ? COLORS.pri : COLORS.border,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: selectedDate === d.dateStr ? COLORS.white : COLORS.gray }}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time slots */}
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.pri} style={{ marginVertical: 20 }} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {slots.map((slot) => (
            <TouchableOpacity
              key={slot.start}
              disabled={!slot.available}
              onPress={() => setSelectedSlot(slot)}
              style={{
                width: '31%', paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: !slot.available ? COLORS.light : selectedSlot?.start === slot.start ? COLORS.acc : COLORS.white,
                borderWidth: 1,
                borderColor: !slot.available ? COLORS.border : selectedSlot?.start === slot.start ? COLORS.acc : COLORS.border,
                opacity: slot.available ? 1 : 0.4,
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: '600',
                color: !slot.available ? COLORS.gray2 : selectedSlot?.start === slot.start ? COLORS.white : COLORS.dark,
              }}>
                {slot.label}
              </Text>
              {!slot.available && <Text style={{ fontSize: 8, color: COLORS.gray2 }}>Ocupado</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedSlot && (
        <TouchableOpacity
          onPress={() => onSelect(selectedDate, selectedSlot.start, selectedSlot.end)}
          style={{ backgroundColor: COLORS.acc, borderRadius: 14, padding: 14, alignItems: 'center' }}
        >
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>
            Confirmar {selectedSlot.label} →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
