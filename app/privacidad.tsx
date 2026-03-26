import { ScrollView, View, Text } from 'react-native'
import { COLORS } from '../src/lib/constants'

export default function PrivacidadScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ padding: 20, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Política de Privacidad</Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 20 }}>Última actualización: Marzo 2026</Text>

        <Text style={p}>
          En cumplimiento de la Ley N° 29733, Ley de Protección de Datos Personales del Perú, y su Reglamento aprobado por el Decreto Supremo N° 003-2013-JUS, CITYLAND GROUP E.I.R.L. (en adelante, "SOLU") informa lo siguiente sobre el tratamiento de datos personales recopilados a través de la aplicación móvil y sitio web solu.pe:
        </Text>

        <Text style={h}>1. Responsable del tratamiento</Text>
        <Text style={p}>
          Razón social: CITYLAND GROUP E.I.R.L.{'\n'}
          RUC: 20614914239{'\n'}
          Domicilio: Lima, Perú{'\n'}
          Correo electrónico: contacto@solu.pe{'\n'}
          WhatsApp: +51 904518343{'\n\n'}
          El banco de datos personales se encuentra inscrito ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos del Perú.
        </Text>

        <Text style={h}>2. Datos personales que recopilamos</Text>
        <Text style={p}>
          2.1 Clientes:{'\n'}
          • Nombre completo{'\n'}
          • Número de WhatsApp{'\n'}
          • Distrito/ubicación{'\n'}
          • Contraseña (almacenada de forma encriptada SHA-256){'\n'}
          • Servicios solicitados y descripciones{'\n'}
          • Fotos del problema (cuando el cliente las adjunta){'\n'}
          • Calificaciones y reseñas{'\n'}
          • Token de notificaciones push{'\n\n'}
          2.2 Técnicos:{'\n'}
          • Nombre completo{'\n'}
          • Documento Nacional de Identidad (DNI) - número y fotografía{'\n'}
          • Número de WhatsApp{'\n'}
          • Correo electrónico (opcional){'\n'}
          • Oficio(s) y experiencia profesional{'\n'}
          • Distrito(s) de cobertura{'\n'}
          • Contraseña (almacenada de forma encriptada SHA-256){'\n'}
          • Fotos de trabajos realizados{'\n'}
          • Información de pagos y plan contratado{'\n'}
          • Ubicación GPS (solo cuando se usa la función de geolocalización){'\n'}
          • Token de notificaciones push
        </Text>

        <Text style={h}>3. Finalidad del tratamiento</Text>
        <Text style={p}>
          Los datos personales son tratados exclusivamente para las siguientes finalidades:{'\n\n'}
          • Crear y gestionar cuentas de usuarios (clientes y técnicos){'\n'}
          • Conectar clientes con técnicos disponibles en su zona{'\n'}
          • Verificar la identidad de los técnicos mediante RENIEC{'\n'}
          • Procesar pagos de suscripciones a través de Culqi{'\n'}
          • Enviar notificaciones sobre el estado de los servicios{'\n'}
          • Facilitar la comunicación entre cliente y técnico (chat interno y WhatsApp){'\n'}
          • Generar estadísticas anónimas para mejorar el servicio{'\n'}
          • Prevenir fraude y uso indebido de la plataforma{'\n'}
          • Emitir comprobantes de pago electrónicos{'\n'}
          • Cumplir obligaciones legales y tributarias
        </Text>

        <Text style={h}>4. Consentimiento</Text>
        <Text style={p}>
          Al registrarse en SOLU, el usuario otorga su consentimiento libre, previo, expreso, informado e inequívoco para el tratamiento de sus datos personales conforme a las finalidades descritas en esta política. El usuario puede revocar su consentimiento en cualquier momento mediante solicitud escrita a contacto@solu.pe.
        </Text>

        <Text style={h}>5. Almacenamiento y seguridad</Text>
        <Text style={p}>
          5.1 Los datos se almacenan en servidores seguros de Supabase (infraestructura Amazon Web Services) con encriptación en tránsito (TLS/SSL) y en reposo.{'\n\n'}
          5.2 Las contraseñas se almacenan como hash SHA-256 irreversible. SOLU no puede ver ni recuperar las contraseñas originales.{'\n\n'}
          5.3 Las fotos de DNI se almacenan en un bucket privado con acceso restringido únicamente a administradores autorizados mediante URLs temporales con expiración de 5 minutos.{'\n\n'}
          5.4 SOLU implementa medidas técnicas y organizativas para proteger los datos contra acceso no autorizado, pérdida, alteración o destrucción, incluyendo:{'\n'}
          • Control de acceso basado en roles{'\n'}
          • Row Level Security (RLS) en base de datos{'\n'}
          • Rate limiting en APIs{'\n'}
          • Monitoreo de actividad sospechosa
        </Text>

        <Text style={h}>6. Transferencia y compartición de datos</Text>
        <Text style={p}>
          SOLU no vende, alquila ni comercializa datos personales. Los datos pueden ser compartidos únicamente con:{'\n\n'}
          • Culqi (procesador de pagos regulado por la SBS): para procesar transacciones{'\n'}
          • RENIEC: para verificar la identidad de técnicos{'\n'}
          • Cloudinary: para optimización de imágenes de perfil{'\n'}
          • Mixpanel: para analíticas anónimas de uso{'\n'}
          • Firebase/Google: para notificaciones push{'\n'}
          • NubeFact: para emisión de comprobantes electrónicos{'\n'}
          • Anthropic (Claude AI): para el asistente de soporte (los mensajes no contienen datos personales identificables){'\n'}
          • Autoridades competentes: cuando sea requerido por ley, mandato judicial o requerimiento de autoridad administrativa
        </Text>

        <Text style={h}>7. Transferencia internacional de datos</Text>
        <Text style={p}>
          Algunos de nuestros proveedores de servicios tienen servidores fuera del Perú (Estados Unidos). En todos los casos, se garantiza un nivel adecuado de protección conforme al artículo 15 de la Ley 29733 y los estándares internacionales de protección de datos.
        </Text>

        <Text style={h}>8. Derechos del titular (ARCO)</Text>
        <Text style={p}>
          De acuerdo con los artículos 18 al 27 de la Ley 29733, usted tiene derecho a:{'\n\n'}
          • Acceso: Conocer qué datos personales tenemos sobre usted y cómo los tratamos{'\n'}
          • Rectificación: Solicitar la corrección de datos inexactos o incompletos{'\n'}
          • Cancelación: Solicitar la eliminación de sus datos cuando ya no sean necesarios{'\n'}
          • Oposición: Oponerse al tratamiento de sus datos por motivos legítimos{'\n\n'}
          Para ejercer estos derechos, envíe su solicitud a:{'\n'}
          • Email: contacto@solu.pe{'\n'}
          • WhatsApp: +51 904518343{'\n'}
          • Función "Eliminar mi cuenta" dentro de la app{'\n\n'}
          SOLU atenderá su solicitud dentro de los 10 días hábiles siguientes. Si no recibe respuesta, puede acudir a la Autoridad Nacional de Protección de Datos Personales (ANPDP).
        </Text>

        <Text style={h}>9. Retención de datos</Text>
        <Text style={p}>
          • Datos de clientes activos: mientras la cuenta esté activa{'\n'}
          • Datos de clientes inactivos: 2 años desde la última interacción{'\n'}
          • Datos de técnicos: mientras la cuenta esté activa{'\n'}
          • Fotos de DNI: se eliminan 30 días después de la verificación exitosa{'\n'}
          • Registros de pagos: 5 años (obligación tributaria SUNAT){'\n'}
          • Mensajes del chat: 1 año desde el último mensaje{'\n\n'}
          Al eliminar su cuenta, sus datos personales serán eliminados dentro de los 30 días siguientes, excepto aquellos que debamos conservar por obligación legal.
        </Text>

        <Text style={h}>10. Cookies y tecnologías similares</Text>
        <Text style={p}>
          La versión web de SOLU utiliza cookies y tecnologías similares (localStorage, sessionStorage) para:{'\n'}
          • Mantener la sesión del usuario activa{'\n'}
          • Recordar preferencias{'\n'}
          • Analíticas de uso (Google Analytics, Mixpanel){'\n\n'}
          El usuario puede configurar su navegador para rechazar cookies, aunque esto puede afectar la funcionalidad del sitio.
        </Text>

        <Text style={h}>11. Menores de edad</Text>
        <Text style={p}>
          SOLU no está dirigido a menores de 18 años. No recopilamos intencionalmente datos de menores. Si identificamos que un menor ha proporcionado datos, los eliminaremos inmediatamente.
        </Text>

        <Text style={h}>12. Modificaciones</Text>
        <Text style={p}>
          SOLU puede actualizar esta política de privacidad. Los cambios serán publicados en la app y en solu.pe. Se notificará a los usuarios registrados sobre cambios significativos.
        </Text>

        <Text style={h}>13. Autoridad competente</Text>
        <Text style={p}>
          La Autoridad Nacional de Protección de Datos Personales (ANPDP), adscrita al Ministerio de Justicia y Derechos Humanos del Perú, es la entidad encargada de velar por el cumplimiento de la Ley 29733.{'\n\n'}
          Dirección: Scipión Llona 350, Miraflores, Lima{'\n'}
          Teléfono: (01) 204-8020{'\n'}
          Web: www.minjus.gob.pe
        </Text>
      </View>
    </ScrollView>
  )
}

const h = { fontSize: 16, fontWeight: '700' as const, color: '#1A1A2E', marginTop: 20, marginBottom: 8 }
const p = { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 8 }
