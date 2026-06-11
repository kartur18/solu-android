import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar, Animated, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIO_TO_OFICIO } from '../src/lib/constants'
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

// ── Typing indicator: 3 puntos animados ──

function TypingDots() {
  const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [dots])

  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: COLORS.white, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', gap: 5 }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gray2, opacity: v }} />
      ))}
    </View>
  )
}

// ── Card de técnico inline en el chat ──

function TechInlineCard({ tech, servicio }: { tech: TechSuggestion; servicio: string | null }) {
  const router = useRouter()
  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {tech.foto_url ? (
          <Image source={{ uri: optimizeUrl(tech.foto_url, { width: 48, height: 48 }) }} style={{ width: 48, height: 48, borderRadius: 14 }} />
        ) : (
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.charAt(0) || 'T'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }} numberOfLines={1}>{tech.nombre}</Text>
            {tech.verificado && <Ionicons name="checkmark-circle" size={14} color={COLORS.acc} />}
          </View>
          <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 1 }} numberOfLines={1}>
            {tech.oficio || servicio || 'Técnico'}{tech.distrito ? ` · ${tech.distrito}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Ionicons name="star" size={12} color={COLORS.yellow} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.dark }}>{(tech.calificacion ?? 0).toFixed(1)}</Text>
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>({tech.num_resenas ?? 0} reseñas)</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => router.push(`/tecnico/${tech.id}`)}
          activeOpacity={0.8}
          style={{ flex: 1, minHeight: 44, backgroundColor: COLORS.light, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}
        >
          <Ionicons name="person-outline" size={15} color={COLORS.dark} />
          <Text style={{ color: COLORS.dark, fontWeight: '700', fontSize: 12 }}>Ver perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity
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
          activeOpacity={0.8}
          style={{ flex: 1, minHeight: 44, backgroundColor: COLORS.pri, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}
        >
          <Ionicons name="flash" size={15} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12 }}>Contactar</Text>
        </TouchableOpacity>
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
        .ilike('oficio', `%${term}%`)
        .order('calificacion', { ascending: false })
        .limit(3)
      let techs = (data as TechSuggestion[] | null) ?? []
      if (!techs.length) {
        const { data: fallback } = await supabase
          .from('tecnicos')
          .select(cols)
          .eq('disponible', true)
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
        body: JSON.stringify({
          nombre: data.nombre,
          whatsapp: data.whatsapp,
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
        if (Array.isArray(body?.tecnicos)) techs = body.tecnicos as TechSuggestion[]
      } catch {}

      saveProfile({ nombre: data.nombre, whatsapp: data.whatsapp, distrito: data.distrito, lastServicio: data.servicio })
      lastServicioRef.current = data.servicio

      if (!techs.length) techs = await loadTechs(data.servicio)

      removeItem(confirmItemId)
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.light }} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.dark, padding: 16, paddingTop: (StatusBar.currentHeight || 40) + 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(242,107,33,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={19} color={COLORS.pri} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>Asistente SOLU</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Te conecto con un técnico en minutos</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green }} />
          <Text style={{ color: COLORS.green, fontSize: 10, fontWeight: '700' }}>En línea</Text>
        </View>
      </View>

      {/* Mensajes */}
      <ScrollView ref={scrollRef} style={{ flex: 1, padding: 12 }} contentContainerStyle={{ gap: 8, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        {items.map((it) => {
          if (it.kind === 'msg') {
            return (
              <View key={it.id} style={{ alignSelf: it.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <View
                  style={{
                    backgroundColor: it.role === 'user' ? COLORS.pri : COLORS.white,
                    borderRadius: 16,
                    borderBottomRightRadius: it.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius: it.role === 'assistant' ? 4 : 16,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderWidth: it.role === 'assistant' ? 1 : 0,
                    borderColor: '#E2E8F0',
                    elevation: 1,
                  }}
                >
                  <Text style={{ fontSize: 13.5, color: it.role === 'user' ? COLORS.white : COLORS.dark, lineHeight: 20 }}>{it.content}</Text>
                </View>
              </View>
            )
          }

          if (it.kind === 'confirm') {
            return (
              <View key={it.id} style={{ backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.pri, padding: 14, maxWidth: '92%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="clipboard-outline" size={16} color={COLORS.pri} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.dark }}>Confirma tu solicitud</Text>
                </View>
                <Text style={{ fontSize: 12.5, color: COLORS.dark, lineHeight: 19 }}>
                  🔧 {it.data.servicio}{'\n'}📍 {it.data.distrito}{'\n'}👤 {it.data.nombre}{'\n'}📱 {it.data.whatsapp}{'\n'}{urgenciaLabel(it.data.urgencia)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleConfirm(it.data, it.id)}
                  disabled={submitting}
                  activeOpacity={0.8}
                  style={{ marginTop: 12, minHeight: 46, backgroundColor: COLORS.green, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: submitting ? 0.6 : 1 }}
                >
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                  <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>{submitting ? 'Enviando...' : 'Confirmar solicitud'}</Text>
                </TouchableOpacity>
              </View>
            )
          }

          if (it.kind === 'success') {
            return (
              <View key={it.id} style={{ backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0', padding: 14, maxWidth: '92%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#059669' }}>Solicitud creada{it.codigo ? ` · ${it.codigo}` : ''}</Text>
                </View>
                {it.codigo && (
                  <TouchableOpacity
                    onPress={() => router.push(`/tracking/${it.codigo}`)}
                    activeOpacity={0.8}
                    style={{ marginTop: 10, minHeight: 44, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                  >
                    <Ionicons name="navigate-outline" size={15} color="#059669" />
                    <Text style={{ color: '#059669', fontWeight: '700', fontSize: 13 }}>Ver seguimiento</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }

          if (it.kind === 'techs') {
            return (
              <View key={it.id} style={{ width: '100%' }}>
                {it.techs.map((t) => (
                  <TechInlineCard key={t.id} tech={t} servicio={lastServicioRef.current} />
                ))}
              </View>
            )
          }

          // kind === 'error'
          return (
            <View key={it.id} style={{ backgroundColor: '#FEF2F2', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', padding: 14, maxWidth: '92%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Ionicons name="cloud-offline-outline" size={16} color={COLORS.red} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12.5, color: COLORS.dark, lineHeight: 19 }}>{it.text}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {it.retry && (
                  <TouchableOpacity
                    onPress={() => handleRetry(it)}
                    activeOpacity={0.8}
                    style={{ flex: 1, minHeight: 44, backgroundColor: COLORS.pri, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}
                  >
                    <Ionicons name="refresh" size={15} color={COLORS.white} />
                    <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12 }}>Reintentar</Text>
                  </TouchableOpacity>
                )}
                {it.servicio && (
                  <TouchableOpacity
                    onPress={() => goSolicitar(it.servicio!, it.urgencia)}
                    activeOpacity={0.8}
                    style={{ flex: 1, minHeight: 44, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}
                  >
                    <Ionicons name="flash" size={15} color={COLORS.pri} />
                    <Text style={{ color: COLORS.pri, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>Solicitar técnico</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        })}

        {loading && <TypingDots />}

        {showChips && !loading && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                onPress={() => handleSend(chip)}
                activeOpacity={0.8}
                style={{ backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 12, color: COLORS.dark, fontWeight: '600' }}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={{ flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'android' ? 56 : 12, gap: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: COLORS.white }}>
        <TextInput
          style={{ flex: 1, backgroundColor: COLORS.light, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, color: COLORS.dark }}
          placeholder="Cuéntame qué necesitas..."
          placeholderTextColor={COLORS.gray2}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          editable={!loading}
          returnKeyType="send"
          multiline={false}
          maxLength={2000}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.pri, alignItems: 'center', justifyContent: 'center', opacity: loading || !input.trim() ? 0.5 : 1 }}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
