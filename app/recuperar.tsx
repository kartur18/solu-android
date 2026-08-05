import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'
import TipoCuentaPicker, { TipoCuenta } from '../src/components/TipoCuentaPicker'
import { validarPassword, PASSWORD_MIN_LENGTH } from '../src/lib/password-policy'

type Step = 'phone' | 'code' | 'reset'
type ResetResponse = { success?: boolean; message?: string; error?: string }

// El backend expira el código a los 15 min (src/app/api/password-reset/route.ts).
const CODE_TTL_MS = 15 * 60 * 1000

// Mismo texto neutro que devuelve el servidor: no confirma si el número está
// registrado. Solo se usa si la respuesta viniera sin `message`.
const MENSAJE_ENVIO = 'Si la cuenta existe, te enviamos un código a tu WhatsApp o email registrado.'

const ETIQUETA_TIPO: Record<TipoCuenta, string> = { cliente: 'cliente', tecnico: 'técnico' }

export default function RecuperarScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tipo?: string }>()
  const [step, setStep] = useState<Step>('phone')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // El tipo lo ELIGE la persona. Antes la pantalla pedía el código como
  // 'tecnico' y solo caía a 'cliente' con un 404 que el servidor dejó de
  // devolver (anti-enumeración): ningún cliente podía recuperar su cuenta.
  const [tipo, setTipo] = useState<TipoCuenta | null>(
    params.tipo === 'cliente' || params.tipo === 'tecnico' ? params.tipo : null,
  )
  // Expiración del código — arranca cuando el servidor confirma el envío.
  const [expiraEn, setExpiraEn] = useState<number | null>(null)
  const [segundos, setSegundos] = useState(0)
  // Foco visual de inputs (borde brand 2px al enfocar)
  const [focused, setFocused] = useState<string | null>(null)

  // Preselección por sesión guardada, igual que la web con localStorage. Es
  // solo una pista: el selector queda visible y la persona confirma. Nunca
  // pisa una elección ya hecha (por eso el update funcional).
  useEffect(() => {
    let vivo = true
    AsyncStorage.multiGet(['solu_client_session', 'solu_tech_session'])
      .then((pares) => {
        if (!vivo) return
        const guardado = pares.find(([, valor]) => Boolean(valor))?.[0]
        if (guardado === 'solu_client_session') setTipo((prev) => prev ?? 'cliente')
        else if (guardado === 'solu_tech_session') setTipo((prev) => prev ?? 'tecnico')
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!expiraEn) return
    const tick = () => setSegundos(Math.max(0, Math.floor((expiraEn - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiraEn])

  const reiniciar = useCallback(() => {
    setStep('phone')
    setInputCode('')
    setNewPassword('')
    setConfirmPassword('')
    setExpiraEn(null)
    setSegundos(0)
  }, [])

  const sendCode = useCallback(async () => {
    if (!tipo) {
      return Alert.alert(
        'Elige tu tipo de cuenta',
        'Cuéntanos si entras como cliente o como técnico para enviarte el código.',
      )
    }
    const waClean = whatsapp.replace(/\D/g, '')
    if (!/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un número de WhatsApp válido (9 dígitos, empieza con 9)')
    }

    setLoading(true)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: waClean, tipo }),
      })
      const result = (await res.json().catch(() => ({}))) as ResetResponse

      if (!res.ok) {
        Alert.alert('No pudimos enviar el código', result.error || 'Intenta de nuevo en unos minutos.')
        return
      }

      setInputCode('')
      setExpiraEn(Date.now() + CODE_TTL_MS)
      setStep('code')
      // El servidor responde igual exista o no la cuenta: mostramos su mensaje
      // tal cual para no convertir la app en un oráculo de números registrados.
      Alert.alert('Revisa tu WhatsApp', result.message || MENSAJE_ENVIO)
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [tipo, whatsapp])

  function verifyCode() {
    if (!/^\d{6}$/.test(inputCode)) {
      return Alert.alert('Error', 'Ingresa el código de 6 dígitos')
    }
    if (expiraEn && segundos === 0) {
      return Alert.alert('Código expirado', 'Pide uno nuevo con "Reenviar código".')
    }
    // El código se verifica en el servidor al cambiar la contraseña.
    setStep('reset')
  }

  async function resetPassword() {
    if (!tipo) return reiniciar()
    const errorPass = validarPassword(newPassword)
    if (errorPass) return Alert.alert('Error', errorPass)
    if (newPassword !== confirmPassword) {
      return Alert.alert('Error', 'Las contraseñas no coinciden')
    }

    setLoading(true)
    try {
      const waClean = whatsapp.replace(/\D/g, '')
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/password-reset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: waClean, tipo, codigo: inputCode, newPassword }),
      })
      const result = (await res.json().catch(() => ({}))) as ResetResponse

      if (!res.ok) {
        // "Código inválido" también aparece cuando la cuenta no existe para ese
        // tipo (el servidor no distingue, a propósito). Damos la salida en vez
        // de dejar a la persona sin camino.
        const otro = tipo === 'cliente' ? 'técnico' : 'cliente'
        Alert.alert(
          'No se pudo cambiar la contraseña',
          `${result.error || 'Intenta de nuevo.'}\n\nSi elegiste el tipo de cuenta equivocado, vuelve al inicio y pide el código como ${otro}.`,
          [
            { text: 'Volver al inicio', style: 'cancel', onPress: reiniciar },
            { text: 'Corregir código', onPress: () => setStep('code') },
          ],
        )
        return
      }

      haptics.success()
      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña se cambió exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.',
        [{ text: 'Ir a login', onPress: () => router.back() }],
      )
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const stepIndex = ['phone', 'code', 'reset'].indexOf(step)
  const cuenta = tipo ? ETIQUETA_TIPO[tipo] : ''

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
            {step === 'phone' && 'Elige tu tipo de cuenta e ingresa tu WhatsApp registrado'}
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

          {/* STEP 1: Tipo de cuenta + teléfono */}
          {step === 'phone' && (
            <FadeInUp delay={80}>
              <Text style={styles.label}>¿Cómo usas SOLU?</Text>
              <TipoCuentaPicker value={tipo} onChange={setTipo} disabled={loading} />

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
                  {loading ? 'Enviando…' : 'Enviar código'}
                </Text>
              </PressableScale>
            </FadeInUp>
          )}

          {/* STEP 2: Code verification */}
          {step === 'code' && (
            <FadeInUp delay={80}>
              {tipo && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs, marginBottom: THEME.space.sm }}>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>
                    Cuenta de {cuenta}
                  </Text>
                  <TouchableOpacity
                    onPress={reiniciar}
                    accessibilityLabel="Cambiar tipo de cuenta o número"
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    style={{ paddingVertical: THEME.space.xs }}
                  >
                    <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.brand }}>· Cambiar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {expiraEn && (
                <Text
                  style={{
                    ...THEME.font.caption,
                    fontWeight: '700',
                    textAlign: 'center',
                    marginBottom: THEME.space.md,
                    color: segundos === 0 ? THEME.color.danger : segundos < 60 ? THEME.color.brand : THEME.color.inkSoft,
                  }}
                >
                  {segundos === 0
                    ? 'Código expirado · pide uno nuevo abajo'
                    : `Caduca en ${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`}
                </Text>
              )}

              <Text style={styles.label}>Código de 6 dígitos</Text>
              <View style={[styles.inputWrap(focused === 'code'), { justifyContent: 'center' }]}>
                <TextInput
                  placeholder="------"
                  value={inputCode}
                  onChangeText={(t) => setInputCode(t.replace(/\D/g, '').slice(0, 6))}
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

              <TouchableOpacity
                onPress={sendCode}
                disabled={loading}
                accessibilityLabel="Reenviar código"
                style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.brand, fontWeight: '700' }}>
                  {loading ? 'Enviando…' : 'Reenviar código'}
                </Text>
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
                  placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
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
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: -THEME.space.sm, marginBottom: THEME.space.md }}>
                Debe incluir al menos una letra y un número.
              </Text>

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
