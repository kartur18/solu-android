// Cuántos clientes están esperando respuesta, arriba de todo en la bandeja.
//
// El contador viejo hablaba de "mensajes sin leer": un número de mensajes no
// le dice al técnico cuántos trabajos tiene en juego. Lo que importa es cuánta
// gente está esperando que le contesten.

import { Ionicons } from '@expo/vector-icons'
import { View, Text } from 'react-native'
import { THEME } from '../../lib/theme'

export function ResumenPendientes({ pendientes, sinLeer }: { pendientes: number; sinLeer: number }) {
  if (pendientes <= 0) return null
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm,
      paddingHorizontal: THEME.space.lg, paddingTop: THEME.space.md,
    }}>
      <Ionicons name="alarm" size={16} color={THEME.color.brand} />
      <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.ink, flex: 1 }}>
        {pendientes === 1 ? '1 cliente espera tu respuesta' : `${pendientes} clientes esperan tu respuesta`}
        {sinLeer > 0 ? ` · ${sinLeer} sin leer` : ''}
      </Text>
    </View>
  )
}

export default ResumenPendientes
