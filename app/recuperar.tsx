import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ENV } from '../src/lib/env'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

type Step = 'phone' | 'code' | 'reset'

export default function RecuperarScreen() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  // generatedCode no longer needed - verification happens server-side
  const [inputCode, setInputCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [userType, setUserType] = useState<'tecnico' | 'cliente' | null>(null)
  // Foco visual de inputs (borde brand 2px al enfocar)
  const [focused, setFocused] = useState<string | null>(null)
  // userId no longer needed - password reset handled entirely by backend API

  async function sendCode() {
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un número de WhatsApp válido (9 dígitos, empieza con 9)')
    }

    setLoading(true)
    try {
      let successResult: any = null

      // Try as tecnico first
      const res = await fetch(`${ENV.API_BASE_URL}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: waClean, tipo: 'tecnico' }),
      })
      const result = await res.json()

      if (res.ok) {
        setUserType('tecnico')
        successResult = result
      } else if (res.status === 404) {
        // Try as client
        const res2 = await fetch(`${ENV.API_BASE_URL}/password-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ whatsapp: waClean, tipo: 'cliente' }),
        })
        const result2 = await res2.json()

        if (!res2.ok) {
          Alert.alert('No encontrado', result2.error || 'No hay cuenta registrada con ese número.')
          setLoading(false)
          return
        }
        setUserType('cliente')
        successResult = result2
      } else {
        Alert.alert('Error', result.error || 'Error al generar código')
        setLoading(false)
        return
      }

      // If both WhatsApp and email failed, the API returns the code directly
      if (successResult?.codigo) {
        setInputCode(successResult.codigo)
        Alert.alert(
          '⚠️ Código de recuperación',
          `No se pudo enviar el código por WhatsApp ni email.\n\nTu código es:\n\n${successResult.codigo}\n\nAnótalo ahora. Expira en 15 minutos.`,
          [{ text: 'Entendido', onPress: () => setStep('code') }]
        )
      } else {
        // Show the message from the API (WhatsApp or email sent)
        Alert.alert(
          'Código enviado',
          successResult?.message || `Revisa tu WhatsApp terminado en ${waClean.slice(-4)}. Te hemos enviado un código de 6 dígitos.`,
          [{ text: 'OK', onPress: () => setStep('code') }]
        )
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function verifyCode() {
    if (!inputCode || inputCode.length !== 6) {
      return Alert.alert('Error', 'Ingresa el código de 6 dígitos')
    }
    // Code will be verified server-side when resetting password
    setStep('reset')
  }

  async function resetPassword() {
    if (!newPassword || newPassword.length < 6) {
      return Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres')
    }
    if (newPassword !== confirmPassword) {
      return Alert.alert('Error', 'Las contraseñas no coinciden')
    }
    if (!userType) return

    setLoading(true)
    try {
      const waClean = whatsapp.replace(/\D/g, '')
      const res = await fetch(`${ENV.API_BASE_URL}/password-reset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: waClean,
          tipo: userType,
          codigo: inputCode,
          newPassword,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        Alert.alert('Error', result.error || 'No se pudo actualizar la contraseña.')
      } else {
        haptics.success()
        Alert.alert(
          'Contraseña actualizada',
          'Tu contraseña se cambió exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.',
          [{ text: 'Ir a login', onPress: () => router.back() }]
        )
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const stepIndex = ['phone', 'code', 'reset'].indexOf(step)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: THEME.space.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <FadeInUp delay={0}>
        <View
          style={{
            backgroundColor: THEME.color.surface,
            borderRadius: THEME.radius.xxl,
            padding: THEME.space.xxl,
            ...THEME.shadow.md,
          }}
        >
          {/* Header */}
          <View
            style={{
              width: 64, height: 64, borderRadius: THEME.radius.xl,
              backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center',
              alignSelf: 'center', marginBottom: THEME.space.lg, ...THEME.shadow.brand,
            }}
          >
            <Ionicons name="key" size={28} color="#fff" />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center', marginBottom: THEME.space.xs }}>
            Recuperar contraseña
          </Text>
          <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginBottom: THEME.space.xxl }}>
            {step === 'phone' && 'Ingresa tu número de WhatsApp registrado'}
            {step === 'code' && 'Ingresa el código de verificación'}
            {step === 'reset' && 'Crea tu nueva contraseña'}
          </Text>

          {/* Step indicators */}
          <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginBottom: THEME.space.xxl }}>
            {(['phone', 'code', 'reset'] as Step[]).map((s, i) => (
              <View
                key={s}
                style={{
                  flex: 1, height: 5, borderRadius: THEME.radius.full,
                  backgroundColor: stepIndex >= i ? THEME.color.brand : THEME.color.line,
                }}
              />
            ))}
          </View>

          {/* STEP 1: Phone number */}
          {step === 'phone' && (
            <FadeInUp delay={80}>
              <Text style={styles.label}>WhatsApp</Text>
              <View style={styles.inputWrap(focused === 'whatsapp')}>
                <Ionicons name="logo-whatsapp" size={18} color={focused === 'whatsapp' ? THEME.color.brand : THEME.color.inkMuted} />
                <TextInput
                  placeholder="999 888 777"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                  onFocus={() => setFocused('whatsapp')}
                  onBlur={() => setFocused(null)}
                  style={styles.inputField}
                  placeholderTextColor={THEME.color.inkMuted}
                />
              </View>

              <PressableScale
                onPress={sendCode}
                disabled={loading}
                accessibilityLabel="Enviar código de recuperación"
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Verificando…' : 'Enviar código'}
                </Text>
              </PressableScale>
            </FadeInUp>
          )}

          {/* STEP 2: Code verification */}
          {step === 'code' && (
            <FadeInUp delay={80}>
              <Text style={styles.label}>Código de 6 dígitos</Text>
              <View style={[styles.inputWrap(focused === 'code'), { justifyContent: 'center' }]}>
                <TextInput
                  placeholder="------"
                  value={inputCode}
                  onChangeText={setInputCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setFocused('code')}
                  onBlur={() => setFocused(null)}
                  style={{
                    flex: 1, fontSize: 26, fontWeight: '900', color: THEME.color.ink,
                    textAlign: 'center', letterSpacing: 10, paddingVertical: 2,
                  }}
                  placeholderTextColor={THEME.color.inkMuted}
                />
              </View>

              <PressableScale
                onPress={verifyCode}
                accessibilityLabel="Verificar código"
                style={[styles.primaryBtn, { marginBottom: THEME.space.md }]}
              >
                <Text style={styles.primaryBtnText}>Verificar código</Text>
              </PressableScale>

              <TouchableOpacity onPress={() => setStep('phone')} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.brand, fontWeight: '700' }}>Reenviar código</Text>
              </TouchableOpacity>
            </FadeInUp>
          )}

          {/* STEP 3: New password */}
          {step === 'reset' && (
            <FadeInUp delay={80}>
              <Text style={styles.label}>Nueva contraseña</Text>
              <View style={[styles.inputWrap(focused === 'pass'), { marginBottom: THEME.space.md }]}>
                <Ionicons name="lock-closed-outline" size={18} color={focused === 'pass' ? THEME.color.brand : THEME.color.inkMuted} />
                <TextInput
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  style={styles.inputField}
                  placeholderTextColor={THEME.color.inkMuted}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={THEME.color.inkMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirmar contraseña</Text>
              <View style={styles.inputWrap(focused === 'confirm')}>
                <Ionicons name="lock-closed-outline" size={18} color={focused === 'confirm' ? THEME.color.brand : THEME.color.inkMuted} />
                <TextInput
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                  style={styles.inputField}
                  placeholderTextColor={THEME.color.inkMuted}
                />
              </View>

              <PressableScale
                onPress={resetPassword}
                disabled={loading}
                accessibilityLabel="Cambiar contraseña"
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Guardando…' : 'Cambiar contraseña'}
                </Text>
              </PressableScale>
            </FadeInUp>
          )}

          {/* Back link */}
          <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', marginTop: THEME.space.xl, minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, fontWeight: '600' }}>Volver al login</Text>
          </TouchableOpacity>
        </View>
      </FadeInUp>
    </ScrollView>
  )
}

const styles = {
  label: {
    ...THEME.font.label,
    color: THEME.color.inkSoft,
    marginBottom: THEME.space.sm,
  },
  // Wrapper de input con borde brand 2px al enfocar
  inputWrap: (active: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: THEME.space.md,
    backgroundColor: active ? THEME.color.surface : THEME.color.surfaceAlt,
    borderRadius: THEME.radius.lg,
    borderWidth: 2,
    borderColor: active ? THEME.color.brand : THEME.color.line,
    paddingHorizontal: THEME.space.lg,
    minHeight: 56,
    marginBottom: THEME.space.lg,
  }),
  inputField: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: THEME.color.ink,
    paddingVertical: THEME.space.md,
  },
  primaryBtn: {
    backgroundColor: THEME.color.brand,
    borderRadius: THEME.radius.lg,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...THEME.shadow.brand,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
}
