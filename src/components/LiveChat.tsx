import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Text, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { COLORS } from '../lib/constants'
import { logger } from '../lib/logger'
import { AudioMessageBubble } from './AudioMessageBubble'
import { ChatInputBar } from './ChatInputBar'
import {
  isAudioChatAvailable, startRecording, stopRecording, uploadChatAudio,
  type ExpoRecording,
} from '../lib/audioChat'

interface AttachmentMeta {
  mime?: string
  size_bytes?: number
  duration_ms?: number
}

interface Message {
  id: number
  codigo_solicitud: string
  remitente: 'cliente' | 'tecnico'
  mensaje: string
  leido: boolean
  created_at: string
  tipo?: 'text' | 'audio' | 'image' | 'cotizacion'
  attachment_url?: string | null
  attachment_meta?: AttachmentMeta | null
  // Solo local: marca el mensaje optimista mientras sube el audio
  uploading?: boolean
}

const MIN_AUDIO_MS = 1000

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
  const [recording, setRecording] = useState(false)
  const [recordingMs, setRecordingMs] = useState(0)
  const [sendingAudio, setSendingAudio] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const listRef = useRef<FlatList<Message>>(null)
  const recordingRef = useRef<ExpoRecording | null>(null)
  const recordStartRef = useRef(0)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioAvailable = useMemo(() => isAudioChatAvailable(), [])

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
      // Restaurar el texto para que el usuario no lo pierda
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const clearRecordTimer = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }, [])

  // Descartar grabación en curso si el chat se desmonta
  useEffect(() => {
    return () => {
      clearRecordTimer()
      if (recordingRef.current) stopRecording(recordingRef.current).catch(() => {})
    }
  }, [clearRecordTimer])

  async function startRec() {
    if (recording || sendingAudio) return
    setMicError(null)
    try {
      const rec = await startRecording()
      if (!rec) return
      recordingRef.current = rec
      recordStartRef.current = Date.now()
      setRecordingMs(0)
      setRecording(true)
      recordTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recordStartRef.current)
      }, 250)
    } catch (err) {
      if (err instanceof Error && err.message === 'mic-denied') {
        setMicError('Necesitamos acceso a tu micrófono para enviar notas de voz. Actívalo en Ajustes.')
      } else {
        logger.error('Record start error:', err)
        setMicError('No pudimos iniciar la grabación. Intenta de nuevo.')
      }
    }
  }

  async function cancelRec() {
    clearRecordTimer()
    setRecording(false)
    const rec = recordingRef.current
    recordingRef.current = null
    if (rec) await stopRecording(rec).catch(() => {})
  }

  async function stopAndSendRec() {
    clearRecordTimer()
    setRecording(false)
    const rec = recordingRef.current
    recordingRef.current = null
    if (!rec) return
    const durationMs = Date.now() - recordStartRef.current
    const uri = await stopRecording(rec).catch(() => null)
    if (!uri || durationMs < MIN_AUDIO_MS) {
      setMicError('El audio fue muy corto. Mantén la grabación al menos 1 segundo.')
      return
    }
    setSendingAudio(true)
    const tempId = -Date.now()
    const optimistic: Message = {
      id: tempId, codigo_solicitud: codigo, remitente: as,
      mensaje: '', leido: false, created_at: new Date().toISOString(),
      tipo: 'audio', attachment_url: uri,
      attachment_meta: { mime: 'audio/mp4', duration_ms: durationMs },
      uploading: true,
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const upload = await uploadChatAudio(codigo, as, uri)
      if (!upload) throw new Error('audio-upload-failed')
      const { data, error } = await supabase
        .from('chat_mensajes')
        .insert({
          codigo_solicitud: codigo, remitente: as, mensaje: '', leido: false,
          tipo: 'audio', attachment_url: upload.url,
          attachment_meta: { mime: upload.mime, size_bytes: upload.sizeBytes, duration_ms: durationMs },
        })
        .select()
        .single()
      if (error) throw error
      if (data) setMessages((prev) => prev.map((m) => m.id === tempId ? (data as Message) : m))
    } catch (err) {
      logger.error('Audio send error:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setMicError('No pudimos enviar tu nota de voz. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSendingAudio(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={{ flex: 1, backgroundColor: COLORS.light }}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 20, gap: 6 }}
        renderItem={({ item }) => {
          const mine = item.remitente === as
          const isAudio = item.tipo === 'audio' && !!item.attachment_url
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', minWidth: isAudio ? 200 : undefined }}>
              <View style={{
                backgroundColor: mine ? COLORS.pri : COLORS.white,
                borderRadius: 14,
                borderBottomRightRadius: mine ? 4 : 14,
                borderBottomLeftRadius: mine ? 14 : 4,
                paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: mine ? 0 : 1,
                borderColor: COLORS.border,
              }}>
                {isAudio && item.uploading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 170, paddingVertical: 6 }}>
                    <ActivityIndicator size="small" color={mine ? '#fff' : COLORS.pri} />
                    <Text style={{ color: mine ? 'rgba(255,255,255,0.9)' : COLORS.gray, fontSize: 12 }}>Enviando nota de voz…</Text>
                  </View>
                ) : isAudio ? (
                  <AudioMessageBubble
                    url={item.attachment_url as string}
                    durationMs={item.attachment_meta?.duration_ms}
                    mine={mine}
                  />
                ) : (
                  <Text style={{ color: mine ? '#fff' : COLORS.dark, fontSize: 13, lineHeight: 18 }}>{item.mensaje}</Text>
                )}
                {isAudio && !!item.mensaje && (
                  <Text style={{ color: mine ? '#fff' : COLORS.dark, fontSize: 12, lineHeight: 16, marginTop: 4 }}>{item.mensaje}</Text>
                )}
              </View>
              <Text style={{ fontSize: 10, color: COLORS.gray2, textAlign: mine ? 'right' : 'left', marginTop: 2 }}>
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
      <ChatInputBar
        input={input}
        onChangeInput={setInput}
        onSend={send}
        sending={sending}
        audioAvailable={audioAvailable}
        recording={recording}
        recordingMs={recordingMs}
        sendingAudio={sendingAudio}
        micError={micError}
        onDismissMicError={() => setMicError(null)}
        onStartRecording={startRec}
        onCancelRecording={cancelRec}
        onSendRecording={stopAndSendRec}
      />
    </KeyboardAvoidingView>
  )
}
