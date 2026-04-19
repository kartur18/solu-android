import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Linking, RefreshControl, Alert, Share } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink, SUPPORT_PHONE } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import type { Cliente, Tecnico } from '../../src/lib/types'
import { track } from '../../src/lib/analytics'

const STEPS = [
  { key: 'Nuevo', label: 'Solicitud registrada', icon: 'document-text' as const, desc: 'Tu solicitud fue recibida' },
  { key: 'Asignado', label: 'Técnico asignado', icon: 'person' as const, desc: 'Un técnico aceptó tu solicitud' },
  { key: 'En camino', label: 'Técnico en camino', icon: 'car' as const, desc: 'El técnico se dirige a tu ubicación' },
  { key: 'En proceso', label: 'Trabajo en proceso', icon: 'hammer' as const, desc: 'El técnico está trabajando' },
  { key: 'Completado', label: 'Servicio completado', icon: 'checkmark-circle' as const, desc: '¡Servicio finalizado!' },
]

export default function TrackingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const router = useRouter()
  const [service, setService] = useState<Cliente | null>(null)
  const [tech, setTech] = useState<Pick<Tecnico, 'id' | 'nombre' | 'whatsapp' | 'oficio' | 'foto_url' | 'calificacion'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('codigo', code)
      .single()
    setService(data)

    if (data?.tecnico_asignado) {
      const { data: techData } = await supabase
        .from('tecnicos')
        .select('id, nombre, whatsapp, oficio, foto_url, calificacion')
        .eq('id', data.tecnico_asignado)
        .single()
      setTech(techData)
    }
  }, [code])

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  // Supabase Realtime: live status updates with reconnection logic
  const retryDelayRef = useRef(1000)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!service?.id) return

    let cancelled = false
    let currentChannel: ReturnType<typeof supabase.channel> | null = null

    function subscribe() {
      if (cancelled) return

      const channel = supabase
        .channel(`tracking-${service!.id}-${Date.now()}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'clientes',
          filter: `id=eq.${service!.id}`,
        }, (payload) => {
          setService((prev) => prev ? { ...prev, ...payload.new as Partial<Cliente> } : prev)
        })
        .subscribe((status: string) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            retryDelayRef.current = 1000 // reset backoff on success
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (__DEV__) console.warn('Realtime channel disconnected, retrying in', retryDelayRef.current, 'ms')
            // Remove the failed channel and retry with exponential backoff
            supabase.removeChannel(channel)
            currentChannel = null
            retryTimerRef.current = setTimeout(() => {
              retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000)
              subscribe()
            }, retryDelayRef.current)
          }
        })

      currentChannel = channel
    }

    subscribe()

    return () => {
      cancelled = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (currentChannel) supabase.removeChannel(currentChannel)
    }
  }, [service?.id])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.pri} /></View>
  if (!service) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray2} />
      <Text style={{ color: COLORS.gray, marginTop: 8, fontSize: 14 }}>Servicio no encontrado</Text>
      <Text style={{ color: COLORS.gray2, marginTop: 4, fontSize: 12 }}>Verifica que el código sea correcto</Text>
    </View>
  )

  const currentIdx = STEPS.findIndex(s => s.key === service.estado)
  const isCompleted = service.estado === 'Completado'
  const canCancel = service.estado === 'Nuevo' || service.estado === 'Asignado'

  async function handleCancel() {
    const snapshot = service
    if (!snapshot) return
    Alert.alert(
      '¿Cancelar servicio?',
      'El técnico será notificado y tu solicitud quedará archivada. Esta acción no se puede deshacer.',
      [
        { text: 'No, mantener', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clientes')
              .update({ estado: 'Cancelado' })
              .eq('id', snapshot.id)
            if (error) {
              Alert.alert('Error', 'No se pudo cancelar. Intenta de nuevo.')
              return
            }
            track('Service Cancelled', { codigo: snapshot.codigo, estado_previo: snapshot.estado })
            if (tech) {
              supabase.from('notificaciones').insert({
                tecnico_id: tech.id,
                tipo: 'cancelacion',
                titulo: 'Solicitud cancelada',
                mensaje: `El cliente canceló la solicitud ${snapshot.codigo}`,
                leido: false,
              }).then(() => {})
            }
            setService({ ...snapshot, estado: 'Cancelado' })
          },
        },
      ]
    )
  }

  async function shareReferral() {
    const snapshot = service
    if (!snapshot) return
    try {
      await Share.share({
        message: `Acabo de usar SOLU y me resolvieron un problema de ${snapshot.servicio} rapidísimo 🔧\n\nDescarga la app y pide tu servicio: https://solu.pe`,
      })
      track('Referral Shared', { codigo: snapshot.codigo })
    } catch {}
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.light }}>
    <OfflineBanner />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.pri]} tintColor={COLORS.pri} />}>
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
            <Text style={{ fontSize: 13, fontWeight: '700', color: service.urgencia === 'emergencia' ? '#EF4444' : service.urgencia === 'urgente' ? '#F59E0B' : '#10B981' }}>{service.urgencia}</Text>
          </View>
        </View>
      </View>

      {/* Assigned technician card */}
      {tech && (
        <View style={{ margin: 16, marginBottom: 0, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray, marginBottom: 10 }}>Tu técnico asignado</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>{tech.nombre}</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>{tech.oficio}</Text>
              {tech.calificacion > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={{ fontSize: 11, color: COLORS.gray }}>{tech.calificacion.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              const msg = `Hola ${tech.nombre}, soy ${service.nombre}. Tengo una solicitud de ${service.servicio} en SOLU (código: ${service.codigo}).`
              Linking.openURL(`https://wa.me/51${tech.whatsapp}?text=${encodeURIComponent(msg)}`)
            }}
            style={{
              backgroundColor: '#25D366', borderRadius: 12, padding: 12, marginTop: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Contactar por WhatsApp</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Timeline */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 20 }}>Estado del servicio</Text>
        {STEPS.map((step, i) => {
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <View key={step.key} style={{ flexDirection: 'row', gap: 14 }}>
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
                  <View style={{ width: 2, height: 40, backgroundColor: i < currentIdx ? COLORS.pri : COLORS.border }} />
                )}
              </View>
              <View style={{ flex: 1, paddingTop: 4, paddingBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: done ? COLORS.dark : COLORS.gray2 }}>
                  {step.label}
                </Text>
                <Text style={{ fontSize: 11, color: done ? COLORS.gray : COLORS.gray2, marginTop: 2 }}>
                  {active ? 'Estado actual' : step.desc}
                </Text>
              </View>
            </View>
          )
        })}
      </View>

      {service.descripcion && (
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Descripción</Text>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ fontSize: 13, color: COLORS.gray, lineHeight: 20 }}>{service.descripcion}</Text>
          </View>
        </View>
      )}

      {/* Rate service when completed */}
      {isCompleted && (
        <View style={{ padding: 20, gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/calificar/[code]', params: { code: service.codigo } })}
            style={{
              backgroundColor: '#F59E0B', borderRadius: 14, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Calificar servicio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={shareReferral}
            style={{
              backgroundColor: '#25D366', borderRadius: 14, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Recomendar a un vecino</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel button (solo si aún no comenzó) */}
      {canCancel && (
        <View style={{ padding: 20, paddingTop: 0 }}>
          <TouchableOpacity
            onPress={handleCancel}
            style={{
              backgroundColor: '#fff', borderRadius: 14, padding: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderWidth: 1, borderColor: '#FCA5A5',
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Cancelar solicitud</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancelado state */}
      {service.estado === 'Cancelado' && (
        <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: '#FEE2E2', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FCA5A5' }}>
          <Ionicons name="close-circle" size={22} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#991B1B' }}>Solicitud cancelada</Text>
            <Text style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>Puedes solicitar un nuevo servicio cuando quieras.</Text>
          </View>
        </View>
      )}

      {/* Help */}
      <View style={{ padding: 20, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={() => Linking.openURL(waLink(SUPPORT_PHONE, `Hola, necesito ayuda con mi servicio ${service.codigo}`))}
          style={{
            backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14,
            flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E2E8F0',
          }}
        >
          <Ionicons name="help-circle" size={20} color={COLORS.gray} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark }}>¿Necesitas ayuda?</Text>
            <Text style={{ fontSize: 10, color: COLORS.gray }}>Contacta a soporte por WhatsApp</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={COLORS.gray2} />
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  )
}
