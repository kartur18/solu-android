import * as Location from 'expo-location'
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import { ENV, fetchWithTimeout } from './env'
import { getTechToken } from './tech-session'
import { notifyIf401 } from './session-expired'
import { logger } from './logger'

let watchId: Location.LocationSubscription | null = null
let currentPedidoId: number | null = null
// Suscripción a AppState para pausar/reanudar el watch según foreground.
let appStateSub: NativeEventSubscription | null = null

// Crea el watch de GPS para el pedido en curso. Se reutiliza al arrancar y al
// reanudar desde background (no toca currentPedidoId ni permisos).
async function armWatch(): Promise<boolean> {
  if (watchId) return true
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
          const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/lead/${currentPedidoId}/gps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          })
          // Si el token venció en mitad del tracking, desloguear (solo 401).
          if (token) notifyIf401(res)
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

// Quita el watch sin borrar currentPedidoId (para poder reanudar el mismo pedido).
function disarmWatch() {
  if (watchId) {
    try { watchId.remove() } catch {}
    watchId = null
  }
}

// Pausa el GPS en background/inactive y lo reanuda en foreground para el mismo
// pedido. Un técnico "en camino" que abre Google Maps no drena batería.
function handleAppStateChange(next: AppStateStatus) {
  if (next === 'active') {
    if (currentPedidoId !== null) void armWatch()
  } else {
    disarmWatch()
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

  const ok = await armWatch()
  if (!ok) { currentPedidoId = null; return false }

  // Solo registramos el listener una vez por sesión de tracking.
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', handleAppStateChange)
  }
  return true
}

export function stopLiveTracking() {
  if (appStateSub) {
    try { appStateSub.remove() } catch {}
    appStateSub = null
  }
  disarmWatch()
  currentPedidoId = null
}

export function isLiveTracking(pedidoId: number): boolean {
  return watchId !== null && currentPedidoId === pedidoId
}
