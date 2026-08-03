// Puente para el deep link que SOLU manda por WhatsApp y push:
//   https://www.solu.pe/chat/contacto/CONT-XXXXXX?t=TOKEN
//
// La app declara `pathPrefix: "/chat"` en sus intentFilters, así que se
// queda con ese link... pero no tenía ninguna ruta de tres segmentos que lo
// resolviera: `app/chat/[id].tsx` matchea `/chat/:id`, no
// `/chat/contacto/:codigo`. Resultado: el cliente tocaba el aviso de "tu
// técnico te respondió", la app abría y no pasaba nada. El técnico había
// pagado el lead para escribirle a alguien que no llegaba al chat.
//
// El token viene como `?t=` (así lo firma `urlChatCliente` en la web) y la
// pantalla de chat lo espera como `token`: se traduce acá.

import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { COLORS } from '../../../src/lib/constants'

export default function ChatContactoDeepLink() {
  const router = useRouter()
  const { codigo, t, token } = useLocalSearchParams<{
    codigo: string
    t?: string
    token?: string
  }>()

  useEffect(() => {
    const code = (codigo || '').trim()
    if (!code) {
      router.replace('/(tabs)')
      return
    }
    const chatToken = (t || token || '').trim()
    router.replace({
      pathname: '/chat/[id]',
      params: {
        id: code,
        codigo: code,
        as: 'cliente',
        ...(chatToken ? { token: chatToken } : {}),
      },
    })
  }, [codigo, t, token, router])

  return (
    <View style={s.centro}>
      <ActivityIndicator color={COLORS.pri} size="large" />
    </View>
  )
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.light },
})
