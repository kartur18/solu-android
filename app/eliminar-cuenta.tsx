import { useState } from 'react'
import { ScrollView, View, Text, Linking, Alert, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../src/lib/supabase'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale } from '../src/components/ui/Motion'

export default function EliminarCuentaScreen() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteAccount() {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro? Esta acción es irreversible. Se eliminarán todos tus datos personales, perfil y fotos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar mi cuenta',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              // Check for tech session
              const techSession = await AsyncStorage.getItem('solu_tech_session')
              if (techSession) {
                const { id } = JSON.parse(techSession)
                await supabase.from('tecnicos').update({ disponible: false, nombre: 'ELIMINADO', whatsapp: '', email: '', foto_url: null, dni_frente_url: null, dni_posterior_url: null, descripcion: null, galeria: null }).eq('id', id)
                await AsyncStorage.removeItem('solu_tech_session')
              }
              // Check for client session
              const clientSession = await AsyncStorage.getItem('solu_client_session')
              if (clientSession) {
                const { id } = JSON.parse(clientSession)
                await supabase.from('clientes_users').update({ nombre: 'ELIMINADO', whatsapp: '' }).eq('id', id)
                await AsyncStorage.removeItem('solu_client_session')
              }
              // Also send email for full deletion
              Linking.openURL('mailto:contacto@solu.pe?subject=Confirmación eliminación de cuenta&body=Mi cuenta ha sido desactivada desde la app. Por favor completar la eliminación total de mis datos.')
              Alert.alert('Cuenta desactivada', 'Tu cuenta ha sido desactivada. Recibirás confirmación de la eliminación total en máximo 15 días hábiles.', [
                { text: 'OK', onPress: () => router.dismiss() }
              ])
            } catch {
              Alert.alert('Error', 'No se pudo procesar. Envía un email a contacto@solu.pe')
            } finally {
              setDeleting(false)
            }
          }
        }
      ]
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ paddingBottom: THEME.space.xxxl + THEME.space.lg }}>
      <StatusBar barStyle="light-content" />
      {/* Header serio */}
      <View style={{ backgroundColor: THEME.color.navy, paddingHorizontal: THEME.space.xl, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.lg, paddingBottom: THEME.space.xl, borderBottomLeftRadius: THEME.radius.xl, borderBottomRightRadius: THEME.radius.xl, ...THEME.shadow.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
          <PressableScale onPress={() => router.back()} haptic={false} accessibilityLabel="Volver" style={{ width: 40, height: 40, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={22} color={THEME.color.white} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.h2, color: THEME.color.white }}>Eliminar cuenta y datos</Text>
            <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Última actualización: Marzo 2026</Text>
          </View>
        </View>
      </View>

      <View style={{ padding: THEME.space.xl }}>
        {/* Aviso irreversible */}
        <FadeInUp delay={0}>
          <View style={{ flexDirection: 'row', gap: THEME.space.md, backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.lg }}>
            <Ionicons name="alert-circle" size={22} color={THEME.color.danger} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.h3, color: '#991B1B' }}>Acción irreversible</Text>
              <Text style={{ ...THEME.font.bodySm, color: '#991B1B', marginTop: 2, lineHeight: 19 }}>
                Una vez confirmada, no podrás recuperar tu cuenta, perfil ni fotos.
              </Text>
            </View>
          </View>
        </FadeInUp>

        {/* Delete button - prominent for Apple compliance */}
        <FadeInUp delay={60}>
          <PressableScale
            onPress={handleDeleteAccount}
            disabled={deleting}
            accessibilityLabel="Eliminar mi cuenta"
            style={{ backgroundColor: THEME.color.danger, borderRadius: THEME.radius.lg, minHeight: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm, marginBottom: THEME.space.lg, shadowColor: THEME.color.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6, opacity: deleting ? 0.7 : 1 }}
          >
            <Ionicons name="trash-outline" size={20} color={THEME.color.white} />
            <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>{deleting ? 'Eliminando…' : 'Eliminar mi cuenta'}</Text>
          </PressableScale>
        </FadeInUp>

        <FadeInUp delay={120}>
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
            <Text style={p}>
              En SOLU respetamos tu derecho a la privacidad y al control de tus datos personales, en cumplimiento de la Ley N° 29733, Ley de Protección de Datos Personales del Perú.
            </Text>

            <Text style={h}>1. Cómo solicitar la eliminación</Text>
            <Text style={p}>
              Puedes eliminar tu cuenta directamente con el botón de arriba, o enviar un correo a contacto@solu.pe.
            </Text>

            <PressableScale
              onPress={() => Linking.openURL('mailto:contacto@solu.pe?subject=Eliminación de cuenta')}
              accessibilityLabel="Enviar solicitud por email"
              style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.md, minHeight: 48, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm, marginTop: THEME.space.md, marginBottom: THEME.space.xs, ...THEME.shadow.brand }}
            >
              <Ionicons name="mail-outline" size={18} color={THEME.color.white} />
              <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Enviar solicitud por email</Text>
            </PressableScale>

            <Text style={h}>2. Datos que se eliminan</Text>
            <Text style={p}>
              Al solicitar la eliminación de tu cuenta, se eliminarán:{'\n\n'}
              • Nombre completo{'\n'}
              • Número de WhatsApp{'\n'}
              • Correo electrónico{'\n'}
              • Foto de perfil{'\n'}
              • Fotos de DNI (frente y posterior){'\n'}
              • Descripción del servicio{'\n'}
              • Historial de reseñas asociadas
            </Text>

            <Text style={h}>3. Datos que se conservan</Text>
            <Text style={p}>
              Por obligaciones legales y fiscales, los siguientes datos podrán conservarse por un período máximo de 5 años:{'\n\n'}
              • Registros de pagos realizados{'\n'}
              • Número de DNI (solo el número, no las fotos)
            </Text>

            <Text style={h}>4. Plazo de eliminación</Text>
            <Text style={p}>
              Tu solicitud será procesada en un plazo máximo de 15 días hábiles. Recibirás una confirmación por WhatsApp o correo electrónico una vez completada.
            </Text>

            <Text style={h}>5. Consecuencias de la eliminación</Text>
            <Text style={[p, { marginBottom: 0 }]}>
              Una vez eliminada tu cuenta:{'\n\n'}
              • No podrás acceder a tu perfil de técnico{'\n'}
              • Dejarás de recibir solicitudes de servicio{'\n'}
              • Tu perfil dejará de aparecer en los resultados de búsqueda{'\n'}
              • Si tenías Coins en tu saldo, no se realizarán reembolsos por el saldo restante
            </Text>
          </View>
        </FadeInUp>
      </View>
    </ScrollView>
  )
}

const h = { ...THEME.font.h3, color: THEME.color.ink, marginTop: THEME.space.lg, marginBottom: THEME.space.sm }
const p = { ...THEME.font.body, color: THEME.color.inkSoft, lineHeight: 22, marginBottom: THEME.space.sm }
