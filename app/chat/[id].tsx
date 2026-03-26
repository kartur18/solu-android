import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { OfflineBanner } from '../../src/components/OfflineBanner'

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
  const flatListRef = useRef<FlatList>(null)

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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [solicitudId])

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
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <View style={{ backgroundColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>
                {formatDateHeader(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        <View style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '78%',
          marginBottom: 6,
          marginHorizontal: 12,
        }}>
          <View style={{
            backgroundColor: mine ? '#1E3A5F' : '#fff',
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
            elevation: mine ? 0 : 1,
          }}>
            <Text style={{
              fontSize: 14,
              color: mine ? '#fff' : COLORS.dark,
              lineHeight: 20,
            }}>
              {item.mensaje}
            </Text>
          </View>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
            alignSelf: mine ? 'flex-end' : 'flex-start',
            paddingHorizontal: 4,
          }}>
            <Text style={{ fontSize: 10, color: COLORS.gray2 }}>
              {formatTime(item.created_at)}
            </Text>
            {mine && (
              <Ionicons
                name={item.leido ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={item.leido ? '#2563EB' : COLORS.gray2}
              />
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#F1F5F9' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <OfflineBanner />
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#1E3A5F" />
            <Text style={{ marginTop: 10, fontSize: 12, color: COLORS.gray }}>Cargando mensajes...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.gray2} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.dark, marginTop: 12 }}>
                  Sin mensajes aun
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>
                  Envia el primer mensaje para iniciar la conversacion
                </Text>
              </View>
            }
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
          />
        )}

        {/* Input bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          padding: 10,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          gap: 8,
        }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={COLORS.gray2}
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: '#F1F5F9',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 14,
              maxHeight: 100,
              color: COLORS.dark,
            }}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: text.trim() ? '#1E3A5F' : '#CBD5E1',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}
