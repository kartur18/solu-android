import * as Location from 'expo-location'
import { supabase } from './supabase'
import { logger } from './logger'

let watchId: Location.LocationSubscription | null = null
let currentPedidoId: number | null = null

/**
 * Start streaming técnico GPS to the pedido row every ~30s while estado = 'En camino'.
 * Requires Supabase columns: tecnico_lat, tecnico_lng, tecnico_gps_updated_at
 * (see supabase/migrations/20260418_live_tracking_and_chat.sql)
 */
export async function startLiveTracking(pedidoId: number): Promise<boolean> {
  if (watchId && currentPedidoId === pedidoId) return true
  stopLiveTracking()

  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return false

  currentPedidoId = pedidoId

  try {
    watchId = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 },
      async (pos) => {
        if (!currentPedidoId) return
        const { latitude, longitude } = pos.coords
        try {
          await supabase
            .from('clientes')
            .update({
              tecnico_lat: latitude,
              tecnico_lng: longitude,
              tecnico_gps_updated_at: new Date().toISOString(),
            })
            .eq('id', currentPedidoId)
        } catch (err) {
          logger.error('Live tracking update failed:', err)
        }
      },
    )
    return true
  } catch (err) {
    logger.error('Live tracking start failed:', err)
    return false
  }
}

export function stopLiveTracking() {
  if (watchId) {
    try { watchId.remove() } catch {}
    watchId = null
  }
  currentPedidoId = null
}

export function isLiveTracking(pedidoId: number): boolean {
  return watchId !== null && currentPedidoId === pedidoId
}
