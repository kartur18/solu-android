// Llamadas que comparten la bandeja de mensajes y el panel del técnico.
//
// Viven acá (y no duplicadas en cada pantalla) para que el panel pueda decir
// "3 clientes esperan tu respuesta" y consultar el costo de un trabajo con
// exactamente los mismos endpoints que usa la bandeja.

import { ENV, fetchWithTimeout } from '../../lib/env'
import { logger } from '../../lib/logger'
import { notifyIf401 } from '../../lib/session-expired'
import type { ChatResumen, PrecioLead } from './lead-utils'

/**
 * Conversaciones del técnico autenticado. Lanza si la respuesta no es OK para
 * que la UI distinga "sin mensajes" de "no se pudo cargar".
 */
export async function fetchChatsResumen(token: string): Promise<ChatResumen[]> {
  const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/chats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  notifyIf401(res)
  if (!res.ok) throw new Error(`tecnico_chats_${res.status}`)
  const data = (await res.json()) as { chats?: ChatResumen[] }
  return data?.chats ?? []
}

/**
 * Precio de un lead. Devuelve null si no se pudo consultar: es informativo, el
 * cobro real lo valida el servidor.
 */
export async function fetchPrecioLead(codigo: string, token: string | null): Promise<PrecioLead | null> {
  if (!token) return null
  try {
    const res = await fetchWithTimeout(
      `${ENV.API_BASE_URL}/tecnico/lead/precio?codigo=${encodeURIComponent(codigo)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    notifyIf401(res)
    if (!res.ok) return null
    return (await res.json()) as PrecioLead
  } catch (err) {
    logger.warn('lead-api: no se pudo consultar el precio del lead', err)
    return null
  }
}
