// Pantalla "Coordinar pago" — V3.1.
//
// CAMBIO DE MODELO 2026-05-13: SOLU eliminó el escrow. El cliente paga
// DIRECTO al técnico (Yape/Plin/efectivo/tarjeta), SOLU no procesa esa
// transacción. La monetización ahora es solo la venta de SoluCoins al
// técnico (lado opuesto del marketplace).
//
// Esta pantalla antes corría el flujo de escrow Culqi en webview; ahora
// muestra info clara sobre cómo coordinar el pago con el técnico y un
// botón para abrir WhatsApp directo. Mantiene la ruta /pago/[solicitudId]
// para no romper deep links viejos que puedan estar circulando.

import { View, Text, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../../src/components/ui/Motion'

const METODOS: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { icon: 'phone-portrait', label: 'Yape', color: '#742284' },
  { icon: 'card', label: 'Plin', color: '#00B2A9' },
  { icon: 'cash', label: 'Efectivo', color: THEME.color.success },
  { icon: 'card-outline', label: 'Tarjeta', color: THEME.color.info },
]

export default function CoordinarPagoScreen() {
  const router = useRouter()
  const { solicitudId } = useLocalSearchParams<{ solicitudId: string }>()

  const abrirTracking = () => {
    // El cliente coordina con el técnico por WhatsApp (canal donde ya
    // están hablando). El número del técnico lo tiene en /tracking.
    haptics.success()
    Linking.openURL('https://www.solu.pe/tracking/' + (solicitudId ?? ''))
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ padding: THEME.space.xl, paddingBottom: THEME.space.xxxl }}>
      {/* Hero */}
      <FadeInUp>
        <View style={{ alignItems: 'center', marginTop: THEME.space.xxl, marginBottom: THEME.space.xxl }}>
          <View style={{
            width: 88, height: 88, borderRadius: THEME.radius.full,
            backgroundColor: THEME.color.brandLight,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: THEME.space.lg, ...THEME.shadow.sm,
          }}>
            <Ionicons name="cash-outline" size={44} color={THEME.color.brand} />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center' }}>
            Coordina el pago con tu técnico
          </Text>
          <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.sm }}>
            Tú acuerdas el monto y el medio de pago directamente con él.
          </Text>
        </View>
      </FadeInUp>

      {/* Explicación + métodos */}
      <FadeInUp delay={60}>
        <View style={{
          backgroundColor: THEME.color.surface,
          borderRadius: THEME.radius.xl, padding: THEME.space.xl, marginBottom: THEME.space.lg,
          ...THEME.shadow.md,
        }}>
          <Text style={{ ...THEME.font.body, color: THEME.color.ink, lineHeight: 22, marginBottom: THEME.space.md }}>
            En SOLU el pago se hace <Text style={{ fontWeight: '800' }}>directamente al técnico</Text>,
            como cuando contratas a un especialista de confianza.
          </Text>
          <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: THEME.space.md }}>
            Medios de pago disponibles
          </Text>
          <View style={{ gap: THEME.space.sm }}>
            {METODOS.map((m) => (
              <View key={m.label} style={{
                flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
                backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md,
                paddingVertical: THEME.space.md, paddingHorizontal: THEME.space.md,
              }}>
                <View style={{ width: 36, height: 36, borderRadius: THEME.radius.full, backgroundColor: m.color + '1A', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={m.icon} size={18} color={m.color} />
                </View>
                <Text style={{ ...THEME.font.body, fontWeight: '600', color: THEME.color.ink }}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeInUp>

      {/* Nota neutral */}
      <FadeInUp delay={120}>
        <View style={{
          backgroundColor: THEME.color.warningBg,
          borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.xxl,
          flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start',
        }}>
          <Ionicons name="bulb-outline" size={20} color={THEME.color.warning} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, ...THEME.font.bodySm, color: THEME.color.ink, lineHeight: 19 }}>
            Confirma el monto y el medio de pago con tu técnico antes de empezar el trabajo, así evitas malentendidos.
          </Text>
        </View>
      </FadeInUp>

      {/* CTA primaria */}
      <FadeInUp delay={180}>
        <PressableScale
          onPress={abrirTracking}
          accessibilityLabel="Seguir mi servicio y contactar al técnico"
          style={{
            backgroundColor: THEME.color.brand,
            height: 52, borderRadius: THEME.radius.lg,
            alignItems: 'center', flexDirection: 'row',
            justifyContent: 'center', gap: THEME.space.sm,
            marginBottom: THEME.space.md, ...THEME.shadow.brand,
          }}
        >
          <Ionicons name="navigate" size={20} color={THEME.color.white} />
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>
            Seguir mi servicio y contactar
          </Text>
        </PressableScale>

        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Volver"
          haptic={false}
          style={{
            height: 48, borderRadius: THEME.radius.lg,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: THEME.color.surface, ...THEME.shadow.sm,
          }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.inkSoft }}>
            Volver
          </Text>
        </PressableScale>
      </FadeInUp>
    </ScrollView>
  )
}
