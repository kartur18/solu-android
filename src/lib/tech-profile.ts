import { ENV } from './env'
import type { Tecnico } from './types'

// Trae el perfil COMPLETO del técnico logueado (incluye columnas privadas
// que su panel necesita: whatsapp, email, dni, documentos, etc.) vía el
// endpoint server-side /api/tecnico/me, autenticado con el auth_token que
// emite /api/login-tech. Reemplaza el viejo `supabase.from('tecnicos')
// .select('*')` con key anon, que tras el lockdown ya no puede leer esas
// columnas (devolvía permission denied → el panel no cargaba).
export async function fetchMyTechProfile(token: string | null | undefined): Promise<Tecnico | null> {
  if (!token) return null
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/tecnico/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { technician?: Tecnico }
    return data?.technician ?? null
  } catch {
    return null
  }
}
