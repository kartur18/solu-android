import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Sentry from '@sentry/react-native'
import { COLORS } from '../src/lib/constants'
import { ENV } from '../src/lib/env'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { useAppUpdate } from '../src/lib/useAppUpdate'
import { initAnalytics, track } from '../src/lib/analytics'
import { OnboardingModal } from '../src/components/OnboardingModal'

// Initialize Sentry for crash reporting
Sentry.init({
  dsn: ENV.SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: !__DEV__,
})

export default function RootLayout() {
  useAppUpdate()

  useEffect(() => {
    initAnalytics().then(() => track('App Opened'))
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
        <Stack.Screen name="registro" options={{ title: 'Registro de técnico', presentation: 'modal' }} />
        <Stack.Screen name="agendar/[id]" options={{ title: 'Agendar servicio', presentation: 'modal' }} />
        <Stack.Screen name="privacidad" options={{ title: 'Política de Privacidad', presentation: 'modal' }} />
        <Stack.Screen name="terminos" options={{ title: 'Términos y Condiciones', presentation: 'modal' }} />
        <Stack.Screen name="fidelidad" options={{ title: 'Mi Fidelidad', presentation: 'modal' }} />
        <Stack.Screen name="urgencias" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="soporte" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="eliminar-cuenta" options={{ title: 'Eliminar cuenta', presentation: 'modal' }} />
        <Stack.Screen name="recuperar" options={{ title: 'Recuperar contraseña', presentation: 'modal' }} />
        <Stack.Screen name="registro-cliente" options={{ title: 'Crear cuenta', presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  )
}
