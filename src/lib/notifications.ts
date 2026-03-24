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
