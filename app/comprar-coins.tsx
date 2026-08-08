// Comprar SoluCoins — V3.1. La compra real se hace en la web (solu.pe/planes)
// porque ahí vive el SDK de Culqi con PCI-DSS, 3DS y Apple Pay/Google Pay;
// reimplementarla en el app duplicaría la integración y complicaría Apple Review.
//
// Estrategia híbrida: la pantalla intenta el catálogo real del server
// (GET /api/creditos/paquetes: precio con descuento del tier + rendimiento en
// la zona del técnico) y si no llega cae en silencio al espejo local, para que
// el técnico decida ANTES de abrir el browser hacia /planes.

import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { COINS_PACKAGES } from '../src/lib/constants'
import { THEME } from '../src/lib/theme'
import { getTechToken } from '../src/lib/tech-session'
import { fetchMyTechProfileResult } from '../src/lib/tech-profile'
import { tierFromServicios } from '../src/lib/tecnico-columns'
import {
  fetchPaquetesCoins,
  precioConDescuentoEntero,
  type CatalogoPaquetes,
} from '../src/lib/creditos-api'
import { TIERS_FIDELIDAD, type TierInfo } from '../src/components/tecnico/panel/panel-utils'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

// Lo que cada card necesita pintar, venga del server o del espejo local.
interface CardPaquete {
  slug: string
  name: string
  coins: number
  precioLista: number
  // null = sin descuento aplicable (o catálogo local): se muestra solo lista.
  precioFinal: number | null
  contactos: string | null
  destacado: boolean
}

const CARDS_LOCALES: CardPaquete[] = Object.entries(COINS_PACKAGES).map(([slug, p]) => ({
  slug,
  name: p.name,
  coins: p.coins,
  precioLista: p.price,
  precioFinal: null,
  contactos: p.contactos,
  destacado: 'destacado' in p && p.destacado === true,
}))

export default function ComprarCoinsScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  // Catálogo real del server (precio final del tier + rendimiento por zona).
  const [catalogo, setCatalogo] = useState<CatalogoPaquetes | null>(null)
  // Fallback: tier del perfil, para al menos avisar que el descuento existe.
  const [tierLocal, setTierLocal] = useState<TierInfo | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const token = await getTechToken()
      // En paralelo: el perfil solo se usa si el catálogo no llega (hoy el
      // route de paquetes es cookie-only y rechaza el Bearer — ver creditos-api).
      const [paq, perfil] = await Promise.all([
        fetchPaquetesCoins(token),
        fetchMyTechProfileResult(token),
      ])
      if (!vivo) return
      if (paq.ok && paq.data.paquetes.length > 0) {
        setCatalogo(paq.data)
        return
      }
      if (perfil.ok) {
        const key = perfil.data.tier ?? tierFromServicios(perfil.data.servicios_completados)
        const info = TIERS_FIDELIDAD.find((t) => t.key === key) ?? null
        if (info && info.descuento > 0) setTierLocal(info)
      }
    })()
    return () => { vivo = false }
  }, [])

  const descuentoPct = catalogo ? Math.round(catalogo.descuento_pct * 100) : 0
  const nivelNombre = catalogo?.nivel
    ? (TIERS_FIDELIDAD.find((t) => t.key === catalogo.nivel)?.name
      ?? catalogo.nivel.charAt(0).toUpperCase() + catalogo.nivel.slice(1))
    : null
  const compraHabilitada = catalogo?.compra_habilitada ?? true

  const cards: CardPaquete[] = catalogo
    ? catalogo.paquetes.map((p) => ({
        slug: p.slug,
        name: p.nombre,
        coins: p.creditos,
        precioLista: p.precio_pen,
        precioFinal: catalogo.descuento_pct > 0
          ? precioConDescuentoEntero(p.precio_pen, catalogo.descuento_pct)
          : null,
        contactos: catalogo.costo_lead_tipico && catalogo.costo_lead_tipico > 0
          ? `≈ ${Math.max(1, Math.floor(p.creditos / catalogo.costo_lead_tipico))} contactos en tu zona`
          : null,
        destacado: p.slug.startsWith('popular'),
      }))
    : CARDS_LOCALES

  async function abrirCheckout(slug: string) {
    // Abre el flujo de compra en el browser interno del sistema. El usuario
    // se autentica en la web (si no lo está) y completa el pago con Culqi.
    // Al cerrar el browser vuelve a esta pantalla; el saldo se actualiza
    // la próxima vez que entre a Mi cuenta.
    haptics.success()
    await WebBrowser.openBrowserAsync(`https://www.solu.pe/planes?paquete=${slug}`)
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

      {/* Kill-switch del server: sin CTA no vendemos algo que va a fallar. */}
      {!compraHabilitada && (
        <FadeInUp>
          <View
            accessibilityRole="alert"
            style={{ backgroundColor: THEME.color.warningBg, borderWidth: 1, borderColor: '#FDE68A', borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.md, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
          >
            <Ionicons name="time-outline" size={18} color="#B45309" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, ...THEME.font.bodySm, fontWeight: '700', color: '#92400E', lineHeight: 19 }}>
              La compra de paquetes está deshabilitada por el momento. Vuelve a intentarlo más tarde.
            </Text>
          </View>
        </FadeInUp>
      )}

      {/* Cards de paquetes */}
      {cards.map((p, i) => {
        const isSelected = selected === p.slug
        const precioMostrado = p.precioFinal ?? p.precioLista
        return (
          <FadeInUp key={p.slug} delay={60 + i * 60}>
            <PressableScale
              onPress={() => { haptics.light(); setSelected(p.slug) }}
              scaleTo={0.98}
              haptic={false}
              accessibilityLabel={`Seleccionar paquete ${p.name} de ${p.coins.toLocaleString('es-PE')} SoluCoins por ${precioMostrado} soles`}
              style={{
                backgroundColor: p.destacado ? THEME.color.brandLight : THEME.color.surface,
                borderRadius: THEME.radius.xl,
                padding: THEME.space.lg,
                marginBottom: THEME.space.md,
                position: 'relative',
                borderWidth: isSelected ? 2 : 0,
                borderColor: THEME.color.brand,
                ...(p.destacado ? THEME.shadow.md : THEME.shadow.sm),
              }}
            >
              {p.destacado && (
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
                  {p.contactos && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: THEME.space.sm, alignSelf: 'flex-start', backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                      <Ionicons name="flash" size={12} color={THEME.color.warning} />
                      <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft }}>
                        {p.contactos}
                      </Text>
                    </View>
                  )}
                  {/* Descuento real del server; mismo redondeo que cobra Culqi */}
                  {p.precioFinal !== null && nivelNombre && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                      <Ionicons name="pricetag" size={12} color={THEME.color.success} />
                      <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>
                        Tu tier {nivelNombre}: S/{p.precioFinal} (−{descuentoPct}%)
                      </Text>
                    </View>
                  )}
                  {/* Sin catálogo del server: el descuento igual existe y se
                      aplica en el checkout web — avisarlo evita el susto de
                      "me cobraron distinto a lo que decía la app". */}
                  {!catalogo && tierLocal && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                      <Ionicons name="pricetag" size={12} color={THEME.color.success} />
                      <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>
                        Tu descuento {tierLocal.name} (−{tierLocal.descuento}%) se aplica al pagar
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {p.precioFinal !== null && (
                    <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkMuted, textDecorationLine: 'line-through' }}>
                      S/{p.precioLista}
                    </Text>
                  )}
                  <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>
                    S/{precioMostrado}
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>
                    IGV incluido
                  </Text>
                </View>
              </View>

              {compraHabilitada && (
                <PressableScale
                  onPress={() => abrirCheckout(p.slug)}
                  accessibilityLabel={`Comprar paquete ${p.name} de ${p.coins.toLocaleString('es-PE')} SoluCoins por ${precioMostrado} soles. Se abre el pago seguro en tu navegador`}
                  style={{
                    backgroundColor: p.destacado ? THEME.color.brand : THEME.color.navy,
                    height: 48, borderRadius: THEME.radius.lg,
                    alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.sm,
                    flexDirection: 'row', gap: 6,
                    ...(p.destacado ? THEME.shadow.brand : {}),
                  }}
                >
                  <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>
                    Comprar paquete
                  </Text>
                  <Ionicons name="open-outline" size={15} color={THEME.color.white} />
                </PressableScale>
              )}
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
