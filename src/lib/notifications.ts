import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from './supabase'
import { ENV } from './env'
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

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SOLU Notificaciones',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F26B21',
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

export async function savePushToken(tecnicoId: number, token: string) {
  try {
    await supabase
      .from('tecnicos')
      .update({ push_token: token })
      .eq('id', tecnicoId)
  } catch (err) {
    logger.error('Failed to save push token:', err)
  }
}

export async function saveClientPushToken(clienteUserId: number, token: string) {
  try {
    await supabase
      .from('clientes_users')
      .update({ push_token: token })
      .eq('id', clienteUserId)
  } catch (err) {
    logger.error('Failed to save client push token:', err)
  }
}

/**
 * Upsert push token for a guest client identified by whatsapp.
 * Creates a minimal clientes_users row if missing so state-change pushes work
 * even for clients that never formally registered.
 */
export async function upsertGuestClientPushToken(whatsapp: string, token: string, nombre?: string) {
  try {
    const { data: existing } = await supabase
      .from('clientes_users')
      .select('id')
      .eq('whatsapp', whatsapp)
      .maybeSingle()

    if (existing?.id) {
      await supabase
        .from('clientes_users')
        .update({ push_token: token })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('clientes_users')
        .insert({
          whatsapp,
          nombre: nombre || 'Cliente SOLU',
          push_token: token,
          password_hash: '',
          created_at: new Date().toISOString(),
        })
    }
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
