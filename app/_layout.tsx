import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { COLORS } from '../src/lib/constants'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

export default function RootLayout() {
  return (
    <ErrorBoundary>
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
      </Stack>
    </ErrorBoundary>
  )
}
