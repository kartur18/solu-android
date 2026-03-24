import { ScrollView, View, Text } from 'react-native'
import { COLORS } from '../src/lib/constants'

export default function TerminosScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Términos y Condiciones</Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 20 }}>Última actualización: Marzo 2026</Text>

        <Text style={h}>1. Sobre SOLU</Text>
        <Text style={p}>
          SOLU es una plataforma operada por CITYLAND GROUP E.I.R.L. (RUC 20614914239) que conecta personas que necesitan servicios para el hogar con técnicos independientes verificados. SOLU no es una empresa de servicios de mantenimiento; somos un marketplace que facilita la conexión entre clientes y técnicos.
        </Text>

        <Text style={h}>2. Registro de técnicos</Text>
        <Text style={p}>
          Los técnicos que se registran en SOLU deben proporcionar información veraz, incluyendo nombre completo, DNI y fotos del documento. SOLU verifica la identidad del técnico pero no garantiza la calidad del servicio prestado. El técnico es un profesional independiente, no un empleado de SOLU.
        </Text>

        <Text style={h}>3. Planes y pagos</Text>
        <Text style={p}>
          SOLU ofrece un plan gratuito con funcionalidades limitadas y planes de pago (Profesional, Premium, Elite). Los pagos se procesan a través de Culqi, un procesador de pagos regulado por la SBS. Los planes se renuevan mensualmente. El técnico puede cancelar su plan en cualquier momento.
        </Text>

        <Text style={h}>4. Responsabilidad</Text>
        <Text style={p}>
          SOLU actúa únicamente como intermediario. No somos responsables por la calidad, puntualidad o resultado del servicio prestado por el técnico. Cualquier disputa entre cliente y técnico debe resolverse entre ambas partes. SOLU puede ayudar a mediar pero no asume responsabilidad económica.
        </Text>

        <Text style={h}>5. Reseñas</Text>
        <Text style={p}>
          Los clientes pueden dejar reseñas sobre los técnicos. Las reseñas deben ser honestas y basadas en experiencias reales. SOLU se reserva el derecho de eliminar reseñas que contengan insultos, información falsa o contenido inapropiado.
        </Text>

        <Text style={h}>6. Propiedad intelectual</Text>
        <Text style={p}>
          Todo el contenido de la plataforma SOLU (diseño, marca, código, textos) es propiedad de CITYLAND GROUP E.I.R.L. Queda prohibida su reproducción sin autorización.
        </Text>

        <Text style={h}>7. Modificaciones</Text>
        <Text style={p}>
          SOLU puede modificar estos términos en cualquier momento. Los cambios serán publicados en esta página. El uso continuado de la plataforma después de una modificación implica la aceptación de los nuevos términos.
        </Text>

        <Text style={h}>8. Contacto</Text>
        <Text style={p}>
          Para consultas sobre estos términos: contacto@solu.pe
        </Text>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

const h = { fontSize: 16, fontWeight: '700' as const, color: '#1A1A2E', marginTop: 20, marginBottom: 8 }
const p = { fontSize: 14, color: '#6B7280', lineHeight: 22, marginBottom: 8 }
