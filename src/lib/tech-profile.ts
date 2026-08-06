import { ENV, fetchWithTimeout } from './env'
import { notifyIf401 } from './session-expired'
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

// Por qué existe este resultado y no alcanza con `null`: devolver `null` mezclaba
// "el token no vale" con "no pude preguntar" (sin internet, timeout, 429 del rate
// limit, 5xx). El auto-login de cuenta.tsx borraba el token de SecureStore en los
// tres casos, así que abrir la app en el subte —o durante un pico de la API— dejaba
// al técnico deslogueado pidiéndole la contraseña. Solo 'auth' puede cerrar sesión.
export type MotivoFalloTech = 'auth' | 'transitorio'
export type ResultadoTech<T> = { ok: true; data: T } | { ok: false; motivo: MotivoFalloTech }

// 401 (token vencido/inválido) y 403 (técnico suspendido) son los únicos códigos
// que prueban que el token no sirve. Todo lo demás es reintentable: 429 del rate
// limit (60/min, se gatilla con abrir la app varias veces seguidas), 5xx, y el 404
// de /tecnico/me que el server también devuelve ante un error de BD.
function motivoDe(res: Response): MotivoFalloTech {
  return res.status === 401 || res.status === 403 ? 'auth' : 'transitorio'
}

// Única regla que autoriza borrar el token de SecureStore: el server dijo que no
// vale. "No pude preguntar" nunca cierra sesión.
export function debeCerrarSesion(res: ResultadoTech<unknown>): boolean {
  return !res.ok && res.motivo === 'auth'
}

// Timeout explícito: sin él, una red que abre la conexión y nunca responde (wifi
// de portal cautivo, señal degradada) dejaba el panel colgado en "Cargando".
const TIMEOUT_MS = 15000

async function getAutenticado<T>(ruta: string, token: string | null | undefined): Promise<ResultadoTech<T>> {
  if (!token) return { ok: false, motivo: 'auth' }
  let res: Response
  try {
    res = await fetchWithTimeout(`${ENV.API_BASE_URL}${ruta}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: TIMEOUT_MS,
    })
  } catch {
    // Sin conexión o timeout: no sabemos nada del token, así que no se toca.
    return { ok: false, motivo: 'transitorio' }
  }
  notifyIf401(res)
  if (!res.ok) return { ok: false, motivo: motivoDe(res) }
  try {
    return { ok: true, data: (await res.json()) as T }
  } catch {
    // 2xx con cuerpo ilegible (proxy/portal cautivo): tampoco prueba nada del token.
    return { ok: false, motivo: 'transitorio' }
  }
}

// Trae TODO el panel del técnico (leads/reseñas/notificaciones/cotizaciones/
// pagos/solicitudes abiertas) server-side con el token, en vez de leer esas
// tablas con anon (clientes estaba expuesta; el resto en deny-all daba vacío).
export function fetchMyTechDashboardResult(
  token: string | null | undefined,
): Promise<ResultadoTech<TechDashboardData>> {
  return getAutenticado<TechDashboardData>('/tecnico/dashboard', token)
}

// Trae el perfil COMPLETO del técnico logueado (incluye columnas privadas
// que su panel necesita: whatsapp, email, dni, documentos, etc.) vía el
// endpoint server-side /api/tecnico/me, autenticado con el auth_token que
// emite /api/login-tech. Reemplaza el viejo `supabase.from('tecnicos')
// .select('*')` con key anon, que tras el lockdown ya no puede leer esas
// columnas (devolvía permission denied → el panel no cargaba).
export async function fetchMyTechProfileResult(
  token: string | null | undefined,
): Promise<ResultadoTech<Tecnico>> {
  const res = await getAutenticado<{ technician?: Tecnico }>('/tecnico/me', token)
  if (!res.ok) return res
  // 200 sin `technician` es una respuesta rota del server, no un token inválido.
  if (!res.data?.technician) return { ok: false, motivo: 'transitorio' }
  return { ok: true, data: res.data.technician }
}

// Envoltorios legacy para las pantallas que solo distinguen "hay datos" de "no
// hay": pierden el motivo, así que NO deben usarse para decidir un logout.
export async function fetchMyTechDashboard(
  token: string | null | undefined,
): Promise<TechDashboardData | null> {
  const res = await fetchMyTechDashboardResult(token)
  return res.ok ? res.data : null
}

export async function fetchMyTechProfile(token: string | null | undefined): Promise<Tecnico | null> {
  const res = await fetchMyTechProfileResult(token)
  return res.ok ? res.data : null
}
