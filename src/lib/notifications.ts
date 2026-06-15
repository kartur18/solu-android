import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as Notifications.NotificationBehavior),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    logger.log('Push notifications require a physical device')
    return null
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    logger.log('Push notification permission denied')
    return null
  }

  // Android notification channels. El server (push.ts) manda los push de
  // leads con channelId 'requests', los de chat con 'messages' y los de
  // coins con 'billing'. Si el canal no existe en el device, el push pierde
  // la importancia/sonido configurado, así que los creamos todos acá.
  if (Platform.OS === 'android') {
    const HIGH = Notifications.AndroidImportance.HIGH
    const vibrationPattern = [0, 250, 250, 250]
    const lightColor = '#F26B21'
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SOLU Notificaciones',
      importance: HIGH,
      vibrationPattern,
      lightColor,
      sound: 'default',
    })
    // Leads nuevos — el canal más importante para el técnico.
    await Notifications.setNotificationChannelAsync('requests', {
      name: 'Nuevos pedidos',
      importance: HIGH,
      vibrationPattern,
      lightColor,
      sound: 'default',
    })
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Mensajes de chat',
      importance: HIGH,
      vibrationPattern,
      lightColor,
      sound: 'default',
    })
    await Notifications.setNotificationChannelAsync('billing', {
      name: 'Coins y pagos',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor,
      sound: 'default',
    })
  }

  // Get push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: ENV.EXPO_PROJECT_ID,
    })
    return tokenData.data
  } catch (err) {
    logger.error('Failed to get push token:', err)
    return null
  }
}

// Guarda el push token del técnico vía endpoint server-side (Bearer). La
// escritura directa a `tecnicos` con la key anon quedó bloqueada por el
// lockdown -> el token no se guardaba y los push nunca llegaban. El id sale
// del token en el server, no del param (se mantiene por compat de llamadas).
export async function savePushToken(_tecnicoId: number, token: string) {
  try {
    const raw = await AsyncStorage.getItem('solu_tech_session')
    const bearer = raw ? (JSON.parse(raw) as { token?: string })?.token : null
    if (!bearer) return
    await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ token }),
    })
  } catch (err) {
    logger.error('Failed to save push token:', err)
  }
}

/**
 * Guarda el push token del cliente (guest o logueado) vía endpoint server-side.
 * El server crea una fila mínima en clientes_users si no existe, igual que
 * antes, pero con service_role (anon estaba bloqueado por el lockdown).
 */
export async function upsertGuestClientPushToken(whatsapp: string, token: string, nombre?: string) {
  try {
    await fetchWithTimeout(`${ENV.API_BASE_URL}/cliente/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp: whatsapp.replace(/\D/g, ''), token, nombre }),
    })
  } catch (err) {
    logger.error('Failed to upsert guest client push token:', err)
  }
}

/** Send a local notification immediately (no server needed) */
export async function sendLocalNotification(title: string, body: string, data?: Record<string, string>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data || {}, sound: 'default' },
      trigger: null, // show immediately
    })
  } catch (err) {
    logger.error('Failed to send local notification:', err)
  }
}

/** Map service status to notification message */
export function getStatusNotification(estado: string, servicio: string): { title: string; body: string } | null {
  const messages: Record<string, { title: string; body: string }> = {
    'Asignado':   { title: '👷 Técnico asignado', body: `Un técnico fue asignado a tu solicitud de ${servicio}` },
    'En camino':  { title: '🚗 Tu técnico está en camino', body: `El técnico de ${servicio} ya va hacia tu ubicación` },
    'En proceso': { title: '🔧 Trabajo iniciado', body: `Tu servicio de ${servicio} está en proceso` },
    'Completado': { title: '✅ Servicio completado', body: `Tu ${servicio} fue completado. ¡Califica al técnico!` },
    'Cancelado':  { title: '❌ Servicio cancelado', body: `Tu solicitud de ${servicio} fue cancelada` },
  }
  return messages[estado] || null
}
