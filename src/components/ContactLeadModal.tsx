import { useEffect, useState } from 'react'
import { View, Text, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../lib/theme'
import { PressableScale } from './ui/Motion'

// Modal mínimo para capturar nombre + WhatsApp del cliente nuevo antes de
// crear el lead. Pre-llena desde el perfil si existe. Valida WhatsApp peruano
// (9 dígitos, empieza con 9). Consistente con THEME, tap targets >=44px.

const WHATSAPP_RE = /^9\d{8}$/

type Props = {
  visible: boolean
  initialNombre?: string
  initialWhatsapp?: string
  enviando?: boolean
  onConfirm: (nombre: string, whatsapp: string) => void
  onClose: () => void
}

export function ContactLeadModal({
  visible,
  initialNombre = '',
  initialWhatsapp = '',
  enviando = false,
  onConfirm,
  onClose,
}: Props) {
  const [nombre, setNombre] = useState(initialNombre)
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp)
  const [touched, setTouched] = useState(false)

  // Re-sincroniza los campos al abrir (el perfil pudo cargar tarde).
  useEffect(() => {
    if (visible) {
      setNombre(initialNombre)
      setWhatsapp(initialWhatsapp)
      setTouched(false)
    }
  }, [visible, initialNombre, initialWhatsapp])

  const waLimpio = whatsapp.replace(/\D/g, '')
  const nombreOk = nombre.trim().length >= 2
  const waOk = WHATSAPP_RE.test(waLimpio)
  const valido = nombreOk && waOk

  function handleConfirm() {
    setTouched(true)
    if (!valido || enviando) return
    onConfirm(nombre.trim(), waLimpio)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: THEME.color.surface,
            borderTopLeftRadius: THEME.radius.xxl,
            borderTopRightRadius: THEME.radius.xxl,
            paddingHorizontal: THEME.space.xl,
            paddingTop: THEME.space.lg,
            paddingBottom: 36,
            ...THEME.shadow.lg,
          }}
        >
          {/* Handle + cerrar */}
          <View style={{ alignItems: 'center', marginBottom: THEME.space.md }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.color.line }} />
          </View>
          <PressableScale
            onPress={onClose}
            accessibilityLabel="Cerrar"
            style={{ position: 'absolute', top: THEME.space.md, right: THEME.space.md, width: 44, height: 44, borderRadius: THEME.radius.full, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color={THEME.color.inkMuted} />
          </PressableScale>

          {/* Encabezado */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.xs }}>
            <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chatbubble-ellipses" size={20} color={THEME.color.brand} />
            </View>
            <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>Tus datos para el chat</Text>
          </View>
          <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginBottom: THEME.space.lg, lineHeight: 19 }}>
            Los necesitamos para que el técnico pueda responderte. Solo se piden una vez.
          </Text>

          {/* Nombre */}
          <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft, marginBottom: 6 }}>Nombre</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            placeholderTextColor={THEME.color.inkMuted}
            autoCapitalize="words"
            accessibilityLabel="Tu nombre"
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: touched && !nombreOk ? THEME.color.danger : THEME.color.line,
              borderRadius: THEME.radius.md,
              paddingHorizontal: THEME.space.md,
              ...THEME.font.body,
              color: THEME.color.ink,
              backgroundColor: THEME.color.surfaceAlt,
            }}
          />
          {touched && !nombreOk && (
            <Text style={{ ...THEME.font.caption, color: THEME.color.danger, marginTop: 4 }}>Ingresa tu nombre</Text>
          )}

          {/* WhatsApp */}
          <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft, marginTop: THEME.space.md, marginBottom: 6 }}>WhatsApp</Text>
          <TextInput
            value={whatsapp}
            onChangeText={(t) => setWhatsapp(t.replace(/\D/g, '').slice(0, 9))}
            placeholder="9XXXXXXXX"
            placeholderTextColor={THEME.color.inkMuted}
            keyboardType="number-pad"
            maxLength={9}
            accessibilityLabel="Tu número de WhatsApp"
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: touched && !waOk ? THEME.color.danger : THEME.color.line,
              borderRadius: THEME.radius.md,
              paddingHorizontal: THEME.space.md,
              ...THEME.font.body,
              color: THEME.color.ink,
              backgroundColor: THEME.color.surfaceAlt,
            }}
          />
          {touched && !waOk && (
            <Text style={{ ...THEME.font.caption, color: THEME.color.danger, marginTop: 4 }}>Debe tener 9 dígitos y empezar con 9</Text>
          )}

          {/* Confirmar */}
          <PressableScale
            onPress={handleConfirm}
            disabled={enviando}
            accessibilityLabel="Iniciar chat con el técnico"
            style={{
              marginTop: THEME.space.xl,
              minHeight: 52,
              backgroundColor: THEME.color.brand,
              borderRadius: THEME.radius.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: THEME.space.sm,
              ...THEME.shadow.brand,
            }}
          >
            {enviando ? (
              <ActivityIndicator color={THEME.color.white} />
            ) : (
              <>
                <Ionicons name="send" size={18} color={THEME.color.white} />
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Iniciar chat</Text>
              </>
            )}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
