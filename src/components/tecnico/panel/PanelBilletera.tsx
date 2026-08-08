// Pestaña "Billetera" del panel del técnico. V3.1: reemplaza el tab "Plan"
// del modelo mensual. Muestra el saldo real de SoluCoins, el tier loyalty y
// el acceso a la pantalla de compra de paquetes.

import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { fetchSaldoCoins, type SaldoCoins } from '../../../lib/creditos-api'
import { FadeInUp, PressableScale } from '../../ui/Motion'
import { ErrorDeCarga } from './ErrorDeCarga'
import { MovimientosCoins } from './MovimientosCoins'
import type { PagoCoins, TierInfo } from './panel-utils'

// "vencen hoy" y no "en 0 días": el día del vencimiento es justo cuando el
// countdown más tiene que empujar a usar el bono.
function textoVencimiento(dias: number): string {
  if (dias <= 0) return 'vencen HOY'
  if (dias === 1) return 'vencen mañana'
  return `vencen en ${dias} días`
}

export function PanelBilletera({
  tech,
  tierInfo,
  pagos,
  dashError,
  authToken,
  onReload,
  onComprarCoins,
}: {
  tech: Tecnico
  tierInfo: TierInfo
  pagos: PagoCoins[]
  dashError: boolean
  authToken: string | null
  onReload: () => void
  onComprarCoins: () => void
}) {
  // Desglose del bono (buckets + fecha de vencimiento). Si el server no lo
  // da (fallo o endpoint aún sin Bearer), la billetera queda como estaba:
  // saldo local de tech.coins_balance y ningún chip — sin falsas alarmas.
  const [saldo, setSaldo] = useState<SaldoCoins | null>(null)

  useEffect(() => {
    let vivo = true
    void fetchSaldoCoins(authToken).then((res) => {
      if (vivo && res.ok) setSaldo(res.data)
    })
    return () => { vivo = false }
  }, [authToken])

  const bonoCoins = saldo && !saldo.ilimitado ? saldo.saldo_bonus_inicial : 0
  const bonoDias = saldo?.dias_a_expirar_bonus ?? null
  // dias -1 = ya expiró (el server lazy-expira el saldo): no hay nada que avisar.
  const bonoVigente = bonoCoins > 0 && bonoDias !== null && bonoDias >= 0 && !!saldo?.fecha_expiracion_bonus
  const bonoUrgente = bonoVigente && bonoDias !== null && bonoDias <= 7
  const bonoFecha = bonoVigente && saldo?.fecha_expiracion_bonus
    ? new Date(saldo.fecha_expiracion_bonus).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    : ''

  return (
    <View style={{ gap: THEME.space.md }}>
      {/* Hero del wallet — saldo grande, tier, CTA comprar */}
      <FadeInUp delay={0}>
      <View style={{
        backgroundColor: THEME.color.navy, borderRadius: THEME.radius.xl, padding: 22, overflow: 'hidden', ...THEME.shadow.lg,
      }}>
        <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(242,107,33,0.14)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.sm }}>
          <Ionicons name="wallet" size={16} color="#FCD34D" />
          <Text style={{ ...THEME.font.label, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Mi billetera
          </Text>
        </View>
        <Text style={{ ...THEME.font.display, fontSize: 36, color: THEME.color.white }}>
          {(tech.coins_balance ?? 0).toLocaleString('es-PE')}
        </Text>
        <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
          SoluCoins disponibles
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.md }}>
          <Text style={{ fontSize: 14 }}>{tierInfo.emoji}</Text>
          <Text style={{ ...THEME.font.label, fontWeight: '700', color: '#FCD34D' }}>
            Tier {tierInfo.name}
          </Text>
        </View>
        {/* El beneficio del tier no se mencionaba en ninguna pantalla
            de la app: el argumento central de retención era invisible
            justo para quien lo paga. */}
        <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
          {tierInfo.descuento > 0
            ? `Tu tier te da ${tierInfo.descuento}% de descuento en cada paquete de SoluCoins.`
            : 'Completa 10 servicios y sube a Plata: 8% de descuento en cada paquete de SoluCoins.'}
        </Text>

        {/* Desglose del bono: la parte del saldo que tiene fecha de muerte.
            Sin esto, el saldo cayendo a 0 al día 31 parecía una estafa. */}
        {bonoVigente && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            backgroundColor: 'rgba(252,211,77,0.14)', borderRadius: THEME.radius.full,
            paddingHorizontal: THEME.space.md, paddingVertical: 6, marginTop: THEME.space.md,
          }}>
            <Ionicons name="gift" size={13} color="#FCD34D" />
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: '#FCD34D' }}>
              De regalo: {bonoCoins.toLocaleString('es-PE')} coins — vencen el {bonoFecha} ({bonoDias === 0 ? 'hoy' : bonoDias === 1 ? '1 día' : `${bonoDias} días`})
            </Text>
          </View>
        )}

        <PressableScale
          onPress={onComprarCoins}
          accessibilityLabel="Comprar SoluCoins"
          style={{
            backgroundColor: THEME.color.brand,
            borderRadius: THEME.radius.lg, height: 52,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
            marginTop: THEME.space.lg, ...THEME.shadow.brand,
          }}
        >
          <Ionicons name="add-circle-outline" size={18} color={THEME.color.white} />
          <Text style={{ ...THEME.font.body, color: THEME.color.white, fontWeight: '800' }}>
            Comprar SoluCoins
          </Text>
        </PressableScale>
      </View>
      </FadeInUp>

      {/* Countdown urgente: a ≤7 días el bono ya no es un dato, es una
          cuenta regresiva sobre plata que se esfuma. */}
      {bonoUrgente && bonoDias !== null && (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: THEME.color.warningBg, borderWidth: 1, borderColor: '#FDE68A',
            borderRadius: THEME.radius.lg, padding: THEME.space.lg,
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>⏳</Text>
          <Text style={{ flex: 1, ...THEME.font.bodySm, fontWeight: '700', color: '#92400E', lineHeight: 19 }}>
            Te quedan {bonoCoins.toLocaleString('es-PE')} coins de bono — {textoVencimiento(bonoDias)}. Úsalos en tus próximos leads.
          </Text>
        </View>
      )}

      {/* Últimos movimientos del ledger (carga y falla por su cuenta: un
          error acá no toca el saldo ni el historial de pagos de siempre) */}
      <MovimientosCoins authToken={authToken} />

      {/* Cómo funciona el modelo prepago */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: 10 }}>
          ¿Cómo funcionan los SoluCoins?
        </Text>
        {[
          { icon: 'flash-outline' as const, text: 'Compras un paquete una vez. No hay suscripción.' },
          { icon: 'chatbubble-ellipses-outline' as const, text: 'Cuando un cliente te escribe y respondes, descontamos coins según el oficio y distrito.' },
          { icon: 'receipt-outline' as const, text: 'Recibes tu boleta SUNAT automática por cada compra.' },
          { icon: 'trending-up-outline' as const, text: 'Cuanto más grande el paquete, mejor el precio por lead.' },
          // La web lo dice en /planes y /registro-tecnico; la app callaba
          // el vencimiento del mismo dinero y el saldo en 0 al día 35
          // parecía una estafa.
          { icon: 'gift-outline' as const, text: 'Tus 8,000 SoluCoins de bienvenida vencen a los 30 días de crear tu cuenta: aprovéchalos tu primer mes.' },
        ].map((item, i, arr) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: i < arr.length - 1 ? 10 : 0 }}>
            <Ionicons name={item.icon} size={18} color={THEME.color.brand} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, lineHeight: 18 }}>
              {item.text}
            </Text>
          </View>
        ))}
      </View>

      {/* Payment history */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
          <Ionicons name="receipt-outline" size={18} color={THEME.color.ink} />
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Historial de pagos</Text>
        </View>
        {pagos.length === 0 && dashError ? (
          <ErrorDeCarga titulo="No pudimos cargar tu historial de pagos" onRetry={onReload} />
        ) : pagos.length === 0 ? (
          <View style={{ alignItems: 'center', padding: THEME.space.xl }}>
            <Ionicons name="wallet-outline" size={32} color={THEME.color.inkMuted} />
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.sm }}>Sin pagos registrados</Text>
            <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center' }}>Cuando compres SoluCoins verás tus compras aquí</Text>
          </View>
        ) : (
          pagos.map((pago) => {
            const methodColors: Record<string, string> = { culqi: '#7C3AED', yape: '#9333EA', tarjeta: THEME.color.info }
            const methodColor = (pago.metodo && methodColors[pago.metodo]) || THEME.color.inkSoft
            return (
              <View key={pago.id} style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}>
                <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: methodColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={pago.metodo === 'yape' ? 'phone-portrait' : 'card'} size={18} color={methodColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>
                    {pago.plan ? `Paquete ${pago.plan.charAt(0).toUpperCase() + pago.plan.slice(1)}` : 'Compra de SoluCoins'}
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>
                    {new Date(pago.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })} · {pago.metodo || 'N/A'}
                  </Text>
                </View>
                <Text style={{ ...THEME.font.body, fontWeight: '800', color: THEME.color.success }}>S/{pago.monto || '0'}</Text>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}

export default PanelBilletera
