import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'

export default function SoporteScreen() {
  const router = useRouter()
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!asunto.trim() || !mensaje.trim() || !whatsapp.trim()) {
      return Alert.alert('Error', 'Completa todos los campos')
    }
    setLoading(true)
    const { error } = await supabase.from('soporte').insert({
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
      whatsapp: whatsapp.trim(),
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', 'No se pudo enviar tu mensaje. Intenta de nuevo.')
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: COLORS.light }}>
        <Ionicons name="checkmark-circle" size={64} color={COLORS.acc} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginTop: 16 }}>Mensaje enviado</Text>
        <Text style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8 }}>
          Te responderemos por WhatsApp lo antes posible
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: COLORS.pri, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: COLORS.white, fontWeight: '700' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Soporte</Text>
        <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>
          Cuéntanos en qué podemos ayudarte
        </Text>

        <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Tu WhatsApp</Text>
          <TextInput
            placeholder="999 888 777"
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 14 }}
            placeholderTextColor={COLORS.gray2}
          />

          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Asunto</Text>
          <TextInput
            placeholder="Ej: Problema con mi cuenta"
            value={asunto}
            onChangeText={setAsunto}
            style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 14 }}
            placeholderTextColor={COLORS.gray2}
          />

          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Mensaje</Text>
          <TextInput
            placeholder="Describe tu problema o consulta..."
            value={mensaje}
            onChangeText={setMensaje}
            multiline
            numberOfLines={5}
            style={{
              backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 14,
              height: 120, textAlignVertical: 'top', marginBottom: 16,
            }}
            placeholderTextColor={COLORS.gray2}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center' }}
          >
            <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>
              {loading ? 'Enviando...' : 'Enviar mensaje'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}
