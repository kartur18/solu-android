import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import { ENV } from '../lib/env'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const API_URL = `${ENV.API_BASE_URL}/ai-chat`

export function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy el asistente de SOLU. Describe tu problema y te recomiendo el técnico ideal.\n\nEjemplo: "Tengo una fuga en el baño"' },
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
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: messages.length <= 1 ? 'recommend' : undefined,
          messages: newMessages.filter((m, i) => m.role !== 'assistant' || i > 0).slice(-6),
        }),
      })

      const data = await res.json()
      let reply = data.reply || ''

      if (data.recommendation) {
        const r = data.recommendation
        reply = `🔧 ${r.service}\n\n${r.explanation}\n\n⚡ Urgencia: ${r.urgency}${r.priceRange ? `\n💰 Precio estimado: ${r.priceRange}` : ''}\n\n¿Quieres que busque un técnico disponible?`
      }

      setMessages([...newMessages, { role: 'assistant', content: reply || 'No pude procesar tu mensaje.' }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          position: 'absolute', bottom: 90, right: 16, width: 52, height: 52,
          borderRadius: 26, backgroundColor: COLORS.pri, alignItems: 'center',
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
        <View style={{ height: '70%', backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', elevation: 10 }}>
          {/* Header */}
          <View style={{ backgroundColor: COLORS.pri, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 15 }}>Asistente SOLU</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Describe tu problema</Text>
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

          {/* Input */}
          <View style={{ flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <TextInput
              style={{ flex: 1, backgroundColor: COLORS.light, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, borderWidth: 1, borderColor: COLORS.border, color: COLORS.dark }}
              placeholder="Describe tu problema..."
              placeholderTextColor={COLORS.gray2}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.pri,
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
