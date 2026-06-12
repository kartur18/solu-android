import { useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, KeyboardAvoidingView, Platform, StatusBar, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../src/lib/supabase'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, PulseDot } from '../src/components/ui/Motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MSG: Message = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de soporte de SOLU. Puedo ayudarte con:\n\n• Problemas con tu cuenta\n• Dudas sobre pagos y Coins\n• Cómo solicitar un técnico\n• Problemas con un servicio\n• Cualquier otra consulta\n\n¿En qué puedo ayudarte?',
}

// ── Typing indicator: 3 puntos animados en burbuja SOLU ──
function TypingDots() {
  const dots = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [dots])

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.xl,
        borderBottomLeftRadius: THEME.radius.sm,
        paddingHorizontal: THEME.space.lg,
        paddingVertical: THEME.space.md + 2,
        flexDirection: 'row',
        gap: 6,
        ...THEME.shadow.sm,
      }}
    >
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.color.inkMuted, opacity: v }} />
      ))}
    </View>
  )
}

export default function SoporteScreen() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  // Scroll diferido para que la burbuja nueva ya esté renderizada
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(t)
  }, [messages, loading])

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
      setMessages([...newMessages, { role: 'assistant', content: 'No pude conectarme 😕. Revisa tu internet e intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      behavior="padding"
    >
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={{ backgroundColor: THEME.color.navy, paddingHorizontal: THEME.space.lg, paddingBottom: THEME.space.lg, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.md }}>
        <PressableScale accessibilityLabel="Volver" haptic={false} onPress={() => router.dismiss()} style={{ width: 40, height: 40, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={THEME.color.white} />
        </PressableScale>
        <View style={{ width: 42, height: 42, borderRadius: THEME.radius.full, backgroundColor: 'rgba(242,107,33,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={20} color={THEME.color.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Soporte SOLU</Text>
          <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.62)' }}>Asistente IA · Respuesta inmediata</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: 'rgba(22,163,74,0.16)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs + 1 }}>
          <PulseDot color={THEME.color.success} size={7} />
          <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>En línea</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: THEME.space.md, gap: THEME.space.sm + 2, paddingBottom: THEME.space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          return (
            <FadeInUp key={i} distance={8} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
              <View style={{
                backgroundColor: isUser ? THEME.color.brand : THEME.color.surface,
                borderRadius: THEME.radius.xl,
                borderBottomRightRadius: isUser ? THEME.radius.sm : THEME.radius.xl,
                borderBottomLeftRadius: isUser ? THEME.radius.xl : THEME.radius.sm,
                paddingHorizontal: THEME.space.lg,
                paddingVertical: THEME.space.md,
                ...(isUser ? THEME.shadow.brand : THEME.shadow.sm),
              }}>
                <Text style={{ ...THEME.font.body, color: isUser ? THEME.color.white : THEME.color.ink, lineHeight: 21 }}>
                  {m.content}
                </Text>
              </View>
            </FadeInUp>
          )
        })}
        {loading && <TypingDots />}
      </ScrollView>

      {/* Input */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-end', padding: THEME.space.md,
        paddingBottom: Platform.OS === 'android' ? THEME.space.xxxl + THEME.space.xxl : THEME.space.md,
        gap: THEME.space.sm, backgroundColor: THEME.color.surface, ...THEME.shadow.lg,
      }}>
        <TextInput
          style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.xl, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md + 2, ...THEME.font.body, color: THEME.color.ink, maxHeight: 120 }}
          placeholder="Escribe tu consulta..."
          placeholderTextColor={THEME.color.inkMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          editable={!loading}
          returnKeyType="send"
          maxLength={1000}
        />
        <PressableScale
          onPress={handleSend}
          disabled={loading || !input.trim()}
          accessibilityLabel="Enviar mensaje"
          style={{
            width: 48, height: 48, borderRadius: THEME.radius.full,
            backgroundColor: input.trim() ? THEME.color.brand : THEME.color.inkMuted,
            alignItems: 'center', justifyContent: 'center',
            ...(input.trim() ? THEME.shadow.brand : {}),
          }}
        >
          <Ionicons name="send" size={18} color={THEME.color.white} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  )
}
