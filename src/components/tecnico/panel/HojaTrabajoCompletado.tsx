// Hoja de éxito al marcar un trabajo como Completado (patrón de sheet de
// ConfirmarCostoModal). Antes el flujo moría en un toast y el técnico no
// tenía motivo para pedirle al cliente que cierre el ciclo.
//
// Copy honesto: hoy el cashback en coins está apagado en el server
// (CASHBACK_RATING_BONUS y CASHBACK_CIERRE_CREDITOS en 0), así que acá NO se
// prometen coins. Lo que sí es real: el cierre ya sumó al nivel del técnico
// y la calificación del cliente (link /calificar/{codigo}) confirma el
// cierre y le deja una reseña que trae más clientes.

import { Linking, Modal, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Cliente } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { PressableScale } from '../../ui/Motion'

// Verde de marca de WhatsApp: no existe en el THEME a propósito.
const WHATSAPP_GREEN = '#25D366'

// Link REAL de calificación: /calificar/[code] espera el `codigo` del lead
// (fila `clientes`) y al calificar pasa el servicio a 'Calificado'.
function linkCalificar(codigo: string): string {
  return `https://www.solu.pe/calificar/${codigo}`
}

function abrirWhatsApp(whatsapp: string, mensaje: string): void {
  const wa = whatsapp.replace(/\D/g, '')
  if (!wa) return
  void Linking.openURL(`https://wa.me/51${wa}?text=${encodeURIComponent(mensaje)}`)
}

export function HojaTrabajoCompletado({
  lead,
  tierSubio,
  onCerrar,
}: {
  // null = hoja cerrada
  lead: Cliente | null
  tierSubio: boolean
  onCerrar: () => void
}) {
  if (!lead) return null
  const tieneWhatsApp = !!(lead.whatsapp || '').replace(/\D/g, '')

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

          <View style={{ alignItems: 'center', marginBottom: THEME.space.md }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={34} color={THEME.color.success} />
            </View>
          </View>

          <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>¡Trabajo completado! 🎉</Text>

          {tierSubio && (
            <View style={{ backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg, padding: THEME.space.md, marginTop: THEME.space.md }}>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.brandDark, textAlign: 'center' }}>
                ⬆️ ¡Subiste de nivel! Tu nuevo tier ya te da más descuento en coins.
              </Text>
            </View>
          )}

          <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.md, lineHeight: 19 }}>
            Este trabajo ya suma a tu nivel en SOLU. Ahora pídele a {lead.nombre} que
            confirme el cierre con su calificación: cada reseña te trae más clientes.
          </Text>

          {tieneWhatsApp && (
            <PressableScale
              onPress={() => abrirWhatsApp(
                lead.whatsapp,
                `Hola ${lead.nombre} 🙌 Ya quedó completado tu servicio de ${lead.servicio} en SOLU. ¿Me confirmas el cierre con tu calificación? Te toma 1 minuto: ${linkCalificar(lead.codigo)}`,
              )}
              accessibilityLabel="Pedir confirmación por WhatsApp"
              style={{
                backgroundColor: WHATSAPP_GREEN, borderRadius: THEME.radius.lg, minHeight: 52,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: THEME.space.xl,
              }}
            >
              <Ionicons name="logo-whatsapp" size={18} color={THEME.color.white} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Pedir confirmación por WhatsApp</Text>
            </PressableScale>
          )}

          <PressableScale
            onPress={onCerrar}
            accessibilityLabel="Cerrar"
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.sm }}
          >
            <Text style={{ ...THEME.font.h3, color: THEME.color.inkMuted }}>Listo</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  )
}

// Botón secundario persistente para las cards ya Completadas del historial.
// Solo en 'Completado': en 'Calificado' el cliente ya dejó su reseña y el
// link devolvería "Ya calificaste este servicio".
export function BotonPedirResena({ lead }: { lead: Cliente }) {
  if (lead.estado !== 'Completado') return null
  if (!(lead.whatsapp || '').replace(/\D/g, '')) return null
  return (
    <TouchableOpacity
      onPress={() => abrirWhatsApp(
        lead.whatsapp,
        `Gracias por confiar en mí 🙏 ¿Me dejas tu calificación en SOLU? Te toma 1 minuto: ${linkCalificar(lead.codigo)}`,
      )}
      accessibilityLabel={`Pedir reseña a ${lead.nombre} por WhatsApp`}
      style={{
        marginTop: 12, minHeight: 44, borderRadius: THEME.radius.lg,
        borderWidth: 1, borderColor: WHATSAPP_GREEN, backgroundColor: THEME.color.surface,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      <Ionicons name="logo-whatsapp" size={16} color={WHATSAPP_GREEN} />
      <Text style={{ ...THEME.font.label, fontWeight: '800', color: '#128C4A' }}>Pedir reseña por WhatsApp</Text>
    </TouchableOpacity>
  )
}

export default HojaTrabajoCompletado
