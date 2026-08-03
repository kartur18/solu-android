// Elección del técnico que atiende un pedido.
//
// Antes esto se calculaba ACÁ, en el celular y con la key anon, y salía mal
// por diseño:
//   - `.ilike('oficio', '%Gasfitería%')` nunca matchea al "Gasfitero", así
//     que la consulta principal SIEMPRE devolvía vacío.
//   - El fallback traía 20 técnicos de TODO el país sin filtro de zona y
//     asignaba el de mejor rating: un cliente de Comas podía terminar con un
//     técnico de Arequipa.
//   - `lat`/`lng` están bloqueadas para anon por RLS, así que el bonus por
//     distancia nunca sumaba: era código muerto.
//
// Ahora lo decide el servidor (/api/matching/mejor-tecnico), que con
// service_role lee la cobertura completa —distrito, zonas declaradas, GPS
// con radio, disponibilidad— y aplica el mismo criterio que la web. Un solo
// lugar donde cambiar las reglas.

import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

export interface MatchableTech {
  id: number
  nombre: string
  /** El WhatsApp se revela recién al pagar el lead, nunca en el matching. */
  whatsapp?: string | null
  oficio?: string | null
  distrito?: string | null
  calificacion?: number | null
  servicios_completados?: number | null
}

export interface MatchInput {
  servicio: string
  distrito: string
  clientCoords?: { latitude: number; longitude: number } | null
  clienteWhatsapp?: string | null
  /** Técnicos ya intentados, para no volver a proponerlos. */
  excluir?: number[]
}

export async function findBestTech(input: MatchInput): Promise<MatchableTech | null> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/matching/mejor-tecnico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servicio: input.servicio,
        distrito: input.distrito,
        lat: input.clientCoords?.latitude ?? null,
        lng: input.clientCoords?.longitude ?? null,
        clienteWhatsapp: input.clienteWhatsapp ?? null,
        excluir: input.excluir ?? undefined,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tecnico: MatchableTech | null }
    return data.tecnico ?? null
  } catch (err) {
    // Sin técnico asignado el pedido igual se crea y entra a la subasta:
    // preferimos eso a bloquear al cliente por un problema de red.
    logger.warn('matching: no se pudo resolver el técnico', err)
    return null
  }
}
