import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../src/lib/constants'
import { ENV } from '../src/lib/env'

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
  // userId no longer needed - password reset handled entirely by backend API

  async function sendCode() {
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un número de WhatsApp válido (9 dígitos, empieza con 9)')
    }

    setLoading(true)
    try {
      // First determine user type by checking both tables
      const res = await fetch(`${ENV.API_BASE_URL}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: waClean, tipo: 'tecnico' }),
      })
      const result = await res.json()

      if (res.ok) {
        setUserType('tecnico')
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
      } else {
        Alert.alert('Error', result.error || 'Error al generar código')
        setLoading(false)
        return
      }

      Alert.alert(
        'Código enviado',
        'Se ha enviado un código de verificación a tu email registrado. Si no lo recibes, revisa tu carpeta de spam.',
        [{ text: 'OK', onPress: () => setStep('code') }]
      )
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, elevation: 3 }}>
        {/* Header */}
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
          <Ionicons name="key" size={28} color="#fff" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark, textAlign: 'center', marginBottom: 4 }}>
          Recuperar contraseña
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginBottom: 24 }}>
          {step === 'phone' && 'Ingresa tu número de WhatsApp registrado'}
          {step === 'code' && 'Ingresa el código de verificación'}
          {step === 'reset' && 'Ingresa tu nueva contraseña'}
        </Text>

        {/* Step indicators */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {(['phone', 'code', 'reset'] as Step[]).map((s, i) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: (['phone', 'code', 'reset'].indexOf(step) >= i) ? '#1E3A5F' : '#E2E8F0' }} />
          ))}
        </View>

        {/* STEP 1: Phone number */}
        {step === 'phone' && (
          <>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>WhatsApp</Text>
            <TextInput
              placeholder="999 888 777"
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: '600', marginBottom: 16 }}
              placeholderTextColor={COLORS.gray2}
            />

            <TouchableOpacity
              onPress={sendCode}
              disabled={loading}
              style={{ backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {loading ? 'Verificando...' : 'Enviar código'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 2: Code verification */}
        {step === 'code' && (
          <>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Código de 6 dígitos</Text>
            <TextInput
              placeholder="123456"
              value={inputCode}
              onChangeText={setInputCode}
              keyboardType="number-pad"
              maxLength={6}
              style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, fontSize: 24, fontWeight: '900', marginBottom: 16, textAlign: 'center', letterSpacing: 8 }}
              placeholderTextColor={COLORS.gray2}
            />

            <TouchableOpacity
              onPress={verifyCode}
              style={{ backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Verificar código</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('phone')} style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#1E3A5F', fontWeight: '600' }}>Reenviar código</Text>
            </TouchableOpacity>
          </>
        )}

        {/* STEP 3: New password */}
        {step === 'reset' && (
          <>
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Nueva contraseña</Text>
            <View style={{ position: 'relative', marginBottom: 12 }}>
              <TextInput
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, paddingRight: 48, fontSize: 15, fontWeight: '600' }}
                placeholderTextColor={COLORS.gray2}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: 16 }}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.gray2} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Confirmar contraseña</Text>
            <TextInput
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: '600', marginBottom: 16 }}
              placeholderTextColor={COLORS.gray2}
            />

            <TouchableOpacity
              onPress={resetPassword}
              disabled={loading}
              style={{ backgroundColor: '#10B981', borderRadius: 14, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {loading ? 'Guardando...' : 'Cambiar contraseña'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Back link */}
        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 12, color: COLORS.gray, fontWeight: '600' }}>Volver al login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
