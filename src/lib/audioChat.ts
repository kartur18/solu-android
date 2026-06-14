/**
 * Notas de voz para el chat cliente↔técnico (paridad con el chat web).
 *
 * Audio en el chat cliente-tecnico. expo-av (instalado, SDK 55) graba en
 * m4a/AAC y reproduce los audios del chat. Si el modulo faltara en un
 * build raro, isAudioChatAvailable() devuelve false y la UI oculta el
 * boton de microfono (degradacion limpia, sin crash).
 *
 * Contrato del chat web (bucket privado 'chat-attachments' en Supabase):
 * - path: {codigo}/{cliente|tecnico}-{timestamp}-{random}.m4a
 * - mensaje en chat_mensajes: tipo 'audio' + attachment_url (signed URL 7
 *   días) + attachment_meta { mime, size_bytes, duration_ms }
 * - HIGH_QUALITY de expo-av graba .m4a (AAC) → mime audio/mp4, permitido por
 *   la API web y reproducible en <audio> de todos los browsers modernos.
 */
import { supabase } from './supabase'
import { logger } from './logger'
import { ENV, fetchWithTimeout } from './env'

// Metro inyecta require en runtime; lo declaramos porque no hay @types/node
declare const require: (id: string) => unknown

export interface PlaybackStatus {
  isLoaded: boolean
  positionMillis?: number
  durationMillis?: number
  isPlaying?: boolean
  didJustFinish?: boolean
}

export interface ExpoSound {
  playAsync(): Promise<unknown>
  pauseAsync(): Promise<unknown>
  unloadAsync(): Promise<unknown>
  setPositionAsync(positionMillis: number): Promise<unknown>
  setOnPlaybackStatusUpdate(callback: ((status: PlaybackStatus) => void) | null): void
}

export interface ExpoRecording {
  stopAndUnloadAsync(): Promise<unknown>
  getURI(): string | null
}

// Tipado mínimo de expo-av (no podemos importar sus tipos: no está instalado)
interface ExpoAudioApi {
  requestPermissionsAsync(): Promise<{ granted: boolean }>
  setAudioModeAsync(mode: Record<string, unknown>): Promise<unknown>
  Recording: {
    createAsync(options?: unknown): Promise<{ recording: ExpoRecording }>
  }
  RecordingOptionsPresets: Record<string, unknown>
  Sound: {
    createAsync(
      source: { uri: string },
      initialStatus?: Record<string, unknown>,
      onPlaybackStatusUpdate?: (status: PlaybackStatus) => void,
    ): Promise<{ sound: ExpoSound }>
  }
}

const BUCKET = 'chat-attachments'
const SIGNED_URL_TTL_S = 7 * 24 * 60 * 60
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const MIN_AUDIO_BYTES = 1024

// Auth para la subida server-side: el cliente guest firma con su chatToken
// HMAC; el técnico va con su Bearer. Espejo de ChatAuth en chat-api.ts.
export interface AudioUploadAuth {
  token?: string | null
  chatToken?: string | null
}

let cachedAudioApi: ExpoAudioApi | null | undefined

export function getAudioApi(): ExpoAudioApi | null {
  if (cachedAudioApi !== undefined) return cachedAudioApi
  try {
    const av = require('expo-av') as { Audio?: ExpoAudioApi } | undefined
    cachedAudioApi = av?.Audio ?? null
  } catch {
    cachedAudioApi = null
  }
  if (!cachedAudioApi) logger.warn('expo-av no instalado: notas de voz deshabilitadas')
  return cachedAudioApi
}

export function isAudioChatAvailable(): boolean {
  return getAudioApi() !== null
}

/** Pide permiso de micrófono. Lanza Error('mic-denied') si el usuario lo niega. */
export async function startRecording(): Promise<ExpoRecording | null> {
  const api = getAudioApi()
  if (!api) return null
  const perm = await api.requestPermissionsAsync()
  if (!perm.granted) throw new Error('mic-denied')
  await api.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
  const { recording } = await api.Recording.createAsync(api.RecordingOptionsPresets.HIGH_QUALITY)
  return recording
}

/** Detiene la grabación y devuelve la uri local del .m4a (o null). */
export async function stopRecording(recording: ExpoRecording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync()
  } catch (err) {
    logger.warn('stopRecording:', err)
  }
  const api = getAudioApi()
  if (api) {
    // Volver el audio mode a reproducción (parlante, no auricular)
    try { await api.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }) } catch {}
  }
  return recording.getURI()
}

export interface AudioUploadResult {
  url: string
  sizeBytes: number
  mime: string
}

/**
 * Sube el audio al endpoint server-side de adjuntos de chat
 * (POST /api/chat/contacto/[codigo]/upload), que escribe en el bucket privado
 * 'chat-attachments' con service role y devuelve una signed URL de 7 días.
 * La subida directa con key anon quedó cerrada por el lockdown de Storage.
 *
 * Nota: ese endpoint solo existe para leads de contacto (códigos CONT-XXXXXX);
 * el backend no expone upload para chats de pedido. Para cualquier otro código
 * devolvemos null (la UI ya degrada sin crash mostrando "no pudimos enviar").
 */
export async function uploadChatAudio(
  codigo: string,
  remitente: 'cliente' | 'tecnico',
  uri: string,
  auth: AudioUploadAuth,
): Promise<AudioUploadResult | null> {
  // El upload server-side solo está montado en /chat/contacto/[codigo] (CONT-).
  if (!/^CONT-[A-F0-9]{6}$/i.test(codigo.trim())) {
    logger.warn('uploadChatAudio: código no-contacto sin endpoint de upload', codigo)
    return null
  }
  try {
    const response = await fetch(uri)
    const blob = await response.blob()
    // Igual que la web: descarta blobs fantasma y respeta el máx de 15 MB
    if (blob.size < MIN_AUDIO_BYTES || blob.size > MAX_AUDIO_BYTES) return null

    const seg = encodeURIComponent(codigo.trim())
    const form = new FormData()
    // En React Native el adjunto se manda como { uri, name, type }; expo-av
    // graba .m4a (AAC) → mime audio/mp4, permitido por el endpoint.
    form.append('file', { uri, name: `${remitente}-${Date.now()}.m4a`, type: 'audio/mp4' } as unknown as Blob)
    form.append('tipo', 'audio')
    if (auth.chatToken) form.append('chatToken', auth.chatToken)

    const headers: Record<string, string> = {}
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`

    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/chat/contacto/${seg}/upload`, {
      method: 'POST',
      headers,
      body: form,
      timeout: 30000, // subida de archivo: damos más margen que el default
    })
    if (!res.ok) {
      logger.error('Audio upload error: HTTP', res.status)
      return null
    }
    const data = (await res.json()) as {
      attachment_url?: string
      meta?: { mime?: string; size_bytes?: number }
    }
    if (!data?.attachment_url) return null
    return {
      url: data.attachment_url,
      sizeBytes: data.meta?.size_bytes ?? blob.size,
      mime: data.meta?.mime ?? 'audio/mp4',
    }
  } catch (err) {
    logger.error('Audio upload error:', err)
    return null
  }
}

/** Re-firma una signed URL vencida (mensajes con más de 7 días). */
export async function refreshSignedUrl(url: string): Promise<string | null> {
  try {
    const match = url.match(/\/object\/sign\/chat-attachments\/([^?]+)/)
    if (!match) return null
    const path = decodeURIComponent(match[1])
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_S)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}

export function formatAudioDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
