// "No pude cargar" NO es "no hay nada". Cuando el dashboard fallaba, el panel
// afirmaba "No hay trabajos en tu zona ahora" / "Sin pagos registrados": hechos
// de negocio falsos. El técnico que los cree concluye que SOLU no le trae trabajo.

import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../../lib/theme'

export function ErrorDeCarga({ titulo, onRetry }: { titulo: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ alignItems: 'center', paddingVertical: THEME.space.xl }}>
      <Ionicons name="cloud-offline-outline" size={32} color={THEME.color.inkMuted} />
      <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.ink, marginTop: THEME.space.sm, textAlign: 'center' }}>{titulo}</Text>
      <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center', lineHeight: 17 }}>
        Es un problema de conexión con SOLU, no que no tengas actividad.
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        accessibilityLabel="Reintentar la carga de tu panel"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.md, paddingHorizontal: THEME.space.lg, minHeight: 44, marginTop: THEME.space.md }}
      >
        <Ionicons name="refresh" size={16} color={THEME.color.info} />
        <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.info }}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  )
}

export default ErrorDeCarga
