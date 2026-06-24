import { ENV, fetchWithTimeout } from './env'
import { getTechToken as readTechToken } from './tech-session'
import { notifyIf401 } from './session-expired'
import type { Notificacion } from './types'

// Cliente de las notificaciones del técnico contra los endpoints server-side
// (/api/notifications). Reemplaza el acceso directo a Supabase con key anon,
// que tras el lockdown ya no puede leer/escribir la tabla `notificaciones`.

// Lee el token de sesión del técnico desde SecureStore (vía tech-session).
export async function getTechToken(): Promise<string | null> {
  return readTechToken()
}

// Trae las últimas notificaciones del técnico logueado (Bearer).
// Lanza si la respuesta no es OK para que la UI muestre estado de error.
export async function fetchNotifications(
  token: string | null | undefined,
  limit = 20,
  tecnicoId?: number,
): Promise<Notificacion[]> {
  if (!token) throw new Error('missing_token')
  const params = new URLSearchParams({ limit: String(limit) })
  if (tecnicoId != null) params.set('tecnicoId', String(tecnicoId))
  const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/notifications?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  notifyIf401(res)
  if (!res.ok) throw new Error(`notifications_${res.status}`)
  const data = (await res.json()) as { notifications?: Notificacion[] }
  return data?.notifications ?? []
}

// Marca una notificación como leída (PUT con notificationId).
export async function markNotifRead(
  token: string | null | undefined,
  tecnicoId: number,
  notificationId: number,
): Promise<boolean> {
  if (!token) return false
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/notifications`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tecnicoId, notificationId }),
    })
    notifyIf401(res)
    return res.ok
  } catch {
    return false
  }
}

// Marca todas las notificaciones del técnico como leídas (PUT markAllRead).
export async function markAllNotifRead(
  token: string | null | undefined,
  tecnicoId: number,
): Promise<boolean> {
  if (!token) return false
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/notifications`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tecnicoId, markAllRead: true }),
    })
    notifyIf401(res)
    return res.ok
  } catch {
    return false
  }
}
