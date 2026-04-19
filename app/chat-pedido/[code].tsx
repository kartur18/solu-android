import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { LiveChat } from '../../src/components/LiveChat'
import { supabase } from '../../src/lib/supabase'
import { COLORS } from '../../src/lib/constants'

export default function ChatPedidoScreen() {
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: COLORS.gray }}>Código inválido</Text>
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
