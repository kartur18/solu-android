import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer } from '../../src/components/ui/Motion'
import {
  fetchMensajes, sendMensaje, getTechToken, fetchChatToken, ChatApiError,
  type ChatMensaje,
} from '../../src/lib/chat-api'
import { useClientProfile } from '../../src/lib/useClientProfile'
import { logger } from '../../src/lib/logger'

const POLL_MS = 3000

// id<0 marca mensajes optimistas locales aún no confirmados por el server.
type Mensaje = ChatMensaje

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id: string
    codigo?: string
    techName: string
    clientName: string
    senderType: string
    token?: string
  }>()

  // El chat ahora se identifica por código de pedido (endpoint /chat/{code}).
  // Compat: si no llega `codigo`, usamos el `id` de la ruta como código.
  const codigo = (params.codigo || params.id || '').trim()
  const techName = params.techName || 'Tecnico'
  const clientName = params.clientName || 'Cliente'
  const senderType: 'cliente' | 'tecnico' = params.senderType === 'tecnico' ? 'tecnico' : 'cliente'
  const { profile } = useClientProfile()
  // El cliente guest necesita un chatToken HMAC. Si no vino por param, lo
  // resolvemos con su WhatsApp del perfil. El técnico usa su Bearer.
  const [chatToken, setChatToken] = useState<string | undefined>(params.token)
  useEffect(() => {
    if (params.token) { setChatToken(params.token); return }
    if (senderType === 'cliente' && codigo && profile?.whatsapp) {
      fetchChatToken(codigo, profile.whatsapp).then((t) => { if (t) setChatToken(t) })
    }
  }, [codigo, params.token, senderType, profile?.whatsapp])

  const [messages, setMessages] = useState<Mensaje[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [sending, setSending] = useState(false)
  const [coinsError, setCoinsError] = useState<{ costo?: number; saldo?: number } | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const techTokenRef = useRef<string | null>(null)

  const headerTitle = senderType === 'cliente'
    ? `Chat con ${techName}`
    : `Chat con ${clientName}`

  // Auth según rol: técnico → Bearer (AsyncStorage); cliente → chatToken.
  const getAuth = useCallback(async (): Promise<{ token?: string | null; chatToken?: string | null }> => {
    if (senderType === 'tecnico') {
      if (!techTokenRef.current) techTokenRef.current = await getTechToken()
      return { token: techTokenRef.current }
    }
    return { chatToken }
  }, [senderType, chatToken])

  // Fusiona server + optimistas locales no confirmados (evita parpadeo polling).
  const mergeServer = useCallback((server: Mensaje[]) => {
    setMessages((prev) => {
      const pending = prev.filter((m) => m.id < 0 && !server.some((s) => s.mensaje === m.mensaje && s.remitente === m.remitente))
      return [...server, ...pending]
    })
  }, [])

  const loadMessages = useCallback(async (showSpinner: boolean) => {
    if (!codigo) { setLoading(false); setLoadError(true); return }
    if (showSpinner) setLoading(true)
    try {
      const auth = await getAuth()
      const data = await fetchMensajes({ codigo, ...auth })
      mergeServer(data as Mensaje[])
      setLoadError(false)
    } catch (err) {
      logger.warn('Error loading messages:', err)
      if (showSpinner) setLoadError(true)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [codigo, getAuth, mergeServer])

  useEffect(() => { loadMessages(true) }, [loadMessages])

  // Polling cada 3s en vez de Realtime (cerrado por el lockdown).
  useEffect(() => {
    const intervalId = setInterval(() => { loadMessages(false) }, POLL_MS)
    return () => clearInterval(intervalId)
  }, [loadMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length])

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    // Optimistic: add message locally with temp ID
    const tempId = -(Date.now())
    const optimisticMsg: Mensaje = {
      id: tempId,
      codigo_solicitud: codigo,
      remitente: senderType,
      mensaje: trimmed,
      leido: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setText('')
    setSending(true)
    setCoinsError(null)

    try {
      const auth = await getAuth()
      const saved = await sendMensaje({ codigo, mensaje: trimmed, ...auth })
      setMessages((prev) => prev.map((m) => m.id === tempId ? (saved as Mensaje) : m))
    } catch (err) {
      // Remove optimistic message and restore text on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setText(trimmed)
      if (err instanceof ChatApiError && err.status === 402) {
        setCoinsError({ costo: err.costo, saldo: err.saldoActual })
      } else {
        logger.warn('Error sending message:', err)
      }
    } finally {
      setSending(false)
    }
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateHeader(dateStr: string): string {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Hoy'
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
  }

  function shouldShowDateHeader(index: number): boolean {
    if (index === 0) return true
    const current = new Date(messages[index].created_at).toDateString()
    const prev = new Date(messages[index - 1].created_at).toDateString()
    return current !== prev
  }

  const isMine = (msg: Mensaje) => msg.remitente === senderType

  const renderMessage = ({ item, index }: { item: Mensaje; index: number }) => {
    const mine = isMine(item)
    const showDate = shouldShowDateHeader(index)

    return (
      <View>
        {showDate && (
          <View style={{ alignItems: 'center', marginVertical: THEME.space.md }}>
            <View style={{ backgroundColor: THEME.color.surfaceSunken, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs }}>
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft }}>
                {formatDateHeader(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        <FadeInUp distance={8} style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          marginBottom: THEME.space.xs + 2,
          marginHorizontal: THEME.space.md,
        }}>
          <View style={{
            backgroundColor: mine ? THEME.color.brand : THEME.color.surface,
            borderRadius: THEME.radius.xl,
            borderBottomRightRadius: mine ? THEME.radius.sm : THEME.radius.xl,
            borderBottomLeftRadius: mine ? THEME.radius.xl : THEME.radius.sm,
            paddingHorizontal: THEME.space.lg,
            paddingVertical: THEME.space.md,
            ...(mine ? THEME.shadow.brand : THEME.shadow.sm),
          }}>
            <Text style={{
              ...THEME.font.body,
              color: mine ? THEME.color.white : THEME.color.ink,
              lineHeight: 21,
            }}>
              {item.mensaje}
            </Text>
          </View>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: THEME.space.xs,
            marginTop: 3,
            alignSelf: mine ? 'flex-end' : 'flex-start',
            paddingHorizontal: THEME.space.xs,
          }}>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>
              {formatTime(item.created_at)}
            </Text>
            {mine && (
              <Ionicons
                name={item.leido ? 'checkmark-done' : 'checkmark'}
                size={13}
                color={item.leido ? THEME.color.info : THEME.color.inkMuted}
              />
            )}
          </View>
        </FadeInUp>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <OfflineBanner />
        {loading ? (
          <View style={{ flex: 1, paddingHorizontal: THEME.space.md, paddingTop: THEME.space.xl, gap: THEME.space.md }}>
            {[
              { mine: false, w: '64%' as const },
              { mine: true, w: '52%' as const },
              { mine: false, w: '72%' as const },
              { mine: true, w: '44%' as const },
              { mine: false, w: '58%' as const },
            ].map((s, i) => (
              <Shimmer
                key={i}
                style={{
                  alignSelf: s.mine ? 'flex-end' : 'flex-start',
                  width: s.w,
                  height: 46,
                  borderRadius: THEME.radius.xl,
                }}
              />
            ))}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: THEME.space.md, flexGrow: 1 }}
            ListEmptyComponent={
              loadError ? (
                <FadeInUp delay={80} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxxl }}>
                  <View style={{ width: 76, height: 76, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
                    <Ionicons name="cloud-offline-outline" size={38} color={THEME.color.inkMuted} />
                  </View>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>
                    No pudimos cargar el chat
                  </Text>
                  <PressableScale
                    onPress={() => loadMessages(true)}
                    accessibilityLabel="Reintentar carga del chat"
                    style={{ marginTop: THEME.space.lg, minHeight: 44, paddingHorizontal: THEME.space.xl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
                  >
                    <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Reintentar</Text>
                  </PressableScale>
                </FadeInUp>
              ) : (
                <FadeInUp delay={80} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxxl }}>
                  <View style={{ width: 76, height: 76, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
                    <Ionicons name="chatbubbles-outline" size={38} color={THEME.color.brand} />
                  </View>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>
                    Sin mensajes aún
                  </Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs, lineHeight: 19 }}>
                    Envía el primer mensaje para iniciar la conversación
                  </Text>
                </FadeInUp>
              )
            }
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
          />
        )}

        {/* Aviso sin coins (1er mensaje del técnico en un lead) */}
        {coinsError && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, backgroundColor: THEME.color.brandLight, borderTopWidth: 1, borderTopColor: THEME.color.line }}>
            <Ionicons name="cash-outline" size={20} color={THEME.color.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>Necesitas coins para responder</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 1 }}>
                {coinsError.costo != null
                  ? `Cuesta ${coinsError.costo} coins${coinsError.saldo != null ? ` · tienes ${coinsError.saldo}` : ''}. Compra coins en tu cuenta.`
                  : 'Compra coins en tu cuenta para iniciar este chat.'}
              </Text>
            </View>
            <TouchableOpacity accessibilityLabel="Cerrar aviso de coins" onPress={() => setCoinsError(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color={THEME.color.inkMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick replies */}
        {senderType === 'tecnico' && !text.trim() && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: THEME.color.surface, paddingVertical: THEME.space.sm, paddingHorizontal: THEME.space.md, ...THEME.shadow.sm }} contentContainerStyle={{ gap: THEME.space.sm }}>
            {['Estoy en camino 🚗', 'Llego en 15 min', 'Ya llegué ✅', 'Te paso mi cotización', 'Necesito ver el problema primero', 'Cuéntame más del trabajo', '¿A qué hora te conviene?', 'Gracias por tu confianza 🙏'].map(msg => (
              <PressableScale key={msg} onPress={() => { setText(msg); }} style={{ backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, minHeight: 36, justifyContent: 'center' }}>
                <Text style={{ ...THEME.font.label, color: THEME.color.brandDark }}>{msg}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          padding: THEME.space.md,
          paddingBottom: Platform.OS === 'ios' ? THEME.space.xxl : THEME.space.md,
          backgroundColor: THEME.color.surface,
          gap: THEME.space.sm,
          ...THEME.shadow.lg,
        }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={THEME.color.inkMuted}
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: THEME.color.surfaceAlt,
              borderRadius: THEME.radius.xl,
              paddingHorizontal: THEME.space.lg,
              paddingVertical: THEME.space.md,
              ...THEME.font.body,
              maxHeight: 100,
              color: THEME.color.ink,
            }}
          />
          <PressableScale
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            accessibilityLabel="Enviar mensaje"
            style={{
              width: 48,
              height: 48,
              borderRadius: THEME.radius.full,
              backgroundColor: text.trim() ? THEME.color.brand : THEME.color.inkMuted,
              alignItems: 'center',
              justifyContent: 'center',
              ...(text.trim() ? THEME.shadow.brand : {}),
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={THEME.color.white} />
            ) : (
              <Ionicons name="send" size={18} color={THEME.color.white} />
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}
