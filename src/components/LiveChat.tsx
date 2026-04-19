import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { COLORS } from '../lib/constants'
import { logger } from '../lib/logger'

interface Message {
  id: number
  codigo_solicitud: string
  remitente: 'cliente' | 'tecnico'
  mensaje: string
  leido: boolean
  created_at: string
}

interface Props {
  codigo: string
  as: 'cliente' | 'tecnico'
  techNombre?: string
}

/**
 * Internal chat between cliente and técnico for a specific pedido.
 * Uses Supabase Realtime on chat_mensajes (see migration 20260418_live_tracking_and_chat.sql).
 */
export function LiveChat({ codigo, as, techNombre }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('chat_mensajes')
        .select('*')
        .eq('codigo_solicitud', codigo)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])
    } catch (err) {
      logger.error('Chat load error:', err)
    }
  }, [codigo])

  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${codigo}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_mensajes',
        filter: `codigo_solicitud=eq.${codigo}`,
      }, (payload) => {
        const m = payload.new as Message
        setMessages((prev) => prev.some((p) => p.id === m.id) ? prev : [...prev, m])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [codigo])

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
  }, [messages.length])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const tempId = -Date.now()
    const optimistic: Message = {
      id: tempId, codigo_solicitud: codigo, remitente: as,
      mensaje: text, leido: false, created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const { data } = await supabase
        .from('chat_mensajes')
        .insert({ codigo_solicitud: codigo, remitente: as, mensaje: text, leido: false })
        .select()
        .single()
      if (data) setMessages((prev) => prev.map((m) => m.id === tempId ? (data as Message) : m))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.light }}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 20, gap: 6 }}
        renderItem={({ item }) => {
          const mine = item.remitente === as
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <View style={{
                backgroundColor: mine ? COLORS.pri : COLORS.white,
                borderRadius: 14,
                borderBottomRightRadius: mine ? 4 : 14,
                borderBottomLeftRadius: mine ? 14 : 4,
                paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: mine ? 0 : 1,
                borderColor: COLORS.border,
              }}>
                <Text style={{ color: mine ? '#fff' : COLORS.dark, fontSize: 13, lineHeight: 18 }}>{item.mensaje}</Text>
              </View>
              <Text style={{ fontSize: 9, color: COLORS.gray2, textAlign: mine ? 'right' : 'left', marginTop: 2 }}>
                {new Date(item.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="chatbubbles-outline" size={36} color={COLORS.gray2} />
            <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 8, textAlign: 'center' }}>
              No hay mensajes aún{'\n'}Empieza la conversación{techNombre ? ` con ${techNombre}` : ''}
            </Text>
          </View>
        }
      />
      <View style={{ flexDirection: 'row', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={COLORS.gray2}
          style={{ flex: 1, backgroundColor: COLORS.light, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.border }}
          multiline
          maxLength={500}
          onSubmitEditing={send}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!input.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pri,
            alignItems: 'center', justifyContent: 'center',
            opacity: !input.trim() || sending ? 0.5 : 1,
          }}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
