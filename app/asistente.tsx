import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, StatusBar, Animated, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SERVICIO_TO_OFICIO } from '../src/lib/constants'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, PulseDot, haptics } from '../src/components/ui/Motion'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { supabase } from '../src/lib/supabase'
import { optimizeUrl } from '../src/lib/cloudinary'
import { useClientProfile } from '../src/lib/useClientProfile'
import { detectServicio, detectUrgencia, getPrecioSugerido, formatPrecio, type Urgencia } from '../src/lib/smartIntent'

// ── Tipos ──

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface ExtractedData {
  servicio: string
  distrito: string
  nombre: string
  whatsapp: string
  urgencia: Urgencia
}

interface TechSuggestion {
  id: number
  nombre: string
  oficio: string | null
  distrito: string | null
  calificacion: number | null
  num_resenas: number | null
  foto_url: string | null
  verificado?: boolean | null
}

type ChatItem =
  | { id: number; kind: 'msg'; role: 'user' | 'assistant'; content: string }
  | { id: number; kind: 'confirm'; data: ExtractedData }
  | { id: number; kind: 'success'; codigo: string | null }
  | { id: number; kind: 'techs'; techs: TechSuggestion[] }
  | { id: number; kind: 'error'; text: string; retry: 'chat' | 'confirm' | null; servicio?: string | null; urgencia?: Urgencia }

const QUICK_CHIPS = ['Tengo una fuga de agua', 'No tengo luz en casa', 'Mi puerta está trabada', 'Necesito limpieza profunda']

const GREETING = '¡Hola! 👋 Soy el asistente de SOLU. Cuéntame qué necesitas y te conecto con un técnico verificado en minutos.\n\nPor ejemplo: "Tengo una fuga de agua en la cocina"'

// ── Typing indicator: 3 puntos animados en burbuja SOLU ──

function TypingDots() {
  const dots = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [dots])

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.xl,
        borderBottomLeftRadius: THEME.radius.sm,
        paddingHorizontal: THEME.space.lg,
        paddingVertical: THEME.space.md + 2,
        flexDirection: 'row',
        gap: 6,
        ...THEME.shadow.sm,
      }}
    >
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.color.inkMuted, opacity: v }} />
      ))}
    </View>
  )
}

// ── Card de técnico inline en el chat ──

function TechInlineCard({ tech, servicio }: { tech: TechSuggestion; servicio: string | null }) {
  const router = useRouter()
  return (
    <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.md, marginBottom: THEME.space.sm, ...THEME.shadow.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
        {tech.foto_url ? (
          <Image source={{ uri: optimizeUrl(tech.foto_url, { width: 48, height: 48 }) }} style={{ width: 50, height: 50, borderRadius: THEME.radius.md }} />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: THEME.color.brand }}>{tech.nombre?.charAt(0) || 'T'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs }}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink }} numberOfLines={1}>{tech.nombre}</Text>
            {tech.verificado && <Ionicons name="checkmark-circle" size={14} color={THEME.color.info} />}
          </View>
          <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 1 }} numberOfLines={1}>
            {tech.oficio || servicio || 'Técnico'}{tech.distrito ? ` · ${tech.distrito}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs, marginTop: 2 }}>
            <Ionicons name="star" size={12} color={THEME.color.oro} />
            <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>{(tech.calificacion ?? 0).toFixed(1)}</Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>({tech.num_resenas ?? 0} reseñas)</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.md }}>
        <PressableScale
          onPress={() => router.push(`/tecnico/${tech.id}`)}
          accessibilityLabel={`Ver perfil de ${tech.nombre}`}
          style={{ flex: 1, minHeight: 44, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.xs + 1 }}
        >
          <Ionicons name="person-outline" size={15} color={THEME.color.ink} />
          <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>Ver perfil</Text>
        </PressableScale>
        <PressableScale
          onPress={() =>
            router.push({
              pathname: '/solicitar',
              params: {
                tecnicoId: String(tech.id),
                tecnicoNombre: tech.nombre,
                tecnicoOficio: tech.oficio || '',
                servicio: servicio || tech.oficio || '',
              },
            })
          }
          accessibilityLabel={`Contactar a ${tech.nombre}`}
          style={{ flex: 1, minHeight: 44, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.xs + 1, ...THEME.shadow.brand }}
        >
          <Ionicons name="flash" size={15} color={THEME.color.white} />
          <Text style={{ ...THEME.font.label, color: THEME.color.white }}>Contactar</Text>
        </PressableScale>
      </View>
    </View>
  )
}

// ── Pantalla principal ──

export default function AsistenteScreen() {
  const router = useRouter()
  const { save: saveProfile } = useClientProfile()
  const idRef = useRef(1)
  const nextId = () => idRef.current++

  const [items, setItems] = useState<ChatItem[]>([{ id: 0, kind: 'msg', role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const lastExtractedRef = useRef<ExtractedData | null>(null)
  const lastServicioRef = useRef<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(t)
  }, [items, loading])

  const pushItems = useCallback((...newOnes: ChatItem[]) => {
    setItems((prev) => [...prev, ...newOnes])
  }, [])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  // Historial en el formato del endpoint: desde el primer mensaje del usuario, últimos 20 turnos
  function buildApiMessages(list: ChatItem[]): ChatMsg[] {
    const msgs = list.filter((it): it is Extract<ChatItem, { kind: 'msg' }> => it.kind === 'msg')
    const firstUser = msgs.findIndex((m) => m.role === 'user')
    if (firstUser < 0) return []
    return msgs.slice(firstUser).slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  }

  function userDescription(list: ChatItem[]): string {
    return list
      .filter((it): it is Extract<ChatItem, { kind: 'msg' }> => it.kind === 'msg' && it.role === 'user')
      .map((m) => m.content)
      .join(' | ')
      .slice(0, 500)
  }

  // Técnicos top desde Supabase (mismo criterio que el matching local)
  async function loadTechs(servicio: string): Promise<TechSuggestion[]> {
    const cols = 'id, nombre, oficio, distrito, calificacion, num_resenas, foto_url, verificado'
    const term = (SERVICIO_TO_OFICIO[servicio]?.[0] || servicio).split(' ')[0]
    try {
      const { data } = await supabase
        .from('tecnicos')
        .select(cols)
        .eq('disponible', true)
        .eq('verificado', true)
        .ilike('oficio', `%${term}%`)
        .order('calificacion', { ascending: false })
        .limit(3)
      let techs = (data as TechSuggestion[] | null) ?? []
      if (!techs.length) {
        const { data: fallback } = await supabase
          .from('tecnicos')
          .select(cols)
          .eq('disponible', true)
          .eq('verificado', true)
          .order('calificacion', { ascending: false })
          .limit(3)
        techs = (fallback as TechSuggestion[] | null) ?? []
      }
      return techs
    } catch {
      return []
    }
  }

  // Fallback local con smartIntent cuando la IA no responde
  function localFallback(lastUserText: string): ChatItem {
    const servicio = detectServicio(lastUserText)
    const urgencia = detectUrgencia(lastUserText)
    let text = 'No pude conectarme con el asistente 😕. Revisa tu internet y vuelve a intentar.'
    if (servicio) {
      lastServicioRef.current = servicio
      const precio = getPrecioSugerido(servicio)
      text = `No pude conectarme con el asistente 😕, pero por lo que cuentas parece que necesitas ${servicio}${precio ? ` (precio referencial ${formatPrecio(precio)})` : ''}. Puedes solicitar un técnico directo o reintentar el chat.`
    }
    return { id: nextId(), kind: 'error', text, retry: 'chat', servicio, urgencia }
  }

  // ── Llamada al endpoint /ai-chat (modo chat) ──
  async function runChat(history: ChatMsg[]) {
    if (!history.length) return
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        timeout: 25000,
      })

      if (res.status === 429) {
        let wait = ''
        try {
          const err = await res.json()
          if (typeof err?.retryAfterSec === 'number') wait = ` en ${Math.max(1, Math.ceil(err.retryAfterSec / 60))} min`
        } catch {}
        pushItems({ id: nextId(), kind: 'msg', role: 'assistant', content: `Estamos recibiendo muchas consultas ahora mismo 🙏. Intenta de nuevo${wait || ' en unos minutos'}.` })
        return
      }
      if (!res.ok) throw new Error(`ai-chat ${res.status}`)

      const data: { reply?: string; extractedData?: ExtractedData; isReadyToSubmit?: boolean } = await res.json()
      const newOnes: ChatItem[] = []
      if (data.reply) newOnes.push({ id: nextId(), kind: 'msg', role: 'assistant', content: data.reply })

      if (data.extractedData?.servicio) lastServicioRef.current = data.extractedData.servicio

      if (data.isReadyToSubmit && data.extractedData) {
        lastExtractedRef.current = data.extractedData
        newOnes.push({ id: nextId(), kind: 'confirm', data: data.extractedData })
      }
      if (!newOnes.length) {
        newOnes.push({ id: nextId(), kind: 'msg', role: 'assistant', content: 'Cuéntame un poco más de tu problema para ayudarte mejor.' })
      }
      pushItems(...newOnes)
    } catch {
      const lastUser = [...history].reverse().find((m) => m.role === 'user')
      pushItems(localFallback(lastUser?.content || ''))
    } finally {
      setLoading(false)
    }
  }

  function handleSend(text?: string) {
    const userMsg = (text ?? input).trim()
    if (!userMsg || loading) return
    setInput('')
    const userItem: ChatItem = { id: nextId(), kind: 'msg', role: 'user', content: userMsg }
    const nextItems = [...items, userItem]
    setItems(nextItems)
    runChat(buildApiMessages(nextItems))
  }

  // ── Confirmar: crea la solicitud con extractedData via POST /solicitudes ──
  async function handleConfirm(data: ExtractedData, confirmItemId: number) {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Nombres alineados con SolicitudSchema del endpoint (clienteNombre/clienteWhatsapp)
        body: JSON.stringify({
          clienteNombre: data.nombre,
          clienteWhatsapp: data.whatsapp,
          distrito: data.distrito,
          servicio: data.servicio,
          urgencia: data.urgencia,
          descripcion: userDescription(items),
        }),
        timeout: 20000,
      })
      if (!res.ok) throw new Error(`solicitudes ${res.status}`)

      // Shape defensivo: la API web puede devolver codigo y/o técnicos sugeridos
      let codigo: string | null = null
      let techs: TechSuggestion[] = []
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- respuesta externa sin contrato tipado en la app
        const body: any = await res.json()
        codigo = body?.codigo || body?.codigo_solicitud || body?.solicitud?.codigo || null
        // El endpoint devuelve los técnicos sugeridos en `matchedTechs`
        if (Array.isArray(body?.matchedTechs)) techs = body.matchedTechs as TechSuggestion[]
      } catch {}

      saveProfile({ nombre: data.nombre, whatsapp: data.whatsapp, distrito: data.distrito, lastServicio: data.servicio })
      lastServicioRef.current = data.servicio

      if (!techs.length) techs = await loadTechs(data.servicio)

      removeItem(confirmItemId)
      haptics.success()
      const newOnes: ChatItem[] = [
        { id: nextId(), kind: 'success', codigo },
        { id: nextId(), kind: 'msg', role: 'assistant', content: `¡Listo, ${data.nombre}! 🎉 Tu solicitud de ${data.servicio} en ${data.distrito} ya está creada. Te contactaremos por WhatsApp al ${data.whatsapp}.` },
      ]
      if (techs.length) {
        newOnes.push({ id: nextId(), kind: 'msg', role: 'assistant', content: 'Mientras tanto, estos técnicos top están disponibles para ti:' })
        newOnes.push({ id: nextId(), kind: 'techs', techs })
      }
      pushItems(...newOnes)
    } catch {
      pushItems({
        id: nextId(),
        kind: 'error',
        text: 'No pude crear tu solicitud automáticamente 😕. Puedes reintentar o completarla en el formulario (tus datos ya quedan guardados).',
        retry: 'confirm',
        servicio: data.servicio,
        urgencia: data.urgencia,
      })
      saveProfile({ nombre: data.nombre, whatsapp: data.whatsapp, distrito: data.distrito, lastServicio: data.servicio })
    } finally {
      setSubmitting(false)
    }
  }

  function handleRetry(item: Extract<ChatItem, { kind: 'error' }>) {
    removeItem(item.id)
    if (item.retry === 'confirm' && lastExtractedRef.current) {
      const data = lastExtractedRef.current
      const confirmItem: ChatItem = { id: nextId(), kind: 'confirm', data }
      pushItems(confirmItem)
      handleConfirm(data, confirmItem.id)
    } else {
      runChat(buildApiMessages(items.filter((it) => it.id !== item.id)))
    }
  }

  function goSolicitar(servicio: string, urgencia?: Urgencia) {
    router.push({ pathname: '/solicitar', params: { servicio, urgencia: urgencia || 'normal', descripcion: userDescription(items) } })
  }

  const showChips = !items.some((it) => it.kind === 'msg' && it.role === 'user')
  const urgenciaLabel = (u: Urgencia) => (u === 'emergencia' ? '🚨 Emergencia' : u === 'urgente' ? '⏱️ Urgente' : '📅 Normal')

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} behavior="padding">
      <StatusBar barStyle="light-content" />
      {/* Header oscuro navy con avatar IA */}
      <View style={{ backgroundColor: THEME.color.navy, paddingHorizontal: THEME.space.lg, paddingBottom: THEME.space.lg, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.md }}>
        <PressableScale accessibilityLabel="Volver" haptic={false} onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={THEME.color.white} />
        </PressableScale>
        <View style={{ width: 42, height: 42, borderRadius: THEME.radius.full, backgroundColor: 'rgba(242,107,33,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={20} color={THEME.color.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Asistente SOLU</Text>
          <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.62)' }}>Te conecto con un técnico en minutos</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: 'rgba(22,163,74,0.16)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs + 1 }}>
          <PulseDot color={THEME.color.success} size={7} />
          <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>En línea</Text>
        </View>
      </View>

      {/* Mensajes */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: THEME.space.md, gap: THEME.space.sm + 2, paddingBottom: THEME.space.xxl }} keyboardShouldPersistTaps="handled">
        {items.map((it) => {
          if (it.kind === 'msg') {
            const isUser = it.role === 'user'
            return (
              <FadeInUp key={it.id} distance={8} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
                <View
                  style={{
                    backgroundColor: isUser ? THEME.color.brand : THEME.color.surface,
                    borderRadius: THEME.radius.xl,
                    borderBottomRightRadius: isUser ? THEME.radius.sm : THEME.radius.xl,
                    borderBottomLeftRadius: isUser ? THEME.radius.xl : THEME.radius.sm,
                    paddingHorizontal: THEME.space.lg,
                    paddingVertical: THEME.space.md,
                    ...(isUser ? THEME.shadow.brand : THEME.shadow.sm),
                  }}
                >
                  <Text style={{ ...THEME.font.body, color: isUser ? THEME.color.white : THEME.color.ink, lineHeight: 21 }}>{it.content}</Text>
                </View>
              </FadeInUp>
            )
          }

          if (it.kind === 'confirm') {
            return (
              <FadeInUp key={it.id} distance={10}>
                <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, maxWidth: '94%', ...THEME.shadow.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
                    <View style={{ width: 32, height: 32, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="clipboard-outline" size={16} color={THEME.color.brand} />
                    </View>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Confirma tu solicitud</Text>
                  </View>
                  <View style={{ gap: THEME.space.sm }}>
                    {[
                      { icon: 'construct-outline' as const, val: it.data.servicio },
                      { icon: 'location-outline' as const, val: it.data.distrito },
                      { icon: 'person-outline' as const, val: it.data.nombre },
                      { icon: 'call-outline' as const, val: it.data.whatsapp },
                      { icon: 'time-outline' as const, val: urgenciaLabel(it.data.urgencia) },
                    ].map((row, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                        <Ionicons name={row.icon} size={15} color={THEME.color.inkMuted} />
                        <Text style={{ ...THEME.font.body, color: THEME.color.ink, flex: 1 }} numberOfLines={1}>{row.val}</Text>
                      </View>
                    ))}
                  </View>
                  <PressableScale
                    onPress={() => handleConfirm(it.data, it.id)}
                    disabled={submitting}
                    accessibilityLabel="Confirmar solicitud"
                    style={{ marginTop: THEME.space.lg, minHeight: 48, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.sm, ...THEME.shadow.brand }}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={THEME.color.white} />
                    <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>{submitting ? 'Enviando…' : 'Confirmar solicitud'}</Text>
                  </PressableScale>
                </View>
              </FadeInUp>
            )
          }

          if (it.kind === 'success') {
            return (
              <FadeInUp key={it.id} distance={10}>
                <View style={{ backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.xl, padding: THEME.space.lg, maxWidth: '94%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                    <Ionicons name="checkmark-circle" size={20} color={THEME.color.success} />
                    <Text style={{ ...THEME.font.h3, color: THEME.color.success }}>Solicitud creada{it.codigo ? ` · ${it.codigo}` : ''}</Text>
                  </View>
                  {it.codigo && (
                    <PressableScale
                      onPress={() => router.push(`/tracking/${it.codigo}`)}
                      accessibilityLabel="Ver seguimiento"
                      style={{ marginTop: THEME.space.md, minHeight: 44, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.sm, ...THEME.shadow.sm }}
                    >
                      <Ionicons name="navigate-outline" size={15} color={THEME.color.success} />
                      <Text style={{ ...THEME.font.label, color: THEME.color.success }}>Ver seguimiento</Text>
                    </PressableScale>
                  )}
                </View>
              </FadeInUp>
            )
          }

          if (it.kind === 'techs') {
            return (
              <FadeInUp key={it.id} distance={10} style={{ width: '100%' }}>
                {it.techs.map((t) => (
                  <TechInlineCard key={t.id} tech={t} servicio={lastServicioRef.current} />
                ))}
              </FadeInUp>
            )
          }

          // kind === 'error'
          return (
            <FadeInUp key={it.id} distance={10}>
              <View style={{ backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.xl, padding: THEME.space.lg, maxWidth: '94%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: THEME.space.sm }}>
                  <Ionicons name="cloud-offline-outline" size={18} color={THEME.color.danger} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, ...THEME.font.body, color: THEME.color.ink, lineHeight: 21 }}>{it.text}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.md }}>
                  {it.retry && (
                    <PressableScale
                      onPress={() => handleRetry(it)}
                      accessibilityLabel="Reintentar"
                      style={{ flex: 1, minHeight: 44, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.xs + 1, ...THEME.shadow.brand }}
                    >
                      <Ionicons name="refresh" size={15} color={THEME.color.white} />
                      <Text style={{ ...THEME.font.label, color: THEME.color.white }}>Reintentar</Text>
                    </PressableScale>
                  )}
                  {it.servicio && (
                    <PressableScale
                      onPress={() => goSolicitar(it.servicio!, it.urgencia)}
                      accessibilityLabel="Solicitar técnico"
                      style={{ flex: 1, minHeight: 44, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.xs + 1, ...THEME.shadow.sm }}
                    >
                      <Ionicons name="flash" size={15} color={THEME.color.brand} />
                      <Text style={{ ...THEME.font.label, color: THEME.color.brand }} numberOfLines={1}>Solicitar técnico</Text>
                    </PressableScale>
                  )}
                </View>
              </View>
            </FadeInUp>
          )
        })}

        {loading && <TypingDots />}

        {showChips && !loading && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm, marginTop: THEME.space.xs }}>
            {QUICK_CHIPS.map((chip) => (
              <PressableScale
                key={chip}
                onPress={() => handleSend(chip)}
                style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.lg, minHeight: 44, justifyContent: 'center', ...THEME.shadow.sm }}
              >
                <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>{chip}</Text>
              </PressableScale>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input con sombra */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: THEME.space.md, paddingBottom: Platform.OS === 'android' ? THEME.space.xxxl + THEME.space.xxl : THEME.space.md, gap: THEME.space.sm, backgroundColor: THEME.color.surface, ...THEME.shadow.lg }}>
        <TextInput
          style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.xl, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md + 2, ...THEME.font.body, color: THEME.color.ink, maxHeight: 120 }}
          placeholder="Cuéntame qué necesitas…"
          placeholderTextColor={THEME.color.inkMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          editable={!loading}
          returnKeyType="send"
          multiline={false}
          maxLength={2000}
        />
        <PressableScale
          onPress={() => handleSend()}
          disabled={loading || !input.trim()}
          accessibilityLabel="Enviar mensaje"
          style={{ width: 48, height: 48, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
        >
          <Ionicons name="send" size={18} color={THEME.color.white} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  )
}
