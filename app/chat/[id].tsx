import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer } from '../../src/components/ui/Motion'

interface Mensaje {
  id: number
  solicitud_id: number
  sender_type: string
  sender_id: number
  mensaje: string
  leido: boolean
  created_at: string
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id: string
    techId: string
    techName: string
    clientName: string
    senderType: string
    senderId: string
  }>()

  const solicitudId = Number(params.id)
  const techName = params.techName || 'Tecnico'
  const clientName = params.clientName || 'Cliente'
  const senderType = params.senderType || 'cliente'
  const senderId = Number(params.senderId) || 0

  const [messages, setMessages] = useState<Mensaje[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const headerTitle = senderType === 'cliente'
    ? `Chat con ${techName}`
    : `Chat con ${clientName}`

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('mensajes')
        .select('*')
        .eq('solicitud_id', solicitudId)
        .order('created_at', { ascending: true })
      setMessages(data || [])
    } catch (err) {
      console.warn('Error loading messages:', err)
    } finally {
      setLoading(false)
    }
  }, [solicitudId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${solicitudId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `solicitud_id=eq.${solicitudId}`,
      }, (payload) => {
        const newMsg = payload.new as Mensaje
        setMessages((prev) => {
          // Avoid duplicates (by real ID or matching optimistic messages)
          if (prev.some((m) => m.id === newMsg.id)) return prev
          // Replace optimistic message (negative ID, same text) with real one
          const optimisticIdx = prev.findIndex(
            (m) => m.id < 0 && m.mensaje === newMsg.mensaje && m.sender_type === newMsg.sender_type
          )
          if (optimisticIdx >= 0) {
            const updated = [...prev]
            updated[optimisticIdx] = newMsg
            return updated
          }
          return [...prev, newMsg]
        })
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.sender !== senderType) {
          setOtherTyping(true)
          if (typingTimeout.current) clearTimeout(typingTimeout.current)
          typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
    }
  }, [solicitudId, senderType])

  // Send typing indicator when user types
  function handleTextChange(value: string) {
    setText(value)
    supabase.channel(`chat-${solicitudId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender: senderType },
    }).catch(() => {})
  }

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length])

  // Mark messages as read
  useEffect(() => {
    if (messages.length === 0) return
    const otherType = senderType === 'cliente' ? 'tecnico' : 'cliente'
    const unread = messages.filter((m) => m.sender_type === otherType && !m.leido)
    if (unread.length > 0) {
      supabase
        .from('mensajes')
        .update({ leido: true })
        .eq('solicitud_id', solicitudId)
        .eq('sender_type', otherType)
        .eq('leido', false)
        .then(({ error }) => {
          if (error) console.warn('Error marking messages as read:', error)
        })
    }
  }, [messages, senderType, solicitudId])

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    // Optimistic: add message locally with temp ID
    const tempId = -(Date.now())
    const optimisticMsg: Mensaje = {
      id: tempId,
      solicitud_id: solicitudId,
      sender_type: senderType,
      sender_id: senderId,
      mensaje: trimmed,
      leido: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setText('')
    setSending(true)

    try {
      const { data, error } = await supabase.from('mensajes').insert({
        solicitud_id: solicitudId,
        sender_type: senderType,
        sender_id: senderId,
        mensaje: trimmed,
      }).select('id').single()

      if (error) {
        // Remove optimistic message and restore text on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setText(trimmed)
        console.warn('Error sending message:', error)
      } else if (data) {
        // Replace temp ID with real ID (realtime may also deliver it)
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: data.id } : m))
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setText(trimmed)
      console.warn('Error sending message:', err)
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

  const isMine = (msg: Mensaje) => msg.sender_type === senderType

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
            }
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
          />
        )}

        {/* Typing indicator */}
        {otherTyping && (
          <View style={{ paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.sm, flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{
                  width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.color.inkMuted,
                  opacity: 0.6,
                }} />
              ))}
            </View>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, fontStyle: 'italic' }}>escribiendo...</Text>
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
            onChangeText={handleTextChange}
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
