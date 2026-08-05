// Estado vacío con salida.
//
// Regla: un vacío nunca dice solo "no hay nada". Dice por qué no hay nada y
// qué hacer para que lo haya — si no, el técnico cierra la app y no vuelve.

import { Ionicons } from '@expo/vector-icons'
import { View, Text } from 'react-native'
import { THEME } from '../../lib/theme'
import { PressableScale } from '../ui/Motion'

export interface AccionVacio {
  texto: string
  onPress: () => void
}

export function EstadoVacio({
  icono,
  titulo,
  detalle,
  accion,
  accionSecundaria,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name']
  titulo: string
  detalle: string
  accion?: AccionVacio
  accionSecundaria?: AccionVacio
}) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', justifyContent: 'center',
      padding: THEME.space.xxxl, backgroundColor: THEME.color.surfaceAlt,
    }}>
      <View style={{
        width: 76, height: 76, borderRadius: THEME.radius.full,
        backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center',
        marginBottom: THEME.space.lg,
      }}>
        <Ionicons name={icono} size={36} color={THEME.color.brand} />
      </View>
      <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>{titulo}</Text>
      <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.sm, lineHeight: 20 }}>
        {detalle}
      </Text>

      {accion && (
        <PressableScale
          onPress={accion.onPress}
          accessibilityLabel={accion.texto}
          style={{
            backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg,
            minHeight: 48, paddingHorizontal: THEME.space.xxl,
            alignItems: 'center', justifyContent: 'center',
            marginTop: THEME.space.xl, ...THEME.shadow.brand,
          }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>{accion.texto}</Text>
        </PressableScale>
      )}

      {accionSecundaria && (
        <PressableScale
          onPress={accionSecundaria.onPress}
          accessibilityLabel={accionSecundaria.texto}
          style={{
            minHeight: 44, paddingHorizontal: THEME.space.xl,
            alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.md,
          }}
        >
          <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.brandDark }}>
            {accionSecundaria.texto}
          </Text>
        </PressableScale>
      )}
    </View>
  )
}

export default EstadoVacio
