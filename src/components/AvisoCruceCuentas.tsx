// Aviso de cruce tras crear la cuenta de técnico cuando ese mismo WhatsApp ya
// tenía cuenta de cliente.
//
// Hasta ahora nadie se enteraba: la persona quedaba con dos cuentas separadas,
// dos contraseñas y la sensación de que "la app no la reconoce". Va como sheet
// (mismo patrón que ConfirmarCostoModal) y no como Alert nativo: el texto no
// entra cómodo en un diálogo del sistema.

import { Ionicons } from '@expo/vector-icons'
import { Modal, ScrollView, Text, View } from 'react-native'
import { THEME } from '../lib/theme'
import { PressableScale } from './ui/Motion'

export function AvisoCruceCuentas({ visible, sinFotos, onCerrar }: {
  visible: boolean
  // El DNI no llegó: sin las dos caras no aparece en las búsquedas.
  sinFotos: boolean
  onCerrar: () => void
}) {
  if (!visible) return null

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
        <View
          accessibilityViewIsModal
          accessibilityLabel="Tu cuenta de técnico está lista"
          style={{
            backgroundColor: THEME.color.surface,
            borderTopLeftRadius: THEME.radius.xxl,
            borderTopRightRadius: THEME.radius.xxl,
            paddingHorizontal: THEME.space.xl,
            paddingTop: THEME.space.md,
            paddingBottom: THEME.space.xxxl,
            maxHeight: '90%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.color.line, marginBottom: THEME.space.lg }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
              <View style={{ width: 48, height: 48, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="checkmark-circle" size={26} color={THEME.color.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>¡Bienvenido a SOLU!</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 2 }}>
                  Tu cuenta de técnico ya está creada.
                </Text>
              </View>
            </View>

            {/* El cruce: por qué tiene dos accesos y qué hacer con eso */}
            <View
              style={{
                flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start',
                backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg,
                padding: THEME.space.lg, marginTop: THEME.space.lg,
              }}
            >
              <Ionicons name="swap-horizontal" size={18} color={THEME.color.brand} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.brandDark }}>
                  Ya tenías cuenta de cliente con este número
                </Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs, lineHeight: 20 }}>
                  Son cuentas distintas: esta es tu cuenta de técnico, con su propio acceso y su
                  propia contraseña. La de cliente sigue igual. Puedes cambiar de modo cuando
                  quieras desde Mi cuenta.
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start',
                backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.lg,
                padding: THEME.space.lg, marginTop: THEME.space.md,
              }}
            >
              <Text style={{ fontSize: 18 }}>🎁</Text>
              <Text style={{ flex: 1, ...THEME.font.bodySm, color: THEME.color.inkSoft, lineHeight: 20 }}>
                Recibes 8,000 SoluCoins gratis para tus primeros leads: vencen en 30 días,
                aprovéchalos tu primer mes.
              </Text>
            </View>

            {sinFotos && (
              <View
                style={{
                  flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start',
                  backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.lg,
                  padding: THEME.space.lg, marginTop: THEME.space.md,
                }}
              >
                <Ionicons name="alert-circle" size={18} color={THEME.color.warning} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#92400E', lineHeight: 20 }}>
                  Sube tu DNI desde tu panel para aparecer en las búsquedas de clientes.
                </Text>
              </View>
            )}

            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.lg, lineHeight: 17 }}>
              Inicia sesión desde Mi cuenta con la contraseña que acabas de crear.
            </Text>

            <PressableScale
              onPress={onCerrar}
              accessibilityLabel="Entendido, ir a Mi cuenta"
              style={{
                backgroundColor: THEME.color.brand,
                borderRadius: THEME.radius.lg,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: THEME.space.lg,
                ...THEME.shadow.brand,
              }}
            >
              <Text style={{ color: THEME.color.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 }}>
                Entendido
              </Text>
            </PressableScale>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export default AvisoCruceCuentas
