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
  // El estado va arriba en chico (antes iba pegado al monto y lo empujaba
  // fuera del renglón). El título queda solo para el dato que importa.
  etiqueta: string
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
        etiqueta: 'Saldo retenido',
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
        etiqueta: 'Tu saldo',
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
        etiqueta: 'Sin saldo',
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
        etiqueta: 'Saldo bajo',
        titulo: enSoles,
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
        // Este es el único estado donde el CTA sigue compartiendo renglón, así
        // que al título le quedan ~155px en 360dp: "16,000 coins ≈ S/80.00"
        // (~180px) se cortaba el equivalente en soles. Sube al eyebrow, que
        // al ser 11px entra de sobra, y el monto en coins queda entero.
        etiqueta: `Tu saldo · S/${aSoles(monto)}`,
        titulo: `${formatCoins(monto)} coins`,
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
      accessibilityLabel={`${e.etiqueta}: ${e.titulo}`}
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
            {e.etiqueta}
          </Text>
          <Text numberOfLines={1} style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: 1 }}>
            {e.titulo}
          </Text>
        </View>

        {/* CTA corta al lado; la larga ("Comprar SoluCoins") va abajo a lo
            ancho. Compartiendo renglón le dejaba ~100px al monto y con
            numberOfLines=1 se comía justo el número que decide si puede
            responder. */}
        {e.cta && !e.ctaPlena && (
          <PressableScale
            onPress={onComprar}
            accessibilityLabel="Comprar SoluCoins"
            style={{
              minHeight: 44,
              paddingHorizontal: THEME.space.lg,
              borderRadius: THEME.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: THEME.color.brandLight,
            }}
          >
            <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.brandDark }}>
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

      {e.cta && e.ctaPlena && (
        <PressableScale
          onPress={onComprar}
          accessibilityLabel="Comprar SoluCoins"
          style={{
            minHeight: 44,
            marginTop: THEME.space.md,
            borderRadius: THEME.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: THEME.color.brand,
            ...THEME.shadow.brand,
          }}
        >
          <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.white }}>
            {e.cta}
          </Text>
        </PressableScale>
      )}
    </View>
  )
}

export default SaldoCoinsBar
