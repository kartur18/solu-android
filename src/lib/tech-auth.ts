import AsyncStorage from '@react-native-async-storage/async-storage'

// Lee el Bearer del técnico desde AsyncStorage (clave 'solu_tech_session', campo .token).
// Misma convención que getTechToken de notif-api/chat-api: el login persiste
// { id, nombre, token } y los endpoints (appointments, upload-doc) exigen ese token.
export async function getTechAuthToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('solu_tech_session')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed?.token ?? null
  } catch {
    return null
  }
}
