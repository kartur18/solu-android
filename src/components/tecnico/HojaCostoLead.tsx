// Hoja que aparece antes de entrar al chat: cuánto cuesta responder, con qué
// saldo cuenta y qué pasa si no le alcanza.
//
// El cobro se dispara con el PRIMER mensaje del técnico, no al abrir: por eso
// el costo se muestra ANTES de entrar a escribir y leer nunca cuesta.

import { Ionicons } from '@expo/vector-icons'
import { Modal, ScrollView, Text, View } from 'react-native'
import { THEME } from '../../lib/theme'
import { PressableScale, Shimmer } from '../ui/Motion'
import {
  aSoles, alcanzaSaldo, capitalizar, formatCoins, nivelUrgencia, nombreCliente,
  type ChatResumen, type PrecioLead,
} from './lead-utils'

export function HojaCostoLead({
  chat,
  precio,
  saldo,
  onCerrar,
  onAbrir,
  onComprarCoins,
}: {
  chat: ChatResumen | null
  precio: PrecioLead | null | undefined
  saldo: number | null
  onCerrar: () => void
  onAbrir: (chat: ChatResumen) => void
  onComprarCoins: () => void
}) {
  if (!chat) return null

  const consultando = precio === undefined
  // null = el endpoint no respondió. No bloqueamos (el cobro real lo valida el
  // servidor), pero lo decimos en vez de callar el monto.
  const costo = precio && precio.costo_coins != null ? precio.costo_coins : null
  const disponible = saldo ?? precio?.saldo_total ?? 0
  const restante = disponible - (costo ?? 0)
  const alcanza = alcanzaSaldo(precio, saldo)
  const falta = costo != null && !alcanza ? Math.max(costo - disponible, 0) : 0
  const urgencia = nivelUrgencia(precio?.urgencia)

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: THEME.color.surface,
          borderTopLeftRadius: THEME.radius.xxl,
          borderTopRightRadius: THEME.radius.xxl,
          paddingHorizontal: THEME.space.xl,
          paddingTop: THEME.space.md,
          paddingBottom: THEME.space.xxxl,
          maxHeight: '90%',
        }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.color.line, marginBottom: THEME.space.lg }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>
              Responder a {nombreCliente(chat)}
            </Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs }}>
              {chat.servicio_buscado ? capitalizar(chat.servicio_buscado) : 'Servicio'}
              {chat.distrito ? ` · ${capitalizar(chat.distrito)}` : ''}
            </Text>

            {urgencia && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs, alignSelf: 'flex-start',
                marginTop: THEME.space.sm, borderRadius: THEME.radius.full,
                paddingHorizontal: THEME.space.md, paddingVertical: 5,
                backgroundColor: urgencia === 'emergencia' ? THEME.color.dangerBg : THEME.color.warningBg,
              }}>
                <Ionicons
                  name={urgencia === 'emergencia' ? 'flash' : 'time'}
                  size={13}
                  color={urgencia === 'emergencia' ? THEME.color.danger : '#B45309'}
                />
                <Text style={{ ...THEME.font.caption, fontWeight: '700', color: urgencia === 'emergencia' ? THEME.color.danger : '#B45309' }}>
                  {urgencia === 'emergencia' ? 'Emergencia · el cliente necesita a alguien ya' : 'Urgente · el cliente tiene apuro'}
                </Text>
              </View>
            )}

            <View style={{
              backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg,
              padding: THEME.space.lg, marginTop: THEME.space.lg,
            }}>
              {consultando ? (
                <>
                  <Shimmer style={{ height: 30, width: 170, borderRadius: THEME.radius.md }} />
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: THEME.space.sm }}>
                    Consultando cuánto cuesta responder…
                  </Text>
                </>
              ) : precio?.ya_pagado ? (
                <>
                  <Text style={{ ...THEME.font.h2, color: THEME.color.brandDark }}>
                    Ya pagaste este lead
                  </Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: 2 }}>
                    Responder de nuevo no te cuesta nada.
                  </Text>
                </>
              ) : precio?.ilimitado ? (
                <Text style={{ ...THEME.font.h2, color: THEME.color.brandDark }}>
                  Sin costo (coins ilimitados)
                </Text>
              ) : costo == null ? (
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark }}>
                  No pudimos consultar el costo ahora. Se te descontará de tu saldo cuando envíes
                  tu primer mensaje; leer el chat sigue siendo gratis.
                </Text>
              ) : (
                <>
                  <Text style={{ ...THEME.font.display, color: THEME.color.brandDark }}>
                    {formatCoins(costo)} coins
                  </Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: 2 }}>
                    ≈ S/{aSoles(costo)} · tu saldo: {formatCoins(disponible)} coins
                    {alcanza ? ` (te quedarían ${formatCoins(restante)})` : ''}
                  </Text>
                  {!alcanza && falta > 0 && (
                    <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.danger, marginTop: THEME.space.sm }}>
                      Te faltan {formatCoins(falta)} coins ≈ S/{aSoles(falta)} para responderle.
                    </Text>
                  )}
                </>
              )}
            </View>

            <Fila icono="lock-open-outline" texto="Leer el chat es gratis. Se te cobra recién cuando envías tu primer mensaje." />
            <Fila icono="cash-outline" texto="Lo que te pague el cliente por el trabajo es tuyo: SOLU no cobra comisión." />
            {/* El cobro se marca en `contactos.coins_cobrados`, o sea por
                contacto: si el mismo cliente te escribe por otro lead, vuelve
                a cobrarse. */}
            <Fila icono="repeat-outline" texto="Se cobra una sola vez por este contacto. Después conversas todo lo que necesites." />

            {precio?.congelado && (
              <View style={{ backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.md, padding: THEME.space.md, marginTop: THEME.space.md }}>
                <Text style={{ ...THEME.font.bodySm, color: '#92400E' }}>
                  Tu saldo está retenido temporalmente. Escríbenos por soporte para revisarlo.
                </Text>
              </View>
            )}

            {consultando ? (
              <>
                <PressableScale disabled accessibilityLabel="Consultando el costo" style={botonPrimario}>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Consultando el costo…</Text>
                </PressableScale>
                {/* Leer nunca se bloquea: es gratis y el server enmascara el
                    contacto del cliente hasta que el lead esté pagado. */}
                <PressableScale
                  onPress={() => onAbrir(chat)}
                  accessibilityLabel="Abrir el chat solo para leer"
                  style={botonSecundario}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.inkSoft }}>Solo leer el chat</Text>
                </PressableScale>
              </>
            ) : alcanza ? (
              <PressableScale
                onPress={() => onAbrir(chat)}
                accessibilityLabel="Abrir el chat y responder"
                style={botonPrimario}
              >
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Abrir chat y responder</Text>
              </PressableScale>
            ) : (
              <>
                <PressableScale
                  onPress={onComprarCoins}
                  accessibilityLabel="Comprar SoluCoins"
                  style={botonPrimario}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Comprar SoluCoins</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => onAbrir(chat)}
                  accessibilityLabel="Abrir el chat solo para leer"
                  style={botonSecundario}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.inkSoft }}>Solo leer el chat</Text>
                </PressableScale>
              </>
            )}

            <PressableScale onPress={onCerrar} accessibilityLabel="Cerrar" style={botonSecundario}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.inkMuted }}>Ahora no</Text>
            </PressableScale>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const botonPrimario = {
  backgroundColor: THEME.color.brand,
  borderRadius: THEME.radius.lg,
  minHeight: 52,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginTop: THEME.space.xl,
  ...THEME.shadow.brand,
}

const botonSecundario = {
  minHeight: 48,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginTop: THEME.space.sm,
}

function Fila({ icono, texto }: { icono: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: THEME.space.md, marginTop: THEME.space.lg, alignItems: 'flex-start' }}>
      <Ionicons name={icono} size={18} color={THEME.color.inkMuted} style={{ marginTop: 1 }} />
      <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, flex: 1, lineHeight: 19 }}>{texto}</Text>
    </View>
  )
}

export default HojaCostoLead
