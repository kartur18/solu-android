import { supabase } from './supabase'

export interface MatchableTech {
  id: number
  nombre: string
  whatsapp: string
  oficio?: string | null
  distrito?: string | null
  calificacion?: number | null
  servicios_completados?: number | null
  plan?: string | null
  lat?: number | null
  lng?: number | null
}

export interface MatchInput {
  servicio: string
  distrito: string
  clientCoords?: { latitude: number; longitude: number } | null
}

const PLAN_BOOST: Record<string, number> = {
  elite: 30,
  premium: 20,
  profesional: 10,
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180
  const dLon = ((b.lng - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function scoreTech(tech: MatchableTech, input: MatchInput): number {
  let score = 0

  // Rating (0-50 pts)
  const rating = tech.calificacion ?? 0
  score += Math.min(rating * 10, 50)

  // Experience (0-20 pts, plateaus at 50 services)
  const done = tech.servicios_completados ?? 0
  score += Math.min((done / 50) * 20, 20)

  // Plan boost (0-30 pts)
  score += PLAN_BOOST[tech.plan ?? ''] ?? 0

  // Same district bonus (0-25 pts)
  if (tech.distrito && input.distrito && tech.distrito.toLowerCase() === input.distrito.toLowerCase()) {
    score += 25
  }

  // GPS distance bonus (0-40 pts, falls off with distance)
  if (input.clientCoords && tech.lat != null && tech.lng != null) {
    const km = haversineKm(input.clientCoords, { lat: tech.lat, lng: tech.lng })
    if (km < 2) score += 40
    else if (km < 5) score += 25
    else if (km < 10) score += 12
    else if (km < 20) score += 4
  }

  return score
}

const SELECT_COLS = 'id, nombre, whatsapp, oficio, distrito, calificacion, servicios_completados, plan, lat, lng'

export async function findBestTech(input: MatchInput): Promise<MatchableTech | null> {
  const { data } = await supabase
    .from('tecnicos')
    .select(SELECT_COLS)
    .eq('disponible', true)
    .ilike('oficio', `%${input.servicio}%`)
    .limit(20)

  let candidates = (data as MatchableTech[] | null) ?? []

  if (!candidates.length) {
    const { data: fallback } = await supabase
      .from('tecnicos')
      .select(SELECT_COLS)
      .eq('disponible', true)
      .limit(20)
    candidates = (fallback as MatchableTech[] | null) ?? []
  }

  if (!candidates.length) return null

  candidates.sort((a, b) => scoreTech(b, input) - scoreTech(a, input))
  return candidates[0]
}
