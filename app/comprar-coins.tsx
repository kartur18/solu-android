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

import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, COINS_PACKAGES } from '../src/lib/constants'

const PACKAGES = Object.entries(COINS_PACKAGES).map(([slug, p]) => ({ slug, ...p }))

export default function ComprarCoinsScreen() {
  const router = useRouter()

  async function abrirCheckout(slug: string) {
    // Abre el flujo de compra en el browser interno del sistema. El usuario
    // se autentica en la web (si no lo está) y completa el pago con Culqi.
    // Al cerrar el browser vuelve a esta pantalla; el saldo se actualiza
    // la próxima vez que entre a Mi cuenta.
    await WebBrowser.openBrowserAsync(`https://solu.pe/planes?paquete=${slug}`)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }} contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark }}>
          Comprar SoluCoins
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>
          Elige tu paquete. Mientras más grande, mejor el precio por lead.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Ionicons name="lock-closed" size={13} color={COLORS.gray} />
          <Text style={{ fontSize: 12, color: COLORS.gray }}>
            El pago seguro se abre en tu navegador
          </Text>
        </View>
      </View>

      {/* Cards de paquetes */}
      {PACKAGES.map((p) => {
        const destacado = 'destacado' in p && p.destacado
        return (
          <View
            key={p.slug}
            style={{
              backgroundColor: destacado ? '#FFF8F3' : COLORS.white,
              borderRadius: 16,
              padding: 18,
              marginBottom: 12,
              borderWidth: destacado ? 2 : 1,
              borderColor: destacado ? COLORS.pri : COLORS.border,
              position: 'relative',
              ...(destacado ? {
                shadowColor: COLORS.pri,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
                elevation: 4,
              } : {}),
            }}
          >
            {destacado && (
              <View style={{
                position: 'absolute', top: -10, right: 16,
                backgroundColor: COLORS.pri, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
              }}>
                <Text style={{ color: COLORS.white, fontSize: 10, fontWeight: '800' }}>MÁS ELEGIDO</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {p.name}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.pri, marginTop: 2 }}>
                  {p.coins.toLocaleString('es-PE')} <Text style={{ fontSize: 14, color: COLORS.gray }}>SoluCoins</Text>
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>
                  {p.leads}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.dark }}>
                  S/{p.price}
                </Text>
                <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 2 }}>
                  IGV incluido
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => abrirCheckout(p.slug)}
              activeOpacity={0.85}
              accessibilityLabel={`Comprar paquete ${p.name} de ${p.coins.toLocaleString('es-PE')} SoluCoins por ${p.price} soles. Se abre el pago seguro en tu navegador`}
              style={{
                backgroundColor: destacado ? COLORS.pri : COLORS.dark,
                paddingVertical: 14, minHeight: 48, borderRadius: 12,
                alignItems: 'center', marginTop: 8,
                flexDirection: 'row', justifyContent: 'center', gap: 6,
              }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
                Comprar paquete
              </Text>
              <Ionicons name="open-outline" size={14} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )
      })}

      {/* Info sobre la compra externa */}
      <View style={{
        backgroundColor: '#EFF6FF',
        borderRadius: 12, padding: 14, marginTop: 8,
        borderLeftWidth: 3, borderLeftColor: '#2563EB',
        flexDirection: 'row', gap: 10,
      }}>
        <Ionicons name="shield-checkmark" size={20} color="#2563EB" style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: '#1E40AF', lineHeight: 18 }}>
            Al tocar "Comprar paquete" se abre el pago seguro en tu navegador (solu.pe con Culqi).
            Al terminar, los SoluCoins se acreditan solos a tu cuenta y recibes tu boleta SUNAT por email.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          paddingVertical: 14, minHeight: 48, justifyContent: 'center', borderRadius: 14, alignItems: 'center',
          marginTop: 16, marginBottom: 24,
          borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
        }}
        activeOpacity={0.85}
      >
        <Text style={{ color: COLORS.dark, fontSize: 14, fontWeight: '600' }}>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
