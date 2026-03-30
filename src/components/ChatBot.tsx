import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../lib/constants'
import { ENV, fetchWithTimeout } from '../lib/env'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const API_URL = `${ENV.API_BASE_URL}/ai-chat`

export function ChatBot() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lastService, setLastService] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy el asistente IA de SOLU. Describe tu problema y te recomiendo el técnico ideal.\n\nEjemplo: "Tengo una fuga en el baño"' },
  ])
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
      const res = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: messages.length <= 1 ? 'recommend' : undefined,
          messages: newMessages.filter((m, i) => m.role !== 'assistant' || i > 0).slice(-6),
        }),
        timeout: 15000,
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()
      let reply = data.reply || ''

      if (data.recommendation) {
        const r = data.recommendation
        setLastService(r.service)
        reply = `🔧 ${r.service}\n\n${r.explanation}\n\n⚡ Urgencia: ${r.urgency}${r.priceRange ? `\n💰 Precio estimado: ${r.priceRange}` : ''}\n\nToca "Buscar técnico" abajo para encontrar uno disponible.`
      }

      setMessages([...newMessages, { role: 'assistant', content: reply || 'Describe tu problema y te recomiendo el técnico ideal.' }])
    } catch {
      // Fallback: respuesta local si la API falla
      const lower = userMsg.toLowerCase()
      let fallback = 'Lo siento, no pude conectarme al servidor. Mientras tanto, puedes buscar técnicos directamente desde la pestaña "Buscar".'
      if (lower.includes('gas') || lower.includes('agua') || lower.includes('tuber') || lower.includes('fuga')) {
        fallback = '🔧 Por lo que describes, necesitas un Gasfitero.\n\nToca "Buscar técnico" abajo o ve a la pestaña Buscar y filtra por "Gasfitería".'
        setLastService('Gasfitería')
      } else if (lower.includes('luz') || lower.includes('electric') || lower.includes('enchufe') || lower.includes('corto')) {
        fallback = '⚡ Parece que necesitas un Electricista.\n\nToca "Buscar técnico" abajo para encontrar uno disponible.'
        setLastService('Electricidad')
      } else if (lower.includes('pintu') || lower.includes('pared')) {
        fallback = '🎨 Necesitas un Pintor.\n\nToca "Buscar técnico" para ver pintores disponibles.'
        setLastService('Pintura')
      } else if (lower.includes('cerr') || lower.includes('llave') || lower.includes('puerta')) {
        fallback = '🔑 Necesitas un Cerrajero.\n\nToca "Buscar técnico" para encontrar uno rápido.'
        setLastService('Cerrajería')
      }
      setMessages([...newMessages, { role: 'assistant', content: fallback }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => setOpen(true)}
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

  return (
    <Modal visible={open} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={{ height: '75%', backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', elevation: 10 }}>
          {/* Header */}
          <View style={{ backgroundColor: COLORS.dark, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={20} color={COLORS.yellow} />
              <View>
                <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 15 }}>Asistente IA SOLU</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Describe tu problema y te ayudo</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView ref={scrollRef} style={{ flex: 1, padding: 12 }} contentContainerStyle={{ gap: 8 }}>
            {messages.map((m, i) => (
              <View key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <View style={{
                  backgroundColor: m.role === 'user' ? COLORS.pri : COLORS.light,
                  borderRadius: 14,
                  borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                  borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14,
                  paddingHorizontal: 12, paddingVertical: 10,
                  borderWidth: m.role === 'assistant' ? 1 : 0,
                  borderColor: COLORS.border,
                }}>
                  <Text style={{ fontSize: 13, color: m.role === 'user' ? COLORS.white : COLORS.dark, lineHeight: 19 }}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={{ alignSelf: 'flex-start', backgroundColor: COLORS.light, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 12, color: COLORS.gray2 }}>Pensando...</Text>
              </View>
            )}
          </ScrollView>

          {/* Quick action */}
          {lastService && (
            <TouchableOpacity
              onPress={() => { setOpen(false); router.push({ pathname: '/buscar', params: { servicio: lastService } }) }}
              style={{ marginHorizontal: 12, marginBottom: 4, backgroundColor: COLORS.acc, borderRadius: 10, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="search" size={16} color={COLORS.white} />
              <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>Buscar técnico de {lastService}</Text>
            </TouchableOpacity>
          )}

          {/* Input */}
          <View style={{ flexDirection: 'row', padding: 12, paddingBottom: Platform.OS === 'android' ? 24 : 12, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white }}>
            <TextInput
              style={{ flex: 1, backgroundColor: COLORS.light, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, borderWidth: 1, borderColor: COLORS.border, color: COLORS.dark }}
              placeholder="Describe tu problema..."
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
                width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.pri,
                alignItems: 'center', justifyContent: 'center',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              <Ionicons name="send" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
