// Sección "Últimos movimientos" de la Billetera: el ledger de SoluCoins con
// descripción humana por tipo, monto firmado y paginación ("Ver más").
//
// Si el server responde 'no_disponible' (hoy /api/creditos/movimientos solo
// acepta cookie web, no el Bearer de la app), la sección NO se renderiza:
// mostrar un "no pudimos cargar" con un reintento que jamás funciona sería
// disfrazar una limitación del server de fallo de red. Cuando el endpoint
// acepte Bearer, la sección aparece sola sin release de la app.

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../../lib/theme'
import {
  fetchMovimientosCoins,
  type MovimientoCoins,
} from '../../../lib/creditos-api'
import { ErrorDeCarga } from './ErrorDeCarga'
import { timeAgo } from './panel-utils'
import { Shimmer } from '../../ui/Motion'

const POR_PAGINA = 10

// Cómo se lee cada tipo del ledger: ícono + título en cristiano. El monto
// firmado ya dice si suma o resta; acá va el "por qué".
function presentacionMovimiento(m: MovimientoCoins): {
  icon: keyof typeof Ionicons.glyphMap
  titulo: string
} {
  const detalle = m.detalle ?? {}
  switch (m.tipo) {
    case 'consumo': {
      const codigo = typeof detalle.codigo === 'string' ? ` ${detalle.codigo}` : ''
      return { icon: 'chatbubble-ellipses-outline', titulo: `Contacto de lead${codigo}` }
    }
    case 'comision_cobro':
      return { icon: 'cash-outline', titulo: 'Comisión por cobro en efectivo' }
    case 'compra': {
      // detalle.paquete_slug viene como 'popular_v31' → "Popular".
      const slug = typeof detalle.paquete_slug === 'string' ? detalle.paquete_slug : ''
      const base = slug.replace(/_v\d+$/, '')
      const nombre = base ? ` ${base.charAt(0).toUpperCase()}${base.slice(1)}` : ''
      return { icon: 'cart-outline', titulo: `Compra de paquete${nombre}` }
    }
    case 'cashback':
      return { icon: 'sparkles-outline', titulo: 'Cashback' }
    case 'gift':
      return { icon: 'gift-outline', titulo: 'Bono de regalo' }
    case 'bonus_inicial':
      return { icon: 'gift-outline', titulo: 'Bono de bienvenida' }
    case 'bonus_verificacion_dni':
      return { icon: 'shield-checkmark-outline', titulo: 'Bono por verificar tu DNI' }
    case 'bonus_retroactivo':
      return { icon: 'gift-outline', titulo: 'Bono retroactivo' }
    case 'asignacion_suscripcion':
      return { icon: 'refresh-outline', titulo: 'Coins de tu plan' }
    case 'expiracion_bonus':
      return { icon: 'time-outline', titulo: 'Bono de bienvenida vencido' }
    case 'expiracion_suscripcion':
      return { icon: 'time-outline', titulo: 'Coins de plan vencidos' }
    case 'reembolso_cancelacion':
      return { icon: 'arrow-undo-outline', titulo: 'Reembolso por cancelación' }
    case 'reembolso_indecopi':
      return { icon: 'arrow-undo-outline', titulo: 'Reembolso' }
    case 'ajuste_admin':
      return { icon: 'construct-outline', titulo: 'Ajuste de SOLU' }
    case 'congelacion':
      return { icon: 'snow-outline', titulo: 'Saldo congelado' }
    case 'descongelacion':
      return { icon: 'sunny-outline', titulo: 'Saldo descongelado' }
    default:
      return { icon: 'swap-vertical-outline', titulo: 'Movimiento de coins' }
  }
}

export function MovimientosCoins({ authToken }: { authToken: string | null }) {
  const [filas, setFilas] = useState<MovimientoCoins[]>([])
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<'transitorio' | 'no_disponible' | null>(null)
  const [pagina, setPagina] = useState(1)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setFallo(null)
    const res = await fetchMovimientosCoins(authToken, 1, POR_PAGINA)
    if (res.ok) {
      setFilas(res.data.movimientos)
      setPagina(1)
      setHayMas(res.data.has_more)
    } else {
      setFallo(res.motivo)
    }
    setCargando(false)
  }, [authToken])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function verMas() {
    if (cargandoMas) return
    setCargandoMas(true)
    const res = await fetchMovimientosCoins(authToken, pagina + 1, POR_PAGINA)
    if (res.ok) {
      setFilas((prev) => [...prev, ...res.data.movimientos])
      setPagina((p) => p + 1)
      setHayMas(res.data.has_more)
    } else {
      // Falló la página siguiente, no lo ya mostrado: se mantiene la lista y
      // el botón para volver a intentar.
      setHayMas(true)
    }
    setCargandoMas(false)
  }

  if (fallo === 'no_disponible') return null

  return (
    <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
        <Ionicons name="swap-vertical" size={18} color={THEME.color.ink} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Últimos movimientos</Text>
      </View>

      {cargando ? (
        <View style={{ gap: THEME.space.md }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
              <Shimmer style={{ width: 40, height: 40, borderRadius: THEME.radius.md }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Shimmer style={{ height: 12, borderRadius: 6, width: '70%' }} />
                <Shimmer style={{ height: 10, borderRadius: 5, width: '40%' }} />
              </View>
              <Shimmer style={{ width: 52, height: 14, borderRadius: 7 }} />
            </View>
          ))}
        </View>
      ) : fallo === 'transitorio' ? (
        <ErrorDeCarga titulo="No pudimos cargar tus movimientos" onRetry={() => { void cargar() }} />
      ) : filas.length === 0 ? (
        <View style={{ alignItems: 'center', padding: THEME.space.xl }}>
          <Ionicons name="swap-vertical" size={32} color={THEME.color.inkMuted} />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.sm }}>
            Aún sin movimientos
          </Text>
          <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center' }}>
            Cuando uses o recibas SoluCoins verás cada movimiento aquí
          </Text>
        </View>
      ) : (
        <>
          {filas.map((m) => {
            const { icon, titulo } = presentacionMovimiento(m)
            const color = m.cantidad > 0 ? THEME.color.success : m.cantidad < 0 ? THEME.color.danger : THEME.color.inkSoft
            return (
              <View
                key={m.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}
              >
                <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }} numberOfLines={1}>
                    {titulo}
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>
                    {timeAgo(m.created_at) === 'ahora' ? 'recién' : `hace ${timeAgo(m.created_at)}`}
                  </Text>
                </View>
                <Text style={{ ...THEME.font.body, fontWeight: '800', color }}>
                  {m.cantidad > 0 ? '+' : ''}{m.cantidad.toLocaleString('es-PE')}
                </Text>
              </View>
            )
          })}

          {hayMas && (
            <TouchableOpacity
              onPress={() => { void verMas() }}
              disabled={cargandoMas}
              accessibilityLabel="Ver más movimientos"
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginTop: THEME.space.sm }}
            >
              {cargandoMas ? (
                <ActivityIndicator size="small" color={THEME.color.info} />
              ) : (
                <>
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.info }}>Ver más</Text>
                  <Ionicons name="chevron-down" size={14} color={THEME.color.info} />
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

export default MovimientosCoins
