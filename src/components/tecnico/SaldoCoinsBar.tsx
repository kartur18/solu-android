// Barra de saldo de SoluCoins del técnico.
//
// El saldo decide si puede o no responder a un cliente, pero vivía escondido
// en el tab "Billetera": desde la bandeja de mensajes el técnico no sabía con
// cuánto contaba ni por qué le rebotaba el envío. Esta barra lo deja a la
// vista donde se toma la decisión, con el camino a comprar en el mismo lugar.

import { Ionicons } from '@expo/vector-icons'
import { View, Text } from 'react-native'
import { THEME } from '../../lib/theme'
import { PressableScale, Shimmer } from '../ui/Motion'
import { aSoles, contactosAproxRestantes, estadoSaldo, formatCoins, type EstadoSaldo } from './lead-utils'

interface Props {
  saldo: number | null
  ilimitado?: boolean
  congelado?: boolean
  onComprar: () => void
}

interface Estilo {
  fondo: string
  borde: string
  icono: React.ComponentProps<typeof Ionicons>['name']
  colorIcono: string
  titulo: string
  detalle: string | null
  cta: string | null
  ctaPlena: boolean
}

function estiloDe(estado: EstadoSaldo, saldo: number | null): Estilo {
  const monto = saldo ?? 0
  const enSoles = `${formatCoins(monto)} coins ≈ S/${aSoles(monto)}`

  switch (estado) {
    case 'congelado':
      return {
        fondo: THEME.color.dangerBg,
        borde: THEME.color.danger,
        icono: 'snow',
        colorIcono: THEME.color.danger,
        titulo: 'Tu saldo está retenido',
        detalle: 'No puedes responder mientras esté retenido. Escríbenos por soporte para revisarlo.',
        cta: null,
        ctaPlena: false,
      }
    case 'ilimitado':
      return {
        fondo: THEME.color.infoBg,
        borde: THEME.color.info,
        icono: 'infinite',
        colorIcono: THEME.color.info,
        titulo: 'Coins ilimitados',
        detalle: 'Responder a tus clientes no te descuenta saldo.',
        cta: null,
        ctaPlena: false,
      }
    case 'sin-saldo':
      return {
        fondo: THEME.color.dangerBg,
        borde: THEME.color.danger,
        icono: 'alert-circle',
        colorIcono: THEME.color.danger,
        titulo: 'Te quedaste sin SoluCoins',
        detalle: 'Sin saldo puedes leer, pero no responder a los clientes que te escriben.',
        cta: 'Comprar SoluCoins',
        ctaPlena: true,
      }
    case 'bajo': {
      // "Pocos" no le sirve para decidir: el número de contactos que le
      // entran sí. Mismo cálculo que el portal web (leadsAproxRestantes).
      const contactos = contactosAproxRestantes(monto)
      return {
        fondo: THEME.color.warningBg,
        borde: THEME.color.warning,
        icono: 'battery-half',
        colorIcono: '#B45309',
        titulo: `Saldo bajo · ${enSoles}`,
        detalle:
          contactos > 0
            ? `Te alcanza para ${contactos} contacto${contactos === 1 ? '' : 's'} más, aproximadamente. Recarga antes de que llegue el próximo cliente.`
            : 'Puede que no te alcance para el próximo contacto. Recarga antes de perderlo.',
        cta: 'Comprar SoluCoins',
        ctaPlena: true,
      }
    }
    default:
      return {
        fondo: THEME.color.surface,
        borde: THEME.color.line,
        icono: 'wallet',
        colorIcono: THEME.color.brand,
        titulo: enSoles,
        detalle: null,
        cta: 'Comprar',
        ctaPlena: false,
      }
  }
}

export function SaldoCoinsBar({ saldo, ilimitado, congelado, onComprar }: Props) {
  const estado = estadoSaldo(saldo, ilimitado, congelado)

  // El layout (márgenes) lo pone la pantalla: acá solo el bloque.
  if (estado === 'cargando') return <Shimmer style={{ height: 64, borderRadius: THEME.radius.lg }} />

  const e = estiloDe(estado, saldo)

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Tu saldo: ${e.titulo}`}
      style={{
        backgroundColor: e.fondo,
        borderRadius: THEME.radius.lg,
        borderWidth: 1,
        borderColor: e.borde,
        padding: THEME.space.md,
        ...THEME.shadow.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
        <View style={{
          width: 36, height: 36, borderRadius: THEME.radius.md,
          backgroundColor: THEME.color.surface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={e.icono} size={19} color={e.colorIcono} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Tu saldo
          </Text>
          <Text numberOfLines={1} style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: 1 }}>
            {e.titulo}
          </Text>
        </View>

        {e.cta && (
          <PressableScale
            onPress={onComprar}
            accessibilityLabel="Comprar SoluCoins"
            style={{
              minHeight: 44,
              paddingHorizontal: THEME.space.lg,
              borderRadius: THEME.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: e.ctaPlena ? THEME.color.brand : THEME.color.brandLight,
              ...(e.ctaPlena ? THEME.shadow.brand : {}),
            }}
          >
            <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: e.ctaPlena ? THEME.color.white : THEME.color.brandDark }}>
              {e.cta}
            </Text>
          </PressableScale>
        )}
      </View>

      {e.detalle && (
        <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.sm, lineHeight: 19 }}>
          {e.detalle}
        </Text>
      )}
    </View>
  )
}

export default SaldoCoinsBar
