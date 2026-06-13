import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

let watchId: Location.LocationSubscription | null = null
let currentPedidoId: number | null = null

// Lee el Bearer del técnico desde AsyncStorage (clave 'solu_tech_session', campo .token).
async function getTechToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('solu_tech_session')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed?.token ?? null
  } catch {
    return null
  }
}

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
          // El endpoint persiste tecnico_lat/lng/gps_updated_at en la fila del lead;
          // el id del técnico sale del Bearer y valida ownership por tecnico_asignado.
          const token = await getTechToken()
          await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/lead/${currentPedidoId}/gps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          })
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
