// Entrada de cambio de modo para los headers oscuros del panel del técnico y
// de la pantalla de servicios del cliente.
//
// La misma persona puede tener las dos cuentas (mismo WhatsApp, accesos
// distintos). Esta entrada solo alterna cuál se está viendo: ninguna sesión se
// cierra. Si la otra cuenta no existe en el teléfono, `destino` llega en null
// y no se muestra nada — no mandamos a nadie a un login que no pidió.

import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { THEME } from '../lib/theme'
import { PressableScale } from './ui/Motion'
import { cambiarModo } from '../lib/modo-sesion'
import {
  DETALLE_CAMBIO_MODO,
  etiquetaAccesibleCambioModo,
  etiquetaCambioModo,
  type ModoCuenta,
} from '../lib/modo-cuenta'

export function CambiarModo({ destino, onCambiado }: {
  destino: ModoCuenta | null
  // Lo que hace la pantalla después de cambiar: reflejarlo si está embebida en
  // Mi cuenta, o navegar hasta ahí si se abrió sola.
  onCambiado: () => void
}) {
  if (!destino) return null

  return (
    <PressableScale
      onPress={() => { cambiarModo(destino); onCambiado() }}
      accessibilityLabel={etiquetaAccesibleCambioModo(destino)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: THEME.space.md,
        // 48px: se toca con el celular en una mano y no compite con el resto
        // de los botones del header.
        minHeight: 48,
        paddingHorizontal: THEME.space.lg,
        paddingVertical: THEME.space.md,
        borderRadius: THEME.radius.lg,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Ionicons name="swap-horizontal" size={18} color={THEME.color.brand} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.white }}>
          {etiquetaCambioModo(destino)}
        </Text>
        <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
          {DETALLE_CAMBIO_MODO}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
    </PressableScale>
  )
}

export default CambiarModo
