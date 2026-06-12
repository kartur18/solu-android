import { ENV } from './env'
import type { Tecnico, Cliente, Resena, Notificacion, Cotizacion } from './types'

export interface TechDashboardData {
  leads: Cliente[]
  resenas: Resena[]
  notificaciones: Notificacion[]
  cotizaciones: Cotizacion[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pagos/openRequests sin tipo fuerte en la app
  pagos: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ídem
  openRequests: any[]
}

// Trae TODO el panel del técnico (leads/reseñas/notificaciones/cotizaciones/
// pagos/solicitudes abiertas) server-side con el token, en vez de leer esas
// tablas con anon (clientes estaba expuesta; el resto en deny-all daba vacío).
export async function fetchMyTechDashboard(
  token: string | null | undefined,
): Promise<TechDashboardData | null> {
  if (!token) return null
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/tecnico/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return (await res.json()) as TechDashboardData
  } catch {
    return null
  }
}

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
