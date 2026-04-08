import { useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity, Linking, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'

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
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Eliminación de cuenta y datos</Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 20 }}>Última actualización: Marzo 2026</Text>

        {/* Delete button - prominent for Apple compliance */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleting}
          style={{ backgroundColor: '#DC2626', borderRadius: 14, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>{deleting ? 'Eliminando...' : 'Eliminar mi cuenta'}</Text>
        </TouchableOpacity>

        <Text style={p}>
          En SOLU respetamos tu derecho a la privacidad y al control de tus datos personales, en cumplimiento de la Ley N° 29733, Ley de Protección de Datos Personales del Perú.
        </Text>

        <Text style={h}>1. Cómo solicitar la eliminación</Text>
        <Text style={p}>
          Puedes eliminar tu cuenta directamente con el botón de arriba, o enviar un correo a contacto@solu.pe.
        </Text>

        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:contacto@solu.pe?subject=Eliminación de cuenta')}
          style={{ backgroundColor: COLORS.pri, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 }}
        >
          <Ionicons name="mail-outline" size={18} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>Enviar solicitud por email</Text>
        </TouchableOpacity>

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
        <Text style={p}>
          Una vez eliminada tu cuenta:{'\n\n'}
          • No podrás acceder a tu perfil de técnico{'\n'}
          • Dejarás de recibir solicitudes de servicio{'\n'}
          • Tu perfil dejará de aparecer en los resultados de búsqueda{'\n'}
          • Si tenías un plan activo, no se realizarán reembolsos por el período restante
        </Text>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

const h = { fontSize: 16, fontWeight: '700' as const, color: '#1A1A2E', marginTop: 20, marginBottom: 8 }
const p = { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 8 }
