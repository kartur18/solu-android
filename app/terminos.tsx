import { ScrollView, View, Text } from 'react-native'
import { COLORS } from '../src/lib/constants'

export default function TerminosScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ padding: 20, paddingBottom: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Términos y Condiciones</Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 20 }}>Última actualización: Marzo 2026</Text>

        <Text style={h}>1. Sobre SOLU</Text>
        <Text style={p}>
          SOLU es una plataforma operada por CITYLAND GROUP E.I.R.L. (RUC 20614914239) que conecta personas que necesitan servicios para el hogar con técnicos independientes verificados. SOLU no es una empresa de servicios de mantenimiento; somos un marketplace que facilita la conexión entre clientes y técnicos.
        </Text>

        <Text style={h}>2. Registro y cuentas</Text>
        <Text style={p}>
          2.1 Técnicos: Deben proporcionar nombre completo, DNI, WhatsApp y crear una contraseña. SOLU verifica la identidad del técnico a través de RENIEC. El técnico es un profesional independiente, no un empleado de SOLU.{'\n\n'}
          2.2 Clientes: Deben registrarse con nombre, WhatsApp y contraseña. Cada persona puede tener solo una cuenta. El uso de datos falsos resultará en la suspensión de la cuenta.{'\n\n'}
          2.3 Cada cuenta está vinculada a un DNI y WhatsApp único. Crear múltiples cuentas para obtener beneficios está prohibido y resultará en la suspensión permanente.
        </Text>

        <Text style={h}>3. Planes y precios</Text>
        <Text style={p}>
          3.1 SOLU ofrece tres planes para técnicos:{'\n'}
          • Profesional: S/49/mes - 1 oficio, 2 zonas{'\n'}
          • Premium: S/79/mes - hasta 2 oficios, 4 zonas{'\n'}
          • Elite: S/99/mes - oficios y zonas ilimitadas{'\n\n'}
          3.2 Todos los planes incluyen un primer mes gratuito. Los primeros 300 técnicos registrados reciben 2 meses adicionales gratis (3 meses en total).{'\n\n'}
          3.3 Los planes se renuevan mensualmente. El técnico puede cambiar de plan únicamente al momento de renovar. Durante el periodo activo, no se permiten cambios de plan.{'\n\n'}
          3.4 El servicio para clientes (solicitar técnicos) es completamente gratuito.
        </Text>

        <Text style={h}>4. Pagos y facturación</Text>
        <Text style={p}>
          4.1 Los pagos se procesan a través de Culqi, procesador de pagos regulado por la SBS del Perú. Se aceptan tarjetas de crédito, débito y Yape.{'\n\n'}
          4.2 Al realizar un pago, el plan se activa automáticamente por 30 días.{'\n\n'}
          4.3 SOLU emite comprobantes de pago electrónicos a través de NubeFact conforme a las normas de SUNAT.
        </Text>

        <Text style={h}>5. Política de reembolsos</Text>
        <Text style={p}>
          5.1 El primer mes gratuito no genera cargo. Si el técnico decide no continuar, simplemente no realiza el pago y su plan se desactiva.{'\n\n'}
          5.2 Una vez realizado el pago de un plan, no se otorgan reembolsos. El técnico puede usar su plan hasta la fecha de vencimiento.{'\n\n'}
          5.3 En caso de errores de cobro duplicado o problemas técnicos con el procesador de pago, SOLU evaluará el caso y procederá con el reembolso correspondiente dentro de los 15 días hábiles siguientes a la reclamación.{'\n\n'}
          5.4 Las reclamaciones deben realizarse a contacto@solu.pe o al WhatsApp 904518343 dentro de los 7 días posteriores al cobro.
        </Text>

        <Text style={h}>6. Responsabilidad</Text>
        <Text style={p}>
          6.1 SOLU actúa únicamente como intermediario tecnológico. No somos responsables por la calidad, puntualidad o resultado del servicio prestado por el técnico.{'\n\n'}
          6.2 Cualquier disputa entre cliente y técnico debe resolverse entre ambas partes. SOLU puede ayudar a mediar pero no asume responsabilidad económica por el servicio.{'\n\n'}
          6.3 SOLU no garantiza la disponibilidad permanente de la plataforma. Pueden existir interrupciones por mantenimiento o causas de fuerza mayor.
        </Text>

        <Text style={h}>7. Reseñas y calificaciones</Text>
        <Text style={p}>
          Los clientes pueden calificar a los técnicos después de cada servicio completado. Las reseñas deben ser honestas y basadas en experiencias reales. SOLU se reserva el derecho de eliminar reseñas que contengan insultos, información falsa, contenido discriminatorio o inapropiado.
        </Text>

        <Text style={h}>8. Uso del chat interno</Text>
        <Text style={p}>
          SOLU proporciona un sistema de mensajería interna para la comunicación entre clientes y técnicos. Está prohibido usar el chat para enviar contenido ofensivo, spam, publicidad no relacionada, o información personal sensible de terceros.
        </Text>

        <Text style={h}>9. Propiedad intelectual</Text>
        <Text style={p}>
          Todo el contenido de la plataforma SOLU (diseño, marca, código, textos, logotipos) es propiedad de CITYLAND GROUP E.I.R.L. Queda prohibida su reproducción, distribución o modificación sin autorización escrita.
        </Text>

        <Text style={h}>10. Suspensión y cancelación</Text>
        <Text style={p}>
          SOLU se reserva el derecho de suspender o cancelar cuentas que:{'\n'}
          • Proporcionen información falsa{'\n'}
          • Creen múltiples cuentas{'\n'}
          • Incumplan estos términos{'\n'}
          • Reciban múltiples quejas verificadas de clientes{'\n'}
          • Utilicen la plataforma para fines ilícitos
        </Text>

        <Text style={h}>11. Modificaciones</Text>
        <Text style={p}>
          SOLU puede modificar estos términos en cualquier momento. Los cambios serán publicados en esta página y notificados a los usuarios registrados. El uso continuado de la plataforma después de una modificación implica la aceptación de los nuevos términos.
        </Text>

        <Text style={h}>12. Legislación aplicable</Text>
        <Text style={p}>
          Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia será resuelta ante los tribunales competentes de Lima, Perú.
        </Text>

        <Text style={h}>13. Contacto</Text>
        <Text style={p}>
          CITYLAND GROUP E.I.R.L.{'\n'}
          RUC: 20614914239{'\n'}
          Email: contacto@solu.pe{'\n'}
          WhatsApp: 904518343{'\n'}
          Web: solu.pe
        </Text>
      </View>
    </ScrollView>
  )
}

const h = { fontSize: 16, fontWeight: '700' as const, color: '#1A1A2E', marginTop: 20, marginBottom: 8 }
const p = { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 8 }
