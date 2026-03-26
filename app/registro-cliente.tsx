import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, DISTRITOS } from '../src/lib/constants'
import { ENV } from '../src/lib/env'

export default function RegistroClienteScreen() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [distrito, setDistrito] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!nombre.trim()) return Alert.alert('Error', 'Ingresa tu nombre')
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un WhatsApp válido (9 dígitos, empieza con 9)')
    }
    if (!password || password.length < 6) return Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres')
    if (password !== confirmPassword) return Alert.alert('Error', 'Las contraseñas no coinciden')

    setLoading(true)
    try {
      const res = await fetch(`${ENV.API_BASE_URL}/register-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          whatsapp: waClean,
          distrito: distrito || undefined,
          password,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        Alert.alert('Error', result.error || 'No se pudo crear la cuenta.')
      } else {
        Alert.alert(
          '¡Cuenta creada!',
          'Ahora puedes iniciar sesión desde la pestaña Servicios.',
          [{ text: 'OK', onPress: () => router.back() }]
        )
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ padding: 20 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="person-add" size={28} color="#fff" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark }}>Crear cuenta</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 4 }}>Registra tu cuenta para solicitar servicios</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Text style={s.label}>Nombre completo *</Text>
          <TextInput placeholder="Tu nombre" value={nombre} onChangeText={setNombre} style={s.input} placeholderTextColor={COLORS.gray2} />

          <Text style={s.label}>WhatsApp *</Text>
          <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={s.input} placeholderTextColor={COLORS.gray2} />

          <Text style={s.label}>Distrito</Text>
          <TouchableOpacity onPress={() => setShowDistritos(!showDistritos)} style={s.input}>
            <Text style={{ color: distrito ? COLORS.dark : COLORS.gray2, fontSize: 14 }}>{distrito || 'Seleccionar distrito'}</Text>
          </TouchableOpacity>
          {showDistritos && (
            <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
              <ScrollView nestedScrollEnabled>
                {DISTRITOS.map((d) => (
                  <TouchableOpacity key={d} onPress={() => { setDistrito(d); setShowDistritos(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ fontSize: 13, color: COLORS.dark }}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={s.label}>Contraseña *</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={[s.input, { paddingRight: 48 }]}
              placeholderTextColor={COLORS.gray2}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: 14 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.gray2} />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Confirmar contraseña *</Text>
          <TextInput
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            style={s.input}
            placeholderTextColor={COLORS.gray2}
          />

          <TouchableOpacity
            onPress={submit}
            disabled={loading}
            style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const s = {
  label: { fontSize: 13, fontWeight: '700' as const, color: COLORS.dark, marginBottom: 6 },
  input: {
    backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 14,
    marginBottom: 16, color: COLORS.dark,
  },
}
