import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Image, Linking, RefreshControl, Alert, Share } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { waLink, SUPPORT_PHONE } from '../../src/lib/constants'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer, PulseDot, haptics } from '../../src/components/ui/Motion'
import { supabase } from '../../src/lib/supabase'
import { ENV, fetchWithTimeout } from '../../src/lib/env'
import { fetchServicioByCodigoResult, type TecnicoTracking } from '../../src/lib/servicios'
import { codigoDeTecnico } from '../../src/lib/codigo-tecnico'
import { useClientProfile } from '../../src/lib/useClientProfile'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { LiveTechMap } from '../../src/components/LiveTechMap'
import type { Cliente } from '../../src/lib/types'

// Tarjeta del técnico en el tracking: normalmente viene del endpoint (con
// num_resenas/verificado/antecedentes). Si el server no lo resuelve
// (fail-closed) degradamos al select público mínimo, donde esas señales no
// están — por eso son opcionales acá.
type TechCard = {
  id: number
  nombre: string | null
  oficio: string | null
  foto_url: string | null
  calificacion: number | null
  num_resenas?: number | null
  verificado?: boolean | null
  antecedentes?: boolean | null
}

// Minutos restantes según el ETA que reportó el técnico (portado verbatim de
// la web): parte de cuando dijo "voy en camino" y descuenta lo transcurrido.
// Sin en_camino_at (o inválido) cae al valor crudo. null si no hay ETA. El
// ETA lo reporta el técnico a mano, no es GPS.
function etaRestanteMin(
  enCaminoAt: string | null,
  etaMinutos: number | null,
  ahora: number = Date.now(),
): number | null {
  if (!etaMinutos || etaMinutos <= 0) return null
  if (!enCaminoAt) return etaMinutos
  const inicio = new Date(enCaminoAt).getTime()
  if (Number.isNaN(inicio)) return etaMinutos
  const llegada = inicio + etaMinutos * 60_000
  return Math.round((llegada - ahora) / 60_000)
}

const STEPS = [
  { key: 'Nuevo', label: 'Solicitud registrada', icon: 'document-text' as const, desc: 'Tu solicitud fue recibida' },
  { key: 'En espera', label: 'Buscando técnico', icon: 'time' as const, desc: 'No hay técnico disponible ahora. Te avisamos apenas aparezca uno.' },
  { key: 'Asignado', label: 'Técnico asignado', icon: 'person' as const, desc: 'Un técnico aceptó tu solicitud' },
  { key: 'En camino', label: 'Técnico en camino', icon: 'car' as const, desc: 'El técnico se dirige a tu ubicación' },
  { key: 'En proceso', label: 'Trabajo en proceso', icon: 'hammer' as const, desc: 'El técnico está trabajando' },
  { key: 'Completado', label: 'Servicio completado', icon: 'checkmark-circle' as const, desc: '¡Servicio finalizado!' },
]

const URGENCIA_COLOR: Record<string, string> = {
  emergencia: THEME.color.danger,
  urgente: THEME.color.warning,
  normal: THEME.color.success,
}

export default function TrackingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const router = useRouter()
  const [service, setService] = useState<(Cliente & { tecnico_lat?: number | null; tecnico_lng?: number | null; tecnico_gps_updated_at?: string | null; eta_minutos?: number | null; en_camino_at?: string | null }) | null>(null)
  // whatsapp ya NO se lee desde anon (PII cerrada por el lockdown): se pide
  // de a uno al endpoint server-side cuando el usuario toca "WhatsApp".
  const [tech, setTech] = useState<TechCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // Identidad del cliente invitado (AsyncStorage): su whatsapp es la referencia
  // para pedir el cancelToken. El whatsapp del servicio ya viene null (PII cerrada).
  const { profile } = useClientProfile()

  const loadData = useCallback(async () => {
    // Lectura de `clientes` migrada a endpoint server-side (anon cerrado por PII).
    // Distinguimos "no existe" (404) de "no pude preguntar" (red/5xx): antes
    // ambos caían en la pantalla "No encontramos ese código".
    const res = await fetchServicioByCodigoResult(code)
    if (res.estado === 'error') {
      // No pudimos preguntar (red/5xx): mostramos "revisa tu conexión", no
      // "no existe". El render solo saca esta pantalla si aún no había datos
      // (`loadError && !service`), así que en polling no vacía lo ya cargado.
      setLoadError(true)
      return
    }
    setLoadError(false)
    const data = res.estado === 'ok' ? res.servicio : null
    setService(data)

    if (res.estado === 'ok' && res.tecnico) {
      // El endpoint ya devuelve la tarjeta pública completa (mismo builder que
      // la web): num_resenas + señales de confianza para los badges.
      setTech(res.tecnico)
    } else if (data?.tecnico_asignado) {
      // Degradación fail-closed: el server no resolvió al técnico. Caemos al
      // select público mínimo (sin badges) para no dejar la tarjeta vacía.
      const { data: techData } = await supabase
        .from('tecnicos')
        .select('id, nombre, oficio, foto_url, calificacion')
        .eq('id', data.tecnico_asignado)
        .single()
      setTech(techData as TechCard | null)
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

  // Sin Realtime: el lockdown RLS cerró el acceso anon a postgres_changes,
  // así que el estado se refresca por polling cada 15s (igual que la web).
  // Se detiene en estados terminales para no gastar batería/datos de balde.
  const estadoActual = service?.estado
  useEffect(() => {
    if (!service?.id) return
    if (estadoActual === 'Completado' || estadoActual === 'Cancelado') return

    let cancelled = false
    const intervalId = setInterval(() => {
      if (cancelled) return
      loadData().catch(() => {})
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [service?.id, estadoActual, loadData])

  // Ticker del ETA: el técnico reporta el tiempo a mano (no GPS) y el polling
  // de 15s no basta para descontar minuto a minuto, así que refrescamos el
  // conteo local cada 30s mientras vaya en camino y haya ETA. Se limpia en
  // unmount / al cambiar de estado.
  const [ahora, setAhora] = useState(() => Date.now())
  const etaMin = service?.eta_minutos ?? null
  const vaEnCamino = estadoActual === 'En camino'
  useEffect(() => {
    if (!vaEnCamino || !etaMin || etaMin <= 0) return
    const t = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [vaEnCamino, etaMin])

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      <View style={{ padding: THEME.space.xl, gap: THEME.space.lg }}>
        <Shimmer style={{ height: 92, borderRadius: THEME.radius.xl }} />
        <Shimmer style={{ height: 120, borderRadius: THEME.radius.xl }} />
        <View style={{ gap: THEME.space.md, marginTop: THEME.space.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: THEME.space.md, alignItems: 'center' }}>
              <Shimmer style={{ width: 36, height: 36, borderRadius: THEME.radius.full }} />
              <Shimmer style={{ flex: 1, height: 18, borderRadius: THEME.radius.sm }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
  if (loadError && !service) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxl, backgroundColor: THEME.color.surfaceAlt }}>
      <FadeInUp style={{ alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
          <Ionicons name="cloud-offline-outline" size={40} color={THEME.color.inkMuted} />
        </View>
        <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>No pudimos cargar tu servicio</Text>
        <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center' }}>Revisa tu conexión a internet e intenta de nuevo.</Text>
        <PressableScale
          onPress={() => { setLoading(true); loadData().finally(() => setLoading(false)) }}
          accessibilityLabel="Reintentar"
          style={{ marginTop: THEME.space.xl, height: 52, paddingHorizontal: THEME.space.xxxl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Reintentar</Text>
        </PressableScale>
      </FadeInUp>
    </View>
  )
  if (!service) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxl, backgroundColor: THEME.color.surfaceAlt }}>
      <FadeInUp style={{ alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
          <Ionicons name="search-outline" size={40} color={THEME.color.inkMuted} />
        </View>
        <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>No encontramos ese código</Text>
        <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center' }}>Verifica que el código sea correcto, por ejemplo: SOLU-AB12CD</Text>
        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Volver"
          style={{ marginTop: THEME.space.xl, height: 52, paddingHorizontal: THEME.space.xxxl, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.sm }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Volver</Text>
        </PressableScale>
      </FadeInUp>
    </View>
  )

  const currentIdx = STEPS.findIndex(s => s.key === service.estado)
  const isCompleted = service.estado === 'Completado'
  const canCancel = service.estado === 'Nuevo' || service.estado === 'Asignado'
  const enCamino = service.estado === 'En camino'

  // Copy del ETA (mismo que la web): con minutos restantes → "llega en ~N min";
  // vencido → "está por llegar"; sin ETA → "En camino a tu ubicación". Nunca
  // muestra minutos negativos.
  const etaRestante = etaRestanteMin(service.en_camino_at ?? null, service.eta_minutos ?? null, ahora)
  const etaTitulo =
    etaRestante === null
      ? 'En camino a tu ubicación'
      : etaRestante > 0
        ? `En camino · llega en ~${etaRestante} min`
        : 'En camino · está por llegar'
  const etaSubtitulo =
    etaRestante === null
      ? 'Tu técnico ya está yendo. Te avisaremos por WhatsApp cuando llegue.'
      : 'Tiempo estimado por el técnico. Te avisaremos por WhatsApp cuando llegue.'

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
            // Cancelación server-side: el endpoint cambia el estado y notifica
            // al técnico (push + BD). El insert/update anon quedó cerrado por
            // el lockdown. La app no tiene cookie de sesión, así que probamos
            // ownership con el whatsapp del CLIENTE (AsyncStorage): antes se leía
            // snapshot.whatsapp, que ahora viene null (PII cerrada) → el server
            // no podía verificar y devolvía 403. Pedimos un cancelToken (HMAC
            // del código) con ese número y con él cancelamos.
            const whatsapp = (profile?.whatsapp || '').replace(/\D/g, '')
            if (!whatsapp) {
              // Sin el número con el que pidió el servicio no podemos probar que
              // es suyo (evita que cualquiera con el código cancele pedidos ajenos).
              Alert.alert(
                'No pudimos verificar tu identidad',
                'Para cancelar necesitamos el número con el que pediste el servicio. Escríbenos por WhatsApp de soporte y lo cancelamos.',
              )
              return
            }
            try {
              const tokRes = await fetchWithTimeout(`${ENV.API_BASE_URL}/pedidos/${encodeURIComponent(snapshot.codigo)}/cancel-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsapp }),
              })
              if (!tokRes.ok) {
                Alert.alert('Error', 'No pudimos verificar tu identidad. Contacta a soporte.')
                return
              }
              const { cancelToken } = await tokRes.json() as { cancelToken?: string }

              const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/pedidos/${encodeURIComponent(snapshot.codigo)}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cancelToken ? { cancelToken } : {}),
              })
              if (!res.ok) {
                Alert.alert('Error', 'No se pudo cancelar. Intenta de nuevo.')
                return
              }
            } catch {
              Alert.alert('Error', 'No se pudo cancelar. Revisa tu conexión e intenta de nuevo.')
              return
            }
            haptics.warning()
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
        message: `Acabo de usar SOLU y me resolvieron un problema de ${snapshot.servicio} rapidísimo 🔧\n\nDescarga la app y pide tu servicio: https://www.solu.pe`,
      })
    } catch {}
  }

  const urgenciaColor = service.urgencia ? (URGENCIA_COLOR[service.urgencia] ?? THEME.color.inkSoft) : THEME.color.inkMuted

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
    <OfflineBanner />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.color.brand]} tintColor={THEME.color.brand} />}>
      {/* Header oscuro premium */}
      <FadeInUp>
        <View style={{ backgroundColor: THEME.color.navy, paddingHorizontal: THEME.space.xl, paddingTop: THEME.space.xxxl, paddingBottom: THEME.space.xxl, borderBottomLeftRadius: THEME.radius.xxl, borderBottomRightRadius: THEME.radius.xxl }}>
          <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Código de seguimiento</Text>
          <Text style={{ ...THEME.font.display, color: THEME.color.white, marginTop: 2 }}>{service.codigo}</Text>

          {enCamino && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.md, alignSelf: 'flex-start', backgroundColor: 'rgba(22,163,74,0.18)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: 6 }}>
              <PulseDot color={THEME.color.success} size={9} />
              <Text style={{ ...THEME.font.label, fontWeight: '700', color: '#86EFAC' }}>Técnico en camino</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: THEME.space.xxl, marginTop: THEME.space.lg }}>
            <View>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>Servicio</Text>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.white, marginTop: 2 }}>{service.servicio}</Text>
            </View>
            <View>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>Distrito</Text>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.white, marginTop: 2 }}>{service.distrito}</Text>
            </View>
            <View>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>Urgencia</Text>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: urgenciaColor, marginTop: 2 }}>{service.urgencia ? service.urgencia.charAt(0).toUpperCase() + service.urgencia.slice(1) : '—'}</Text>
            </View>
          </View>
        </View>
      </FadeInUp>

      {/* Banner de ETA — el técnico reporta el tiempo a mano (no GPS), por eso
          el subtítulo lo aclara y, si venció, degrada a "está por llegar". */}
      {enCamino && (
        <FadeInUp delay={40}>
          <View style={{ marginHorizontal: THEME.space.lg, marginTop: THEME.space.lg, backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.xl, padding: THEME.space.lg, borderWidth: 1, borderColor: THEME.color.brandSoft, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
            <View style={{ width: 44, height: 44, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}>
              <Ionicons name="navigate" size={20} color={THEME.color.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>{etaTitulo}</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>{etaSubtitulo}</Text>
            </View>
          </View>
        </FadeInUp>
      )}

      {/* Live GPS map (solo cuando tecnico en camino y tiene coords) */}
      {service.estado === 'En camino' && service.tecnico_lat != null && service.tecnico_lng != null ? (
        <FadeInUp delay={60}>
          <View style={{ marginHorizontal: THEME.space.lg, marginTop: THEME.space.lg, borderRadius: THEME.radius.xl, overflow: 'hidden', ...THEME.shadow.md }}>
            <LiveTechMap
              lat={service.tecnico_lat}
              lng={service.tecnico_lng}
              updatedAt={service.tecnico_gps_updated_at}
              techNombre={tech?.nombre ?? undefined}
            />
          </View>
        </FadeInUp>
      ) : null}

      {/* Assigned technician card */}
      {tech && (
        <FadeInUp delay={120}>
          <View style={{ marginHorizontal: THEME.space.lg, marginTop: THEME.space.lg, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, ...THEME.shadow.md }}>
            <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: THEME.space.md }}>Tu técnico asignado</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
              {tech.foto_url ? (
                <Image
                  source={{ uri: tech.foto_url }}
                  style={{ width: 52, height: 52, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.color.line }}
                />
              ) : (
                <View style={{ width: 52, height: 52, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.navy, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={24} color={THEME.color.white} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>{tech.nombre}</Text>
                {tech.oficio ? (
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 1 }}>{tech.oficio}</Text>
                ) : null}
                {/* Código público — mismo string estable que el perfil y la web. */}
                <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: THEME.color.inkMuted, marginTop: 2 }}>
                  {codigoDeTecnico(tech.id)}
                </Text>
                {/* Rating o "Nuevo": no inventamos nota si aún no tiene reseñas.
                    En la degradación (sin num_resenas) caemos a calificacion>0. */}
                {(tech.num_resenas != null ? tech.num_resenas > 0 : (tech.calificacion ?? 0) > 0) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="star" size={13} color={THEME.color.warning} />
                    <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>{(tech.calificacion ?? 0).toFixed(1)}</Text>
                    {tech.num_resenas != null && tech.num_resenas > 0 ? (
                      <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>({tech.num_resenas})</Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                    <Ionicons name="sparkles" size={12} color={THEME.color.brand} />
                    <Text style={{ ...THEME.font.label, color: THEME.color.brand }}>Nuevo</Text>
                  </View>
                )}
              </View>
            </View>
            {/* Señales de confianza — coherentes con los badges del perfil.
                Solo booleanos: nunca el documento ni datos sensibles. */}
            {(tech.verificado === true || tech.antecedentes === true) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.xs, marginTop: THEME.space.md }}>
                {tech.verificado === true && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                    <Ionicons name="checkmark-circle" size={13} color={THEME.color.success} />
                    <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>Verificado</Text>
                  </View>
                )}
                {tech.antecedentes === true && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                    <Ionicons name="shield-checkmark" size={13} color={THEME.color.success} />
                    <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>Antecedentes</Text>
                  </View>
                )}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.lg }}>
              <PressableScale
                onPress={() => router.push({ pathname: '/chat-pedido/[code]', params: { code: service.codigo, as: 'cliente' } })}
                accessibilityLabel="Abrir chat interno con el técnico"
                style={{
                  flex: 1, height: 48, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs,
                  ...THEME.shadow.brand,
                }}
              >
                <Ionicons name="chatbubbles" size={17} color={THEME.color.white} />
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Chat interno</Text>
              </PressableScale>
              {/* Botón de WhatsApp directo RETIRADO: revelaba el número del
                  técnico (openTechWhatsapp → GET /api/tecnico/[id]/contacto) sin
                  cobrar coin. El cliente coordina por el chat interno in-app. */}
            </View>
          </View>
        </FadeInUp>
      )}

      {/* Timeline */}
      <FadeInUp delay={180}>
        <View style={{ paddingHorizontal: THEME.space.xl, paddingTop: THEME.space.xxl }}>
          <Text style={{ ...THEME.font.h2, color: THEME.color.ink, marginBottom: THEME.space.xl }}>Estado del servicio</Text>
          {STEPS.map((step, i) => {
            const done = i <= currentIdx
            const active = i === currentIdx
            return (
              <View key={step.key} style={{ flexDirection: 'row', gap: THEME.space.md }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: THEME.radius.full,
                    backgroundColor: done ? THEME.color.brand : THEME.color.surfaceSunken,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: active ? 4 : 0, borderColor: THEME.color.brandSoft,
                    ...(active ? THEME.shadow.brand : {}),
                  }}>
                    {active ? (
                      <PulseDot color={THEME.color.white} size={9} />
                    ) : (
                      <Ionicons name={step.icon} size={16} color={done ? THEME.color.white : THEME.color.inkMuted} />
                    )}
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={{ width: 3, height: 40, borderRadius: 2, backgroundColor: i < currentIdx ? THEME.color.brand : THEME.color.line }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingTop: 6, paddingBottom: THEME.space.md }}>
                  <Text style={{ ...THEME.font.body, fontWeight: active ? '800' : '600', color: done ? THEME.color.ink : THEME.color.inkMuted }}>
                    {step.label}
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: active ? THEME.color.brand : (done ? THEME.color.inkSoft : THEME.color.inkMuted), marginTop: 3 }}>
                    {active ? 'Estado actual' : step.desc}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </FadeInUp>

      {service.descripcion && (
        <FadeInUp delay={240}>
          <View style={{ paddingHorizontal: THEME.space.xl, marginTop: THEME.space.sm }}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.sm }}>Descripción</Text>
            <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, lineHeight: 20 }}>{service.descripcion}</Text>
            </View>
          </View>
        </FadeInUp>
      )}

      {/* Rate service when completed */}
      {isCompleted && (
        <FadeInUp delay={120}>
          <View style={{ padding: THEME.space.xl, gap: THEME.space.md }}>
            <PressableScale
              onPress={() => router.push({ pathname: '/calificar/[code]', params: { code: service.codigo } })}
              accessibilityLabel="Calificar servicio"
              style={{
                height: 52, backgroundColor: THEME.color.warning, borderRadius: THEME.radius.lg,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
                ...THEME.shadow.md,
              }}
            >
              <Ionicons name="star" size={20} color={THEME.color.white} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Calificar servicio</Text>
            </PressableScale>
            <PressableScale
              onPress={shareReferral}
              accessibilityLabel="Recomendar a un vecino"
              style={{
                height: 52, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
                ...THEME.shadow.sm,
              }}
            >
              <Ionicons name="share-social" size={20} color={THEME.color.success} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.success }}>Recomendar a un vecino</Text>
            </PressableScale>
          </View>
        </FadeInUp>
      )}

      {/* Cancel button (solo si aún no comenzó) */}
      {canCancel && (
        <View style={{ paddingHorizontal: THEME.space.xl, paddingTop: THEME.space.md }}>
          <PressableScale
            onPress={handleCancel}
            accessibilityLabel="Cancelar solicitud"
            haptic={false}
            style={{
              height: 48, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
              ...THEME.shadow.sm,
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color={THEME.color.danger} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.danger }}>Cancelar solicitud</Text>
          </PressableScale>
        </View>
      )}

      {/* Cancelado state */}
      {service.estado === 'Cancelado' && (
        <FadeInUp>
          <View style={{ marginHorizontal: THEME.space.xl, marginTop: THEME.space.md, backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
            <Ionicons name="close-circle" size={24} color={THEME.color.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.danger }}>Solicitud cancelada</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>Puedes solicitar un nuevo servicio cuando quieras.</Text>
            </View>
          </View>
        </FadeInUp>
      )}

      {/* Help */}
      <View style={{ paddingHorizontal: THEME.space.xl, paddingTop: THEME.space.lg }}>
        <PressableScale
          onPress={() => Linking.openURL(waLink(SUPPORT_PHONE, `Hola, necesito ayuda con mi servicio ${service.codigo}`))}
          accessibilityLabel="Contactar a soporte por WhatsApp"
          style={{
            backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg,
            flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.sm,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="help-circle" size={22} color={THEME.color.inkSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>¿Necesitas ayuda?</Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 1 }}>Contacta a soporte por WhatsApp</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={THEME.color.inkMuted} />
        </PressableScale>
      </View>
    </ScrollView>
    </View>
  )
}
