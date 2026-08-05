// Confirmación de costo antes de tomar un trabajo.
//
// Reemplaza al Alert nativo en el panel: ahí, cuando el saldo no alcanzaba, el
// botón "Recargar" cerraba el diálogo y no llevaba a ningún lado — al técnico
// se le decía que recargue sin darle dónde. Acá el mismo botón abre la compra.

import { Ionicons } from '@expo/vector-icons'
import { Modal, ScrollView, Text, View } from 'react-native'
import { THEME } from '../../lib/theme'
import { PressableScale, Shimmer } from '../ui/Motion'
import { aSoles, formatCoins, nivelUrgencia, type PrecioLead } from './lead-utils'

export interface TrabajoAConfirmar {
  codigo: string
  servicio: string
  distrito: string
  urgencia?: string | null
}

export function ConfirmarCostoModal({
  trabajo,
  precio,
  onCancelar,
  onConfirmar,
  onComprarCoins,
}: {
  trabajo: TrabajoAConfirmar | null
  // undefined = consultando el precio
  precio: PrecioLead | null | undefined
  onCancelar: () => void
  onConfirmar: () => void
  onComprarCoins: () => void
}) {
  if (!trabajo) return null

  const consultando = precio === undefined
  const costo = precio && precio.costo_coins != null ? precio.costo_coins : null
  const saldo = precio?.saldo_total ?? 0
  const congelado = precio?.congelado === true
  const ilimitado = precio?.ilimitado === true
  // Sin dato de precio no bloqueamos: el cobro real lo valida el servidor.
  const alcanza = congelado ? false : ilimitado || costo == null || saldo >= costo
  const falta = costo != null && !alcanza && !congelado ? Math.max(costo - saldo, 0) : 0
  const urgencia = nivelUrgencia(trabajo.urgencia ?? precio?.urgencia)

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancelar}>
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
            <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>Tomar este trabajo</Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs }}>
              {trabajo.servicio}
              {trabajo.distrito ? ` · ${trabajo.distrito}` : ''}
              {urgencia ? (urgencia === 'emergencia' ? ' · Emergencia' : ' · Urgente') : ''}
            </Text>

            <View style={{
              backgroundColor: congelado ? THEME.color.dangerBg : THEME.color.brandLight,
              borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginTop: THEME.space.lg,
            }}>
              {consultando ? (
                <>
                  <Shimmer style={{ height: 30, width: 170, borderRadius: THEME.radius.md }} />
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: THEME.space.sm }}>
                    Consultando cuánto cuesta tomarlo…
                  </Text>
                </>
              ) : congelado ? (
                <Text style={{ ...THEME.font.bodySm, color: '#991B1B' }}>
                  Tu saldo está retenido temporalmente y no puedes tomar trabajos.
                  Escríbenos por soporte para revisarlo.
                </Text>
              ) : ilimitado ? (
                <Text style={{ ...THEME.font.h2, color: THEME.color.brandDark }}>
                  Sin costo (coins ilimitados)
                </Text>
              ) : costo == null ? (
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark }}>
                  No pudimos consultar el costo ahora. Se te descontará de tu saldo al tomar
                  el trabajo.
                </Text>
              ) : (
                <>
                  <Text style={{ ...THEME.font.display, color: THEME.color.brandDark }}>
                    {formatCoins(costo)} coins
                  </Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: 2 }}>
                    ≈ S/{aSoles(costo)} · tu saldo: {formatCoins(saldo)} coins
                    {alcanza ? ` (te quedarían ${formatCoins(saldo - costo)})` : ''}
                  </Text>
                  {falta > 0 && (
                    <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.danger, marginTop: THEME.space.sm }}>
                      Te faltan {formatCoins(falta)} coins ≈ S/{aSoles(falta)} para tomarlo.
                    </Text>
                  )}
                </>
              )}
            </View>

            <Fila icono="cash-outline" texto="Lo que te pague el cliente por el servicio es tuyo: SOLU no cobra comisión." />
            <Fila icono="flash-outline" texto="El trabajo se lo queda el primer técnico que lo toma." />

            {consultando ? (
              <PressableScale disabled accessibilityLabel="Consultando el costo" style={botonPrimario}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Consultando el costo…</Text>
              </PressableScale>
            ) : alcanza ? (
              <PressableScale onPress={onConfirmar} accessibilityLabel="Tomar el trabajo" style={botonPrimario}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Tomar trabajo</Text>
              </PressableScale>
            ) : congelado ? null : (
              <PressableScale onPress={onComprarCoins} accessibilityLabel="Comprar SoluCoins" style={botonPrimario}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Comprar SoluCoins</Text>
              </PressableScale>
            )}

            <PressableScale onPress={onCancelar} accessibilityLabel="Cancelar" style={botonSecundario}>
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

export default ConfirmarCostoModal
