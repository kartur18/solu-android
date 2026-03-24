import { useState, useEffect } from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'

const STEPS = [
  { key: 'Nuevo', label: 'Solicitud registrada', icon: 'document-text' as const },
  { key: 'Asignado', label: 'Técnico asignado', icon: 'person' as const },
  { key: 'En camino', label: 'Técnico en camino', icon: 'car' as const },
  { key: 'En proceso', label: 'Trabajo en proceso', icon: 'hammer' as const },
  { key: 'Completado', label: 'Servicio completado', icon: 'checkmark-circle' as const },
]

export default function TrackingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const [service, setService] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('codigo', code)
        .single()
      setService(data)
      setLoading(false)
    }
    load()
  }, [code])

  // Supabase Realtime: live status updates
  useEffect(() => {
    if (!service?.id) return
    const channel = supabase
      .channel(`tracking-${service.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'clientes',
        filter: `id=eq.${service.id}`,
      }, (payload: any) => {
        setService((prev: any) => ({ ...prev, ...payload.new }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [service?.id])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.pri} /></View>
  if (!service) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}><Ionicons name="alert-circle-outline" size={48} color={COLORS.gray2} /><Text style={{ color: COLORS.gray, marginTop: 8 }}>Servicio no encontrado</Text></View>

  const currentIdx = STEPS.findIndex(s => s.key === service.estado)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.white, padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Text style={{ fontSize: 12, color: COLORS.gray }}>Código de seguimiento</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.pri }}>{service.codigo}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View>
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>Servicio</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{service.servicio}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>Distrito</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{service.distrito}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>Urgencia</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: service.urgencia === 'emergencia' ? COLORS.red : service.urgencia === 'urgente' ? COLORS.yellow : COLORS.green }}>{service.urgencia}</Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 20 }}>Estado del servicio</Text>
        {STEPS.map((step, i) => {
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <View key={step.key} style={{ flexDirection: 'row', gap: 14, marginBottom: i < STEPS.length - 1 ? 0 : 0 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: done ? COLORS.pri : COLORS.border,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: active ? 3 : 0, borderColor: COLORS.priLight,
                }}>
                  <Ionicons name={step.icon} size={16} color={done ? COLORS.white : COLORS.gray2} />
                </View>
                {i < STEPS.length - 1 && (
                  <View style={{ width: 2, height: 32, backgroundColor: i < currentIdx ? COLORS.pri : COLORS.border }} />
                )}
              </View>
              <View style={{ flex: 1, paddingTop: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: done ? COLORS.dark : COLORS.gray2 }}>
                  {step.label}
                </Text>
                {active && (
                  <Text style={{ fontSize: 12, color: COLORS.pri, marginTop: 2 }}>Estado actual</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>

      {service.descripcion && (
        <View style={{ padding: 20, paddingTop: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Descripción</Text>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontSize: 13, color: COLORS.gray, lineHeight: 20 }}>{service.descripcion}</Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}
