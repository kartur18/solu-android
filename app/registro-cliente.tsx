import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DISTRITOS } from '../src/lib/constants'
import { ENV } from '../src/lib/env'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

export default function RegistroClienteScreen() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [distrito, setDistrito] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)
  const [distritoFilter, setDistritoFilter] = useState('')
  const [loading, setLoading] = useState(false)
  // Foco visual de inputs (borde brand 2px al enfocar)
  const [focused, setFocused] = useState<string | null>(null)

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
        haptics.success()
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
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ padding: THEME.space.xl }}>
        <FadeInUp delay={0}>
          <View style={{ alignItems: 'center', marginBottom: THEME.space.xxl }}>
            <View
              style={{
                width: 64, height: 64, borderRadius: THEME.radius.xl,
                backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center',
                marginBottom: THEME.space.md, ...THEME.shadow.brand,
              }}
            >
              <Ionicons name="person-add" size={28} color="#fff" />
            </View>
            <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>Crear cuenta</Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs, textAlign: 'center' }}>
              Regístrate para solicitar servicios en minutos
            </Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={80}>
          <View
            style={{
              backgroundColor: THEME.color.surface,
              borderRadius: THEME.radius.xl,
              padding: THEME.space.xl,
              ...THEME.shadow.md,
            }}
          >
            <Text style={styles.label}>Nombre completo *</Text>
            <View style={styles.inputWrap(focused === 'nombre')}>
              <Ionicons name="person-outline" size={18} color={focused === 'nombre' ? THEME.color.brand : THEME.color.inkMuted} />
              <TextInput
                placeholder="Tu nombre"
                value={nombre}
                onChangeText={setNombre}
                onFocus={() => setFocused('nombre')}
                onBlur={() => setFocused(null)}
                style={styles.inputField}
                placeholderTextColor={THEME.color.inkMuted}
              />
            </View>

            <Text style={styles.label}>WhatsApp *</Text>
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

            <Text style={styles.label}>Distrito</Text>
            <TouchableOpacity
              onPress={() => setShowDistritos(!showDistritos)}
              activeOpacity={0.8}
              style={styles.inputWrap(showDistritos)}
            >
              <Ionicons name="location-outline" size={18} color={showDistritos ? THEME.color.brand : THEME.color.inkMuted} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: distrito ? THEME.color.ink : THEME.color.inkMuted }}>
                {distrito || 'Seleccionar distrito'}
              </Text>
              <Ionicons name={showDistritos ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.color.inkMuted} />
            </TouchableOpacity>
            {showDistritos && (
              <View style={styles.dropdown}>
                <TextInput
                  placeholder="Escribe para buscar distrito…"
                  placeholderTextColor={THEME.color.inkMuted}
                  value={distritoFilter}
                  onChangeText={setDistritoFilter}
                  style={{
                    paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md,
                    fontSize: 14, fontWeight: '500', color: THEME.color.ink,
                    borderBottomWidth: 1, borderBottomColor: THEME.color.line,
                  }}
                  autoFocus
                />
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                  {DISTRITOS.filter(d => !distritoFilter || d.toLowerCase().includes(distritoFilter.toLowerCase())).map((d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => { setDistrito(d); setDistritoFilter(''); setShowDistritos(false) }}
                      style={styles.dropdownItem}
                    >
                      <Ionicons name="location-outline" size={15} color={THEME.color.inkMuted} />
                      <Text style={{ ...THEME.font.bodySm, color: THEME.color.ink }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                  {distritoFilter.trim() && !DISTRITOS.some(d => d.toLowerCase() === distritoFilter.toLowerCase()) && (
                    <TouchableOpacity
                      onPress={() => { setDistrito(distritoFilter.trim()); setDistritoFilter(''); setShowDistritos(false) }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, backgroundColor: THEME.color.brandLight }}
                    >
                      <Ionicons name="add-circle" size={16} color={THEME.color.brand} />
                      <Text style={{ ...THEME.font.bodySm, color: THEME.color.brand, fontWeight: '700' }}>Agregar &quot;{distritoFilter.trim()}&quot;</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Contraseña *</Text>
            <View style={styles.inputWrap(focused === 'pass')}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === 'pass' ? THEME.color.brand : THEME.color.inkMuted} />
              <TextInput
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChangeText={setPassword}
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

            <Text style={styles.label}>Confirmar contraseña *</Text>
            <View style={styles.inputWrap(focused === 'confirm')}>
              <Ionicons name="lock-closed-outline" size={18} color={focused === 'confirm' ? THEME.color.brand : THEME.color.inkMuted} />
              <TextInput
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                style={styles.inputField}
                placeholderTextColor={THEME.color.inkMuted}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={THEME.color.inkMuted} />
              </TouchableOpacity>
            </View>

            <PressableScale
              onPress={submit}
              disabled={loading}
              accessibilityLabel="Crear mi cuenta"
              style={[styles.primaryBtn, { marginTop: THEME.space.sm }]}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Creando cuenta…' : 'Crear mi cuenta'}
              </Text>
            </PressableScale>
          </View>
        </FadeInUp>
      </View>
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
  dropdown: {
    backgroundColor: THEME.color.surface,
    borderRadius: THEME.radius.lg,
    marginTop: -THEME.space.sm,
    marginBottom: THEME.space.md,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: THEME.color.line,
    overflow: 'hidden' as const,
    ...THEME.shadow.sm,
  },
  dropdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: THEME.space.sm,
    paddingHorizontal: THEME.space.lg,
    paddingVertical: THEME.space.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.color.lineSoft,
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
