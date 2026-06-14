import { Linking } from 'react-native'
import { ENV, fetchWithTimeout } from './env'
import { waLink } from './constants'
import type { Tecnico } from './types'
import type { ClientProfile } from './useClientProfile'

// Revela el WhatsApp de un técnico (server-side, post-lockdown) y abre el
// chat de WhatsApp. La app ya NO puede leer whatsapp en bloque desde anon;
// se pide de a uno al endpoint /api/tecnico/[id]/contacto al momento de
// contactar. Devuelve false si no se pudo (sin red / técnico sin whatsapp).
export async function openTechWhatsapp(
  techId: number,
  nombre: string,
  mensaje?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/tecnico/${techId}/contacto`)
    if (!res.ok) return false
    const data = (await res.json()) as { whatsapp?: string | null }
    if (!data?.whatsapp) return false
    await Linking.openURL(
      waLink(data.whatsapp, mensaje || `Hola ${nombre}, te encontré en SOLU.`),
    )
    return true
  } catch {
    return false
  }
}

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

// Solo trae el número (sin abrir WhatsApp) — para flujos que arman su
// propio link o necesitan el dato.
export async function fetchTechWhatsapp(techId: number): Promise<string | null> {
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/tecnico/${techId}/contacto`)
    if (!res.ok) return null
    const data = (await res.json()) as { whatsapp?: string | null }
    return data?.whatsapp ?? null
  } catch {
    return null
  }
}
