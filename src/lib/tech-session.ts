import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

// Sesión del técnico. El token Bearer (sensible) vive en SecureStore
// (Keystore/Keychain), NO en AsyncStorage en texto plano. El resto del perfil
// liviano ({id, nombre}) sigue en AsyncStorage bajo 'solu_tech_session', que es
// lo que varias pantallas leen para saber si hay sesión y el id del técnico.
const SESSION_KEY = 'solu_tech_session'
const TOKEN_KEY = 'solu_tech_token'

export interface TechSessionMeta {
  id?: number
  nombre?: string
}

// Persiste la sesión tras login: {id, nombre} en AsyncStorage y el token en
// SecureStore. Si token es null/undefined, igual borra el token viejo del
// keystore para no dejar un Bearer huérfano.
export async function saveTechSession(meta: TechSessionMeta, token: string | null | undefined): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ id: meta.id, nombre: meta.nombre }))
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  } else {
    try { await SecureStore.deleteItemAsync(TOKEN_KEY) } catch {}
  }
}

// Lee el token Bearer del técnico desde SecureStore. Si no está (p. ej. sesión
// creada por una versión anterior que lo guardaba en AsyncStorage), hace
// fallback al token legacy embebido en 'solu_tech_session' y lo migra al
// keystore para que la próxima lectura ya sea segura. Así los técnicos ya
// logueados no quedan deslogueados tras actualizar.
export async function getTechToken(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(TOKEN_KEY)
    if (secure) return secure
    const raw = await AsyncStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const legacy = (JSON.parse(raw) as { token?: string })?.token ?? null
    if (legacy) {
      // Migración perezosa: mover el token al keystore y limpiarlo del JSON.
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, legacy)
        const parsed = JSON.parse(raw) as Record<string, unknown>
        delete parsed.token
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(parsed))
      } catch {}
    }
    return legacy
  } catch {
    return null
  }
}

// Lee {id, nombre} de la sesión (sin token). Para pantallas que solo necesitan
// saber si hay sesión y el id del técnico.
export async function getTechSessionMeta(): Promise<TechSessionMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: number; nombre?: string }
    return { id: parsed?.id, nombre: parsed?.nombre }
  } catch {
    return null
  }
}

// Cierra la sesión: borra {id, nombre} de AsyncStorage y el token del keystore.
export async function clearTechSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY)
  try { await SecureStore.deleteItemAsync(TOKEN_KEY) } catch {}
}
