import { Linking } from 'react-native'
import { ENV } from './env'
import { waLink } from './constants'

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
