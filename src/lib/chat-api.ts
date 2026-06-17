import AsyncStorage from '@react-native-async-storage/async-storage'
import { ENV, fetchWithTimeout } from './env'

// Cliente del chat cliente↔técnico contra los endpoints server-side
// (/api/chat/...). Reemplaza el acceso directo a Supabase con key anon
// (lectura/escritura de chat_mensajes + Realtime), que tras el lockdown
// quedó bloqueado por RLS. Sin realtime: la UI hace polling (como la web).

export interface AttachmentMeta {
  mime?: string
  size_bytes?: number
  duration_ms?: number
  // Imagen
  width?: number
  height?: number
  // Cotización (la web manda tipo='cotizacion' con estos campos)
  monto_pen?: number
  descripcion?: string
  tiempo_estimado_min?: number
  estado?: string
}

export interface ChatMensaje {
  id: number
  codigo_solicitud: string
  remitente: 'cliente' | 'tecnico'
  mensaje: string
  leido: boolean
  created_at: string
  tipo?: 'text' | 'audio' | 'image' | 'cotizacion'
  attachment_url?: string | null
  attachment_meta?: AttachmentMeta | null
}

// Error de chat con metadata para que la UI distinga 402 (sin coins) y
// muestre el aviso de compra de coins, vs. otros fallos.
export class ChatApiError extends Error {
  status: number
  codigoError?: string
  costo?: number
  saldoActual?: number
  constructor(status: number, message: string, extra?: { codigoError?: string; costo?: number; saldoActual?: number }) {
    super(message)
    this.name = 'ChatApiError'
    this.status = status
    this.codigoError = extra?.codigoError
    this.costo = extra?.costo
    this.saldoActual = extra?.saldoActual
  }
}

interface ChatAuth {
  // Token de sesión del técnico (Bearer). Si está presente, autentica como técnico.
  token?: string | null
  // Token HMAC del cliente guest (tracking). Se manda como ?token= (GET) o body.chatToken (POST).
  chatToken?: string | null
}

// Lee el token de sesión del técnico guardado en AsyncStorage por el login.
export async function getTechToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('solu_tech_session')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed?.token ?? null
  } catch {
    return null
  }
}

// Obtiene un chatToken HMAC para el cliente guest de un PEDIDO, autenticando
// con su WhatsApp (que coincide con el del pedido). Lo usa el cliente desde
// tracking para poder leer/escribir su chat sin sesión. Los leads CONT- NO
// usan esto: su chatToken lo emite /api/contactos al contactar.
export async function fetchChatToken(codigo: string, whatsapp: string): Promise<string | null> {
  if (/^CONT-/i.test(codigo.trim()) || !whatsapp) return null
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/chat/${encodeURIComponent(codigo.trim())}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp: whatsapp.replace(/\D/g, '') }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { chatToken?: string }
    return data?.chatToken ?? null
  } catch {
    return null
  }
}

// Detecta el endpoint según el código: los leads de contacto son CONT-XXXXXX
// (chat de lead, cobra coins al técnico) y van a /chat/contacto/{codigo};
// cualquier otro código es un pedido normal y va a /chat/{code}.
function mensajesPath(codigo: string): string {
  const esContacto = /^CONT-/i.test(codigo.trim())
  const seg = encodeURIComponent(codigo.trim())
  return esContacto
    ? `${ENV.API_BASE_URL}/chat/contacto/${seg}/mensajes`
    : `${ENV.API_BASE_URL}/chat/${seg}/mensajes`
}

// Construye el header de auth: el técnico usa Bearer; el cliente no manda
// Authorization (su token va por query/body).
function authHeaders(auth: ChatAuth): Record<string, string> {
  return auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
}

async function parseError(res: Response): Promise<ChatApiError> {
  let body: { error?: string; codigo_error?: string; costo?: number; saldo_actual?: number } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    // respuesta sin JSON (timeout proxy, 502, etc.)
  }
  return new ChatApiError(res.status, body.error || `chat_${res.status}`, {
    codigoError: body.codigo_error,
    costo: body.costo,
    saldoActual: body.saldo_actual,
  })
}

// Trae los mensajes del chat. Técnico: Bearer. Cliente: ?token=<chatToken>.
// Lanza ChatApiError si la respuesta no es OK para que la UI muestre estado.
export async function fetchMensajes(opts: {
  codigo: string
  token?: string | null
  chatToken?: string | null
}): Promise<ChatMensaje[]> {
  const { codigo, token, chatToken } = opts
  let url = mensajesPath(codigo)
  if (!token && chatToken) {
    url += `?token=${encodeURIComponent(chatToken)}`
  }
  const res = await fetchWithTimeout(url, { headers: authHeaders({ token, chatToken }) })
  if (!res.ok) throw await parseError(res)
  const data = (await res.json()) as { mensajes?: ChatMensaje[] }
  return data?.mensajes ?? []
}

// Envía un mensaje. Técnico: Bearer + body {mensaje}. Cliente: body {mensaje, chatToken}.
// Para notas de voz se adjuntan tipo/attachment_url/attachment_meta (el audio
// ya está subido al bucket). El 1er POST del técnico en un lead CONT- puede
// devolver 402 (sin coins), 403 (cuenta congelada) o 503 (pricing): se
// propagan como ChatApiError.
export async function sendMensaje(opts: {
  codigo: string
  mensaje: string
  token?: string | null
  chatToken?: string | null
  tipo?: 'text' | 'audio' | 'image' | 'cotizacion'
  attachmentUrl?: string | null
  attachmentMeta?: AttachmentMeta | null
}): Promise<ChatMensaje> {
  const { codigo, mensaje, token, chatToken, tipo, attachmentUrl, attachmentMeta } = opts
  const body: {
    mensaje: string
    chatToken?: string
    tipo?: string
    attachment_url?: string | null
    attachment_meta?: AttachmentMeta | null
  } = { mensaje }
  // El cliente firma con su chatToken en el body; el técnico va por Bearer.
  if (!token && chatToken) body.chatToken = chatToken
  if (tipo && tipo !== 'text') {
    body.tipo = tipo
    body.attachment_url = attachmentUrl ?? null
    body.attachment_meta = attachmentMeta ?? null
  }
  const res = await fetchWithTimeout(mensajesPath(codigo), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders({ token, chatToken }) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await parseError(res)
  const data = (await res.json()) as { mensaje?: ChatMensaje }
  if (!data?.mensaje) throw new ChatApiError(res.status, 'respuesta_invalida')
  return data.mensaje
}
