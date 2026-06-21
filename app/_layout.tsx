import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import * as Sentry from '@sentry/react-native'
import { COLORS } from '../src/lib/constants'
import { ENV } from '../src/lib/env'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { useAppUpdate } from '../src/lib/useAppUpdate'
import { OnboardingModal } from '../src/components/OnboardingModal'

// Initialize Sentry for crash reporting. Sin DSN no inicializamos: evita peso
// muerto y ruido (un init con dsn vacío no reporta nada igual).
// TODO(carlos): setear SENTRY_DSN en EAS secrets para activar.
if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    tracesSampleRate: 0.2,
    enabled: !__DEV__,
  })
}

// Configure how notifications are shown when app is in foreground (SDK 55+ fields)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export default function RootLayout() {
  useAppUpdate()
  const router = useRouter()
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data
      if (data?.type === 'new_request') {
        // Show in-app alert for new requests
        Alert.alert(
          notification.request.content.title || 'Nueva solicitud',
          notification.request.content.body || '',
          [
            { text: 'Ver después', style: 'cancel' },
            { text: 'Ver solicitud', onPress: () => router.push('/(tabs)/cuenta') },
          ]
        )
      }
    })

    // Listen for when user taps on a notification.
    // El server (pushToTechs) manda type 'chat_mensaje'/'nuevo_contacto' con
    // `codigo` -> abrimos el chat correcto como técnico. Antes el handler
    // esperaba 'new_message'+chatId y estos taps caían al else (iban a cuenta).
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as {
        type?: string; codigo?: string; chatId?: string
      }
      const type = data?.type
      if ((type === 'chat_mensaje' || type === 'nuevo_contacto') && data?.codigo) {
        router.push(`/chat-pedido/${data.codigo}?as=tecnico`)
      } else if (type === 'new_message' && data?.chatId) {
        router.push(`/chat/${data.chatId}`)
      } else {
        // new_request, cancelacion, plan_*, y cualquier otro → panel del técnico
        router.push('/(tabs)/cuenta')
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  return (
    <ErrorBoundary>
      <OnboardingModal />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.white },
          headerTintColor: COLORS.dark,
          headerTitleStyle: { fontWeight: '800', fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.light },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tecnico/[id]" options={{ title: 'Perfil del técnico' }} />
        <Stack.Screen name="tracking/[code]" options={{ title: 'Seguimiento' }} />
        <Stack.Screen name="calificar/[code]" options={{ title: 'Calificar servicio' }} />
        <Stack.Screen name="solicitar" options={{ title: 'Solicitar técnico', presentation: 'modal' }} />
        <Stack.Screen name="cotizar-foto" options={{ title: 'Cotiza con una foto', presentation: 'modal' }} />
        <Stack.Screen name="registro" options={{ title: 'Registro de técnico', presentation: 'modal' }} />
        <Stack.Screen name="agendar/[id]" options={{ title: 'Agendar servicio', presentation: 'modal' }} />
        <Stack.Screen name="privacidad" options={{ title: 'Política de Privacidad', presentation: 'modal' }} />
        <Stack.Screen name="terminos" options={{ title: 'Términos y Condiciones', presentation: 'modal' }} />
        <Stack.Screen name="fidelidad" options={{ title: 'Mi Fidelidad', presentation: 'modal' }} />
        <Stack.Screen name="urgencias" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="soporte" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="asistente" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="chat-pedido/[code]" options={{ title: 'Chat' }} />
        <Stack.Screen name="eliminar-cuenta" options={{ title: 'Eliminar cuenta', presentation: 'modal' }} />
        <Stack.Screen name="recuperar" options={{ title: 'Recuperar contraseña', presentation: 'modal' }} />
        <Stack.Screen name="registro-cliente" options={{ title: 'Crear cuenta', presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  )
}
