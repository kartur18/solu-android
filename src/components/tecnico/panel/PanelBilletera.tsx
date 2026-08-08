// Pestaña "Billetera" del panel del técnico. V3.1: reemplaza el tab "Plan"
// del modelo mensual. Muestra el saldo real de SoluCoins, el tier loyalty y
// el acceso a la pantalla de compra de paquetes.

import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { FadeInUp, PressableScale } from '../../ui/Motion'
import { ErrorDeCarga } from './ErrorDeCarga'
import type { PagoCoins, TierInfo } from './panel-utils'

export function PanelBilletera({
  tech,
  tierInfo,
  pagos,
  dashError,
  onReload,
  onComprarCoins,
}: {
  tech: Tecnico
  tierInfo: TierInfo
  pagos: PagoCoins[]
  dashError: boolean
  onReload: () => void
  onComprarCoins: () => void
}) {
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
