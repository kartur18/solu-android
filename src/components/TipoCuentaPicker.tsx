import React from 'react'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../lib/theme'
import { PressableScale } from './ui/Motion'

export type TipoCuenta = 'cliente' | 'tecnico'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const OPCIONES: { tipo: TipoCuenta; titulo: string; detalle: string; icon: IconName }[] = [
  { tipo: 'cliente', titulo: 'Soy cliente', detalle: 'Pido servicios', icon: 'home-outline' },
  { tipo: 'tecnico', titulo: 'Soy técnico', detalle: 'Ofrezco servicios', icon: 'construct-outline' },
]

/**
 * Selector de tipo de cuenta (cliente / técnico).
 *
 * Existe porque el backend responde igual exista o no la cuenta
 * (anti-enumeración): la app no puede adivinar el tipo probando, así que lo
 * elige la persona. Mismo criterio que la web, que lo recibe por ?tipo=.
 */
export default function TipoCuentaPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TipoCuenta | null
  onChange: (tipo: TipoCuenta) => void
  disabled?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row', gap: THEME.space.md, marginBottom: THEME.space.lg }}>
      {OPCIONES.map((op) => {
        const activo = value === op.tipo
        return (
          <PressableScale
            key={op.tipo}
            onPress={() => onChange(op.tipo)}
            disabled={disabled}
            // PressableScale no expone accessibilityState, así que el estado va
            // en el label: sin esto TalkBack no dice cuál opción quedó elegida.
            accessibilityLabel={`${op.titulo}. ${op.detalle}.${activo ? ' Seleccionado' : ''}`}
            style={{
              flex: 1,
              minHeight: 88,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: THEME.space.md,
              paddingHorizontal: THEME.space.sm,
              borderRadius: THEME.radius.lg,
              borderWidth: 2,
              borderColor: activo ? THEME.color.brand : THEME.color.line,
              backgroundColor: activo ? THEME.color.brandLight : THEME.color.surfaceAlt,
            }}
          >
            <Ionicons
              name={op.icon}
              size={22}
              color={activo ? THEME.color.brand : THEME.color.inkMuted}
            />
            <Text
              style={{
                ...THEME.font.bodySm,
                fontWeight: '800',
                color: activo ? THEME.color.brand : THEME.color.ink,
              }}
            >
              {op.titulo}
            </Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{op.detalle}</Text>
          </PressableScale>
        )
      })}
    </View>
  )
}
