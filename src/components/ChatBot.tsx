import { TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../lib/constants'

// Botón flotante que abre el Asistente IA full-screen (app/asistente.tsx).
// El flujo viejo de modal con bot por keywords fue reemplazado por el chat con IA.
export function ChatBot() {
  const router = useRouter()

  return (
    <TouchableOpacity
      onPress={() => router.push('/asistente')}
      accessibilityLabel="Abrir asistente de SOLU"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        position: 'absolute', bottom: 90, right: 16, width: 56, height: 56,
        borderRadius: 28, backgroundColor: COLORS.pri, alignItems: 'center',
        justifyContent: 'center', elevation: 6,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
      }}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.white} />
    </TouchableOpacity>
  )
}
