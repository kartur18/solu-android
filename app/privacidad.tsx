import { ScrollView, View, Text } from 'react-native'
import { COLORS } from '../src/lib/constants'

export default function PrivacidadScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Política de Privacidad</Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 20 }}>Última actualización: Marzo 2026</Text>

        <Text style={p}>
          En cumplimiento de la Ley N° 29733, Ley de Protección de Datos Personales del Perú, y su Reglamento aprobado por el Decreto Supremo N° 003-2013-JUS, CITYLAND GROUP E.I.R.L. (en adelante, SOLU) informa lo siguiente:
        </Text>

        <Text style={h}>1. Datos que recopilamos</Text>
        <Text style={p}>
          Clientes: nombre, número de WhatsApp, distrito, servicio solicitado.{'\n\n'}
          Técnicos: nombre completo, DNI (número y foto), número de WhatsApp, oficio, distrito, foto de perfil.
        </Text>

        <Text style={h}>2. Finalidad del tratamiento</Text>
        <Text style={p}>
          Los datos personales son tratados con las siguientes finalidades:{'\n\n'}
          • Conectar clientes con técnicos disponibles en su zona{'\n'}
          • Verificar la identidad de los técnicos registrados{'\n'}
          • Procesar pagos de suscripciones{'\n'}
          • Enviar notificaciones sobre servicios solicitados{'\n'}
          • Mejorar la calidad del servicio
        </Text>

        <Text style={h}>3. Almacenamiento y seguridad</Text>
        <Text style={p}>
          Los datos se almacenan en servidores seguros de Supabase (infraestructura AWS). Las fotos de DNI se almacenan en un bucket privado con acceso restringido únicamente a administradores autorizados mediante URLs temporales con expiración de 5 minutos.
        </Text>

        <Text style={h}>4. Compartición de datos</Text>
        <Text style={p}>
          SOLU no vende ni comparte datos personales con terceros, excepto:{'\n\n'}
          • Culqi: procesador de pagos regulado por la SBS{'\n'}
          • WhatsApp: para facilitar la comunicación entre cliente y técnico{'\n'}
          • Autoridades: cuando sea requerido por ley o mandato judicial
        </Text>

        <Text style={h}>5. Derechos del titular</Text>
        <Text style={p}>
          De acuerdo con la Ley 29733, usted tiene derecho a:{'\n\n'}
          • Acceso: conocer qué datos tenemos sobre usted{'\n'}
          • Rectificación: corregir datos inexactos{'\n'}
          • Cancelación: solicitar la eliminación de sus datos{'\n'}
          • Oposición: oponerse al tratamiento de sus datos{'\n\n'}
          Para ejercer estos derechos, escriba a: contacto@solu.pe
        </Text>

        <Text style={h}>6. Retención de datos</Text>
        <Text style={p}>
          Los datos de clientes se conservan por 2 años desde la última interacción. Los datos de técnicos se conservan mientras la cuenta esté activa. Las fotos de DNI se eliminan 30 días después de la verificación exitosa.
        </Text>

        <Text style={h}>7. Contacto</Text>
        <Text style={p}>
          Responsable del tratamiento: CITYLAND GROUP E.I.R.L.{'\n'}
          RUC: 20614914239{'\n'}
          Correo: contacto@solu.pe{'\n'}
          Teléfono: 904518343
        </Text>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

const h = { fontSize: 16, fontWeight: '700' as const, color: '#1A1A2E', marginTop: 20, marginBottom: 8 }
const p = { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 8 }
