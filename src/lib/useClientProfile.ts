import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'solu_client_session'

export interface ClientProfile {
  nombre?: string
  whatsapp?: string
  distrito?: string
  lastServicio?: string
}

export function useClientProfile() {
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (stored) {
          try { setProfile(JSON.parse(stored)) } catch {}
        }
      })
      .finally(() => setLoaded(true))
  }, [])

  const save = useCallback(async (patch: ClientProfile) => {
    const next = { ...(profile || {}), ...patch }
    setProfile(next)
    try { await AsyncStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  }, [profile])

  const clear = useCallback(async () => {
    setProfile(null)
    try { await AsyncStorage.removeItem(KEY) } catch {}
  }, [])

  return { profile, loaded, save, clear }
}
