import { useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { ENV, fetchWithTimeout } from '../src/lib/env'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MSG: Message = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de soporte de SOLU. Puedo ayudarte con:\n\n• Problemas con tu cuenta\n• Dudas sobre planes y pagos\n• Cómo solicitar un técnico\n• Problemas con un servicio\n• Cualquier otra consulta\n\n¿En qué puedo ayudarte?',
}

export default function SoporteScreen() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'support',
          messages: newMessages.filter((_, i) => i > 0).slice(-8),
        }),
      })
      const data = await res.json()
      const reply = data.reply || 'Lo siento, no pude procesar tu consulta. Intenta de nuevo.'
      setMessages([...newMessages, { role: 'assistant', content: reply }])

      // Save to soporte table for admin visibility
      try {
        await supabase.from('soporte').insert({
          asunto: userMsg.slice(0, 50),
          mensaje: userMsg,
          respuesta_ia: reply,
          whatsapp: 'app',
        })
      } catch {}
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error de conexión. Verifica tu internet e intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      {/* Header */}
      <View style={{ backgroundColor: '#1E3A5F', padding: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/') }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={18} color="#F59E0B" />
        </View>
        <View>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Soporte SOLU</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>Asistente IA · Respuesta inmediata</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, padding: 12 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <View style={{
              backgroundColor: m.role === 'user' ? '#1E3A5F' : '#fff',
              borderRadius: 16,
              borderBottomRightRadius: m.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: m.role === 'assistant' ? 4 : 16,
              paddingHorizontal: 14, paddingVertical: 12,
              borderWidth: m.role === 'assistant' ? 1 : 0,
              borderColor: '#E2E8F0',
              elevation: 1,
            }}>
              <Text style={{ fontSize: 13, color: m.role === 'user' ? '#fff' : COLORS.dark, lineHeight: 19 }}>
                {m.content}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 12, color: COLORS.gray2 }}>Escribiendo...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={{
        flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'android' ? 24 : 12,
        gap: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#fff',
      }}>
        <TextInput
          style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.dark }}
          placeholder="Escribe tu consulta..."
          placeholderTextColor={COLORS.gray2}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          editable={!loading}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={loading || !input.trim()}
          style={{
            width: 46, height: 46, borderRadius: 14, backgroundColor: '#1E3A5F',
            alignItems: 'center', justifyContent: 'center',
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
