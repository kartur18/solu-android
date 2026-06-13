import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Text, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import { logger } from '../lib/logger'
import { AudioMessageBubble } from './AudioMessageBubble'
import { ChatInputBar } from './ChatInputBar'
import {
  isAudioChatAvailable, startRecording, stopRecording, uploadChatAudio,
  type ExpoRecording,
} from '../lib/audioChat'
import {
  fetchMensajes, sendMensaje, getTechToken, ChatApiError,
  type ChatMensaje, type AttachmentMeta,
} from '../lib/chat-api'

interface Message extends ChatMensaje {
  // Solo local: marca el mensaje optimista mientras sube el audio
  uploading?: boolean
}

const MIN_AUDIO_MS = 1000
const POLL_MS = 3000

interface Props {
  codigo: string
  as: 'cliente' | 'tecnico'
  techNombre?: string
  // Token HMAC del cliente guest (tracking). El técnico autentica con Bearer.
  chatToken?: string
}

/**
 * Chat interno cliente↔técnico de un pedido. Lee/escribe vía los endpoints
 * server-side (/api/chat/...) con polling cada 3s (sin Realtime, igual que la
 * web) tras el lockdown de seguridad que cerró el acceso anon a chat_mensajes.
 */
export function LiveChat({ codigo, as, techNombre, chatToken }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [coinsError, setCoinsError] = useState<{ costo?: number; saldo?: number } | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingMs, setRecordingMs] = useState(0)
  const [sendingAudio, setSendingAudio] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const listRef = useRef<FlatList<Message>>(null)
  const recordingRef = useRef<ExpoRecording | null>(null)
  const recordStartRef = useRef(0)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioAvailable = useMemo(() => isAudioChatAvailable(), [])
  // Token del técnico cacheado (lo emite el login y vive en AsyncStorage).
  const techTokenRef = useRef<string | null>(null)

  // Resuelve la auth según el rol: técnico → Bearer; cliente → chatToken.
  const getAuth = useCallback(async (): Promise<{ token?: string | null; chatToken?: string | null }> => {
    if (as === 'tecnico') {
      if (!techTokenRef.current) techTokenRef.current = await getTechToken()
      return { token: techTokenRef.current }
    }
    return { chatToken }
  }, [as, chatToken])

  // Fusiona los mensajes del server conservando los optimistas locales (id<0)
  // que todavía no llegaron en la respuesta (evita parpadeo en el polling).
  const mergeServer = useCallback((server: Message[]) => {
    setMessages((prev) => {
      const pending = prev.filter((m) => m.id < 0 && !server.some((s) => s.mensaje === m.mensaje && s.remitente === m.remitente))
      return [...server, ...pending]
    })
  }, [])

  const loadMessages = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    try {
      const auth = await getAuth()
      const data = await fetchMensajes({ codigo, ...auth })
      mergeServer(data as Message[])
      setLoadError(false)
    } catch (err) {
      logger.error('Chat load error:', err)
      // Solo marcamos error si no hay nada cargado; en polling silencioso lo ignoramos.
      if (showSpinner) setLoadError(true)
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [codigo, getAuth, mergeServer])

  // Carga inicial + refresco al montar.
  useEffect(() => { loadMessages(true) }, [loadMessages])

  // Polling cada 3s (sin Realtime). Cleanup al desmontar.
  useEffect(() => {
    const id = setInterval(() => { loadMessages(false) }, POLL_MS)
    return () => clearInterval(id)
  }, [loadMessages])

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
  }, [messages.length])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    setCoinsError(null)
    const tempId = -Date.now()
    const optimistic: Message = {
      id: tempId, codigo_solicitud: codigo, remitente: as,
      mensaje: text, leido: false, created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const auth = await getAuth()
      const saved = await sendMensaje({ codigo, mensaje: text, ...auth })
      setMessages((prev) => prev.map((m) => m.id === tempId ? (saved as Message) : m))
    } catch (err) {
      // Restaurar el texto para que el usuario no lo pierda
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setInput(text)
      if (err instanceof ChatApiError && err.status === 402) {
        setCoinsError({ costo: err.costo, saldo: err.saldoActual })
      } else if (err instanceof ChatApiError && err.status === 403) {
        setMicError('Tu cuenta está temporalmente restringida. Contacta a soporte.')
      } else {
        logger.error('Chat send error:', err)
        setMicError('No pudimos enviar tu mensaje. Revisa tu conexión e intenta de nuevo.')
      }
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
      const meta: AttachmentMeta = { mime: upload.mime, size_bytes: upload.sizeBytes, duration_ms: durationMs }
      const auth = await getAuth()
      const saved = await sendMensaje({
        codigo, mensaje: '', ...auth,
        tipo: 'audio', attachmentUrl: upload.url, attachmentMeta: meta,
      })
      setMessages((prev) => prev.map((m) => m.id === tempId ? (saved as Message) : m))
    } catch (err) {
      logger.error('Audio send error:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      if (err instanceof ChatApiError && err.status === 402) {
        setCoinsError({ costo: err.costo, saldo: err.saldoActual })
      } else {
        setMicError('No pudimos enviar tu nota de voz. Revisa tu conexión e intenta de nuevo.')
      }
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
          loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="small" color={COLORS.pri} />
              <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 8 }}>Cargando mensajes…</Text>
            </View>
          ) : loadError ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="cloud-offline-outline" size={36} color={COLORS.gray2} />
              <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 8, textAlign: 'center' }}>
                No pudimos cargar el chat
              </Text>
              <TouchableOpacity
                onPress={() => loadMessages(true)}
                accessibilityLabel="Reintentar carga del chat"
                style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.pri }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="chatbubbles-outline" size={36} color={COLORS.gray2} />
              <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 8, textAlign: 'center' }}>
                No hay mensajes aún{'\n'}Empieza la conversación{techNombre ? ` con ${techNombre}` : ''}
              </Text>
            </View>
          )
        }
      />
      {coinsError && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.priLight, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <Ionicons name="cash-outline" size={20} color={COLORS.pri} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>Necesitas coins para responder</Text>
            <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 1 }}>
              {coinsError.costo != null
                ? `Cuesta ${coinsError.costo} coins${coinsError.saldo != null ? ` · tienes ${coinsError.saldo}` : ''}. Compra coins en tu cuenta.`
                : 'Compra coins en tu cuenta para iniciar este chat.'}
            </Text>
          </View>
          <TouchableOpacity accessibilityLabel="Cerrar aviso de coins" onPress={() => setCoinsError(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      )}
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
