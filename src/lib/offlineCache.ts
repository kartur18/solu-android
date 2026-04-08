import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

const CACHE_KEYS = {
  TECH_PROFILE: 'solu_cache_tech_profile',
  LEADS: 'solu_cache_leads',
  REVIEWS: 'solu_cache_reviews',
  NOTIFICATIONS: 'solu_cache_notifications',
  SEARCH_RESULTS: 'solu_cache_search',
  PENDING_ACTIONS: 'solu_cache_pending_actions',
}

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface CachedData<T> {
  data: T
  timestamp: number
}

interface PendingAction {
  id: string
  type: 'update_status' | 'send_message' | 'create_request'
  payload: any
  createdAt: number
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

// Queue offline actions for later sync
export async function queueOfflineAction(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS)
    const pending: PendingAction[] = raw ? JSON.parse(raw) : []
    pending.push({
      ...action,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      createdAt: Date.now(),
    })
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(pending))
  } catch {}
}

// Sync pending offline actions when back online
export async function syncPendingActions(): Promise<{ synced: number; failed: number }> {
  let synced = 0
  let failed = 0

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS)
    if (!raw) return { synced: 0, failed: 0 }

    const pending: PendingAction[] = JSON.parse(raw)
    const remaining: PendingAction[] = []

    for (const action of pending) {
      try {
        switch (action.type) {
          case 'update_status':
            await supabase.from('clientes').update({ estado: action.payload.estado }).eq('id', action.payload.id)
            synced++
            break
          case 'send_message':
            await supabase.from('mensajes').insert(action.payload)
            synced++
            break
          case 'create_request':
            await supabase.from('clientes').insert(action.payload)
            synced++
            break
          default:
            remaining.push(action)
        }
      } catch {
        failed++
        // Keep failed actions for retry (max 24 hours old)
        if (Date.now() - action.createdAt < 24 * 60 * 60 * 1000) {
          remaining.push(action)
        }
      }
    }

    await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(remaining))
  } catch {}

  return { synced, failed }
}

// Get count of pending actions
export async function getPendingActionsCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS)
    if (!raw) return 0
    return JSON.parse(raw).length
  } catch {
    return 0
  }
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  try {
    await Promise.all(Object.values(CACHE_KEYS).map(key => AsyncStorage.removeItem(key)))
  } catch {}
}

export { CACHE_KEYS }
