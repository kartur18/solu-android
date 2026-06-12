// Comprar SoluCoins — V3.1.
//
// La compra real se hace en la web (https://solu.pe/planes) porque ahí
// vive el SDK de Culqi con PCI-DSS, 3DS y Apple Pay/Google Pay. Reimplementar
// el checkout dentro del app móvil duplicaría la integración y obligaría a
// pasar Apple Review por usar pagos no-IAP para servicios no-digitales
// (lo cual está permitido pero requiere disclosure explícito).
//
// La estrategia híbrida: la pantalla muestra el catálogo de paquetes
// localmente (espejo de Supabase) para que el técnico decida ANTES de
// abrir el browser, y un solo botón abre /planes con deep-link de regreso.

import { useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { COINS_PACKAGES } from '../src/lib/constants'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

const PACKAGES = Object.entries(COINS_PACKAGES).map(([slug, p]) => ({ slug, ...p }))

export default function ComprarCoinsScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  async function abrirCheckout(slug: string) {
    // Abre el flujo de compra en el browser interno del sistema. El usuario
    // se autentica en la web (si no lo está) y completa el pago con Culqi.
    // Al cerrar el browser vuelve a esta pantalla; el saldo se actualiza
    // la próxima vez que entre a Mi cuenta.
    haptics.success()
    await WebBrowser.openBrowserAsync(`https://solu.pe/planes?paquete=${slug}`)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ padding: THEME.space.lg, paddingBottom: THEME.space.xxxl }}>
      {/* Header */}
      <FadeInUp>
        <View style={{ marginBottom: THEME.space.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="server" size={20} color={THEME.color.brand} />
            </View>
            <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>
              Comprar SoluCoins
            </Text>
          </View>
          <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft }}>
            Elige tu paquete. Mientras más grande, mejor el precio por lead.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: THEME.space.md, alignSelf: 'flex-start', backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: 6 }}>
            <Ionicons name="lock-closed" size={13} color={THEME.color.success} />
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>
              Pago seguro en tu navegador
            </Text>
          </View>
        </View>
      </FadeInUp>

      {/* Cards de paquetes */}
      {PACKAGES.map((p, i) => {
        const destacado = 'destacado' in p && p.destacado
        const isSelected = selected === p.slug
        return (
          <FadeInUp key={p.slug} delay={60 + i * 60}>
            <PressableScale
              onPress={() => { haptics.light(); setSelected(p.slug) }}
              scaleTo={0.98}
              haptic={false}
              accessibilityLabel={`Seleccionar paquete ${p.name} de ${p.coins.toLocaleString('es-PE')} SoluCoins por ${p.price} soles`}
              style={{
                backgroundColor: destacado ? THEME.color.brandLight : THEME.color.surface,
                borderRadius: THEME.radius.xl,
                padding: THEME.space.lg,
                marginBottom: THEME.space.md,
                position: 'relative',
                borderWidth: isSelected ? 2 : 0,
                borderColor: THEME.color.brand,
                ...(destacado ? THEME.shadow.md : THEME.shadow.sm),
              }}
            >
              {destacado && (
                <View style={{
                  position: 'absolute', top: -10, right: THEME.space.lg,
                  backgroundColor: THEME.color.brand, paddingHorizontal: THEME.space.md, paddingVertical: 4, borderRadius: THEME.radius.full,
                  flexDirection: 'row', alignItems: 'center', gap: 4, ...THEME.shadow.brand,
                }}>
                  <Ionicons name="star" size={11} color={THEME.color.white} />
                  <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.white, letterSpacing: 0.4 }}>MÁS ELEGIDO</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: THEME.space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {p.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                    <Text style={{ ...THEME.font.display, color: THEME.color.brand }}>
                      {p.coins.toLocaleString('es-PE')}
                    </Text>
                    <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>SoluCoins</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: THEME.space.sm, alignSelf: 'flex-start', backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                    <Ionicons name="flash" size={12} color={THEME.color.warning} />
                    <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft }}>
                      {p.leads}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>
                    S/{p.price}
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>
                    IGV incluido
                  </Text>
                </View>
              </View>

              <PressableScale
                onPress={() => abrirCheckout(p.slug)}
                accessibilityLabel={`Comprar paquete ${p.name} de ${p.coins.toLocaleString('es-PE')} SoluCoins por ${p.price} soles. Se abre el pago seguro en tu navegador`}
                style={{
                  backgroundColor: destacado ? THEME.color.brand : THEME.color.navy,
                  height: 48, borderRadius: THEME.radius.lg,
                  alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.sm,
                  flexDirection: 'row', gap: 6,
                  ...(destacado ? THEME.shadow.brand : {}),
                }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>
                  Comprar paquete
                </Text>
                <Ionicons name="open-outline" size={15} color={THEME.color.white} />
              </PressableScale>
            </PressableScale>
          </FadeInUp>
        )
      })}

      {/* Info sobre la compra externa */}
      <FadeInUp delay={120}>
        <View style={{
          backgroundColor: THEME.color.infoBg,
          borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginTop: THEME.space.sm,
          flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start',
        }}>
          <Ionicons name="shield-checkmark" size={20} color={THEME.color.info} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.ink, lineHeight: 19 }}>
              Al tocar "Comprar paquete" se abre el pago seguro en tu navegador (solu.pe con Culqi).
              Al terminar, los SoluCoins se acreditan solos a tu cuenta y recibes tu boleta SUNAT por email.
            </Text>
          </View>
        </View>
      </FadeInUp>

      <PressableScale
        onPress={() => router.back()}
        accessibilityLabel="Volver"
        haptic={false}
        style={{
          height: 48, justifyContent: 'center', borderRadius: THEME.radius.lg, alignItems: 'center',
          marginTop: THEME.space.lg,
          backgroundColor: THEME.color.surface, ...THEME.shadow.sm,
        }}
      >
        <Text style={{ ...THEME.font.h3, color: THEME.color.inkSoft }}>
          Volver
        </Text>
      </PressableScale>
    </ScrollView>
  )
}
