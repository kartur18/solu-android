import { ENV } from './env'

// Lecturas de servicios (tabla `clientes`) que antes iban por anon y ahora
// pasan por endpoints server-side, porque `clientes` quedó cerrada a anon
// (tenía políticas que dejaban leer TODOS los clientes).

// Un servicio por su código de seguimiento (tracking, chat del pedido,
// calificación). Devuelve null si no existe o hubo error de red.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila dinámica de `clientes`
export async function fetchServicioByCodigo(codigo: string): Promise<any | null> {
  if (!codigo) return null
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/servicio/${encodeURIComponent(codigo)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.servicio ?? null
  } catch {
    return null
  }
}

// Igual que arriba pero distinguiendo por qué no hay servicio: el tracking
// mostraba "No encontramos ese código" también cuando se caía la red, y el
// estado real de error de red era inalcanzable (siempre caía en "no existe").
// El endpoint responde 404 solo cuando el código de verdad no existe; 5xx/429
// y las fallas de fetch son 'error' (no pudimos preguntar).
export type ResultadoServicio =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila dinámica de `clientes`
  | { estado: 'ok'; servicio: any }
  | { estado: 'no_existe' }
  | { estado: 'error' }

export async function fetchServicioByCodigoResult(codigo: string): Promise<ResultadoServicio> {
  if (!codigo) return { estado: 'no_existe' }
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/servicio/${encodeURIComponent(codigo)}`)
    // 404 (no encontrado) y 400 (código inválido) = de verdad no existe.
    if (res.status === 404 || res.status === 400) return { estado: 'no_existe' }
    if (!res.ok) return { estado: 'error' }
    const data = await res.json()
    const servicio = data?.servicio ?? null
    return servicio ? { estado: 'ok', servicio } : { estado: 'no_existe' }
  } catch {
    return { estado: 'error' }
  }
}

// Todos los servicios de un cliente por su WhatsApp (historial, pendientes
// de calificar, fidelidad).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- filas dinámicas de `clientes`
export async function fetchClienteServicios(whatsapp: string): Promise<any[]> {
  if (!whatsapp) return []
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/cliente/servicios?whatsapp=${encodeURIComponent(whatsapp)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data?.servicios ?? []
  } catch {
    return []
  }
}

// Variante que distingue "no tienes servicios" de "no pudimos preguntar":
// la bandeja de mensajes del cliente no debe disfrazar un fallo de red de
// bandeja vacía (mismo patrón que fetchServicioByCodigoResult).
export type ResultadoServicios =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- filas dinámicas de `clientes`
  | { estado: 'ok'; servicios: any[] }
  | { estado: 'error' }

export async function fetchClienteServiciosResult(whatsapp: string): Promise<ResultadoServicios> {
  if (!whatsapp) return { estado: 'ok', servicios: [] }
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/cliente/servicios?whatsapp=${encodeURIComponent(whatsapp)}`)
    if (!res.ok) return { estado: 'error' }
    const data = await res.json()
    return { estado: 'ok', servicios: data?.servicios ?? [] }
  } catch {
    return { estado: 'error' }
  }
}

// Espejo del item de GET /api/cliente/mis-tecnicos (web): datos públicos de
// tarjeta + agregado de cuántas veces atendió a ESTE cliente.
export interface TecnicoConfianza {
  id: number
  nombre: string
  oficio: string | null
  distrito: string | null
  foto_url: string | null
  calificacion: number | null
  num_resenas: number | null
  servicios_completados: number | null
  verificado: boolean | null
  disponible: boolean | null
  veces: number
  servicios: number
  ultimo_servicio_at: string
  ultimo_servicio: string | null
  ultimo_distrito: string | null
  tiene_servicio_activo: boolean
}

export type ResultadoMisTecnicos =
  | { estado: 'ok'; tecnicos: TecnicoConfianza[] }
  | { estado: 'error' }

// "Tus técnicos de confianza": quiénes ya atendieron a este cliente. El
// re-contacto desde esta lista pasa por /api/contactos (cobra el lead).
export async function fetchMisTecnicos(whatsapp: string): Promise<ResultadoMisTecnicos> {
  if (!whatsapp) return { estado: 'ok', tecnicos: [] }
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/cliente/mis-tecnicos?whatsapp=${encodeURIComponent(whatsapp)}`)
    if (!res.ok) return { estado: 'error' }
    const data = await res.json()
    return { estado: 'ok', tecnicos: data?.tecnicos ?? [] }
  } catch {
    return { estado: 'error' }
  }
}
