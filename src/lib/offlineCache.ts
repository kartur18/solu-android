import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_KEYS = {
  TECH_PROFILE: 'solu_cache_tech_profile',
  LEADS: 'solu_cache_leads',
  REVIEWS: 'solu_cache_reviews',
  NOTIFICATIONS: 'solu_cache_notifications',
  SEARCH_RESULTS: 'solu_cache_search',
}

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface CachedData<T> {
  data: T
  timestamp: number
}

// Save data to cache
export async function cacheData<T>(key: string, data: T): Promise<void> {
  try {
    const cached: CachedData<T> = { data, timestamp: Date.now() }
    await AsyncStorage.setItem(key, JSON.stringify(cached))
  } catch {}
}

// Get cached data (returns null if expired or not found)
export async function getCachedData<T>(key: string, maxAge: number = CACHE_TTL): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const cached: CachedData<T> = JSON.parse(raw)
    if (Date.now() - cached.timestamp > maxAge) return null
    return cached.data
  } catch {
    return null
  }
}

// Cache tech profile
export async function cacheTechProfile(tech: any): Promise<void> {
  await cacheData(CACHE_KEYS.TECH_PROFILE, tech)
}

export async function getCachedTechProfile(): Promise<any | null> {
  return getCachedData(CACHE_KEYS.TECH_PROFILE, 60 * 60 * 1000) // 1 hour
}

// Cache leads
export async function cacheLeads(leads: any[]): Promise<void> {
  await cacheData(CACHE_KEYS.LEADS, leads)
}

export async function getCachedLeads(): Promise<any[] | null> {
  return getCachedData(CACHE_KEYS.LEADS)
}

// Cache search results
export async function cacheSearchResults(results: any[]): Promise<void> {
  await cacheData(CACHE_KEYS.SEARCH_RESULTS, results)
}

export async function getCachedSearchResults(): Promise<any[] | null> {
  return getCachedData(CACHE_KEYS.SEARCH_RESULTS, 15 * 60 * 1000) // 15 minutes
}

// NOTA (lockdown seguridad, 2026-06): se eliminó la cola de acciones offline
// (queueOfflineAction / syncPendingActions / getPendingActionsCount). Eran
// código muerto (sin un solo caller en la app) y `syncPendingActions` escribía
// directo a `clientes`/`mensajes` con la key anon — escritura que el lockdown
// de RLS ya bloquea. Si se reintroduce sync offline, debe ir por los endpoints
// server-side (igual que chat-api.ts / contacto.ts), nunca anon directo.

// Clear all cache
export async function clearAllCache(): Promise<void> {
  try {
    await Promise.all(Object.values(CACHE_KEYS).map(key => AsyncStorage.removeItem(key)))
  } catch {}
}

export { CACHE_KEYS }
