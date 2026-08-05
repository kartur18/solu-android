import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { DISTRITOS } from '../src/lib/constants'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { validarPassword, PASSWORD_MIN_LENGTH } from '../src/lib/password-policy'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'
import type { ClienteUser } from '../src/lib/types'

// Misma clave que leen la pantalla de servicios y useClientProfile.
const SESSION_KEY = 'solu_client_session'

// La sesión guardada tiene la forma que devuelve login-client: sin el hash.
type SesionCliente = Omit<ClienteUser, 'password_hash'>

type RespuestaRegistro = {
  id?: number
  error?: string
  tambien_es_tecnico?: boolean
}

// El requisito tiene que estar a la vista mientras escribe: si la contraseña
// llega mal al servidor son 5 intentos y el registro queda bloqueado 10 min.
function ReglasPassword({ password }: { password: string }) {
  const reglas = [
    { ok: password.length >= PASSWORD_MIN_LENGTH, texto: `${PASSWORD_MIN_LENGTH} caracteres` },
    { ok: /[a-zA-Z]/.test(password), texto: 'Una letra' },
    { ok: /\d/.test(password), texto: 'Un número' },
  ]
  return (
    <View style={styles.reglas}>
      {reglas.map((regla) => (
        <View key={regla.texto} style={styles.regla}>
          <Ionicons
            name={regla.ok ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={regla.ok ? THEME.color.success : THEME.color.inkMuted}
          />
          <Text style={{ ...THEME.font.caption, color: regla.ok ? THEME.color.success : THEME.color.inkMuted }}>
            {regla.texto}
          </Text>
        </View>
      ))}
    </View>
  )
}

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

  // register-client deja la cuenta lista y devuelve el id, así que guardamos
  // la sesión igual que login-client: la persona no tiene que volver a tipear
  // la contraseña que acaba de crear (la web hace lo mismo con su cookie).
  async function guardarSesion(id: number | undefined, waClean: string): Promise<boolean> {
    if (typeof id !== 'number') return false
    try {
      const sesion: SesionCliente = {
        id,
        nombre: nombre.trim(),
        whatsapp: waClean,
        // El endpoint no devuelve created_at y la cuenta nace en este instante.
        created_at: new Date().toISOString(),
        ...(distrito ? { distrito } : {}),
      }
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sesion))
      return true
    } catch {
      return false
    }
  }

  async function submit() {
    if (!nombre.trim()) return Alert.alert('Error', 'Ingresa tu nombre')
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un WhatsApp válido (9 dígitos, empieza con 9)')
    }
    // Misma política que registerClientSchema en el servidor: aceptar acá algo
    // que allá se rechaza gasta intentos del rate limit de registro.
    const errorPassword = validarPassword(password)
    if (errorPassword) return Alert.alert('Error', errorPassword)
    if (password !== confirmPassword) return Alert.alert('Error', 'Las contraseñas no coinciden')

    setLoading(true)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/register-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          whatsapp: waClean,
          distrito: distrito || undefined,
          password,
        }),
      })
      const result = (await res.json().catch(() => ({}))) as RespuestaRegistro

      if (!res.ok) {
        Alert.alert('Error', result.error || 'No se pudo crear la cuenta.')
        return
      }

      haptics.success()
      if (!(await guardarSesion(result.id, waClean))) {
        // Sin sesión local no podemos entrar solos, pero la cuenta ya existe.
        Alert.alert(
          '¡Cuenta creada!',
          'Entra con tu WhatsApp y la contraseña que acabas de crear.',
          [{ text: 'OK', onPress: () => router.back() }],
        )
        return
      }

      const aviso = result.tambien_es_tecnico
        ? '\n\nCon este número ya tenías perfil de especialista: son cuentas distintas y puedes moverte entre las dos.'
        : ''
      Alert.alert(
        `¡Listo, ${nombre.trim().split(' ')[0]}!`,
        `Tu cuenta está creada y ya iniciaste sesión.${aviso}`,
        [{ text: 'Pedir un servicio', onPress: () => router.replace('/solicitar') }],
      )
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
                placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
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
            {password.length === 0 ? (
              <Text style={styles.hint}>
                Mínimo {PASSWORD_MIN_LENGTH} caracteres, con al menos una letra y un número.
              </Text>
            ) : (
              <ReglasPassword password={password} />
            )}

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
  // Requisito de contraseña: se mete bajo el input, dentro de su margen.
  hint: {
    ...THEME.font.caption,
    color: THEME.color.inkSoft,
    marginTop: -THEME.space.md,
    marginBottom: THEME.space.lg,
  },
  reglas: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: THEME.space.md,
    marginTop: -THEME.space.md,
    marginBottom: THEME.space.lg,
  },
  regla: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
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
