import { ENV, fetchWithTimeout } from './env'
import type { Tecnico } from './types'
import type { ClientProfile } from './useClientProfile'

// NOTA: openTechWhatsapp/fetchTechWhatsapp fueron eliminados: apuntaban a
// /api/tecnico/[id]/contacto (endpoint borrado por ser un bypass de cobro —
// revelaba el whatsapp del técnico sin crear lead). El único camino de
// contacto es iniciarChatLead, que cobra el lead al técnico.

// Resultado del lead in-app: el código CONT- y su token HMAC para abrir
// el chat del cliente sin sesión.
export interface LeadChat {
  codigo: string
  chatToken: string
}

// Crea el lead vía POST /api/contactos (igual que la web): registra el
// contacto, cobra el coin al técnico al primer mensaje y devuelve el
// chatToken para abrir el chat in-app. Devuelve null si falla (sin red,
// rate-limit, técnico inexistente). servicio_buscado = oficio del técnico;
// distrito = el del cliente, con fallback al del técnico.
export async function iniciarChatLead(
  tech: Tecnico,
  cliente: ClientProfile,
): Promise<LeadChat | null> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/contactos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tecnico_id: tech.id,
        cliente_whatsapp: cliente.whatsapp,
        cliente_nombre: cliente.nombre,
        servicio_buscado: tech.oficio,
        distrito: cliente.distrito || tech.distrito,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { codigo?: string; chat_token?: string }
    if (!data?.codigo || !data?.chat_token) return null
    return { codigo: data.codigo, chatToken: data.chat_token }
  } catch {
    return null
  }
}
