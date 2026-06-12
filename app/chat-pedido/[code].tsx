import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { useLocalSearchParams, Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LiveChat } from '../../src/components/LiveChat'
import { supabase } from '../../src/lib/supabase'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale } from '../../src/components/ui/Motion'

export default function ChatPedidoScreen() {
  const router = useRouter()
  const { code, as } = useLocalSearchParams<{ code: string; as?: 'cliente' | 'tecnico' }>()
  const role: 'cliente' | 'tecnico' = as === 'tecnico' ? 'tecnico' : 'cliente'
  const [techNombre, setTechNombre] = useState<string | undefined>()

  useEffect(() => {
    if (!code) return
    supabase
      .from('clientes')
      .select('tecnico_asignado, tecnicos(nombre)')
      .eq('codigo', code)
      .single()
      .then(({ data }) => {
        const tecnicos = data?.tecnicos as { nombre?: string }[] | { nombre?: string } | null | undefined
        const nombre = Array.isArray(tecnicos) ? tecnicos[0]?.nombre : tecnicos?.nombre
        if (nombre) setTechNombre(nombre)
      })
  }, [code])

  if (!code) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xl, backgroundColor: THEME.color.surfaceAlt }}>
        <FadeInUp style={{ alignItems: 'center', width: '100%' }}>
          <View style={{ width: 84, height: 84, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={THEME.color.brand} />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center' }}>No encontramos este chat</Text>
          <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
            Vuelve a abrirlo desde el seguimiento de tu pedido
          </Text>
          <PressableScale
            onPress={() => router.replace('/')}
            accessibilityLabel="Volver al inicio"
            style={{ marginTop: THEME.space.xl, minHeight: 52, paddingHorizontal: THEME.space.xxl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: THEME.space.sm, ...THEME.shadow.brand }}
          >
            <Ionicons name="home-outline" size={18} color={THEME.color.white} />
            <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Ir al inicio</Text>
          </PressableScale>
        </FadeInUp>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: role === 'cliente' ? (techNombre ? `Chat con ${techNombre}` : 'Chat con técnico') : 'Chat con cliente' }} />
      <LiveChat codigo={code} as={role} techNombre={techNombre} />
    </>
  )
}
