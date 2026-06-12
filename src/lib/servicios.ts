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
