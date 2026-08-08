// Tipos y helpers compartidos por las pestañas del panel del técnico
// (app/(tabs)/cuenta.tsx). Viven fuera de la pantalla para que el hub y cada
// pestaña extraída hablen de los mismos tiers y los mismos datos.

import type { TierTecnico } from '../../../lib/tecnico-columns'

// Espejo de las solicitudes abiertas que devuelve el dashboard del técnico.
export interface SolicitudAbierta {
  id: number
  codigo: string
  servicio: string
  cliente_nombre: string
  distrito: string
  urgencia: string
  created_at: string
  distancia_label?: string | null
}

// Fila de `pagos` del dashboard (compras de SoluCoins). El endpoint no tiene
// tipo fuerte en la app; acá se declara lo que la billetera realmente lee.
export interface PagoCoins {
  id: number
  plan?: string | null
  metodo?: string | null
  monto?: number | string | null
  created_at: string
}

// Tiers de fidelidad con los umbrales REALES del server (10/50/200) y su
// beneficio (descuento en paquetes de coins). El viejo getTechLevel usaba
// 100 para Platino: el badge podía contradecir el tier que fija el descuento
// y la card pública del técnico.
export const TIERS_FIDELIDAD = [
  { key: 'bronce' as TierTecnico, name: 'Bronce', emoji: '🥉', min: 0, color: '#CD7F32', descuento: 0 },
  { key: 'plata' as TierTecnico, name: 'Plata', emoji: '🥈', min: 10, color: '#C0C0C0', descuento: 8 },
  { key: 'oro' as TierTecnico, name: 'Oro', emoji: '🥇', min: 50, color: '#FFD700', descuento: 15 },
  { key: 'platino' as TierTecnico, name: 'Platino', emoji: '💎', min: 200, color: '#6366F1', descuento: 25 },
]

export type TierInfo = (typeof TIERS_FIDELIDAD)[number]

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mes`
}
