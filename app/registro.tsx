// Registro de técnico — V3.1 (SoluCoins prepagos, sin planes mensuales).
//
// Wizard de 3 pasos:
//   1. Datos personales (nombre, WhatsApp, email, DNI, password)
//   2. Servicio (oficios + distritos + experiencia + descripción)
//   3. Verificación DNI (frente + posterior)
//
// CAMBIO V3.1: eliminado el selector de plan (profesional/premium/elite).
// Todos los técnicos arrancan con 5,000 SoluCoins de bienvenida y pueden
// comprar paquetes después desde su perfil. Sin gates por plan en oficios
// ni zonas (el límite real lo da el saldo de SoluCoins, no un plan mensual).

import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { DISTRITOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { logger } from '../src/lib/logger'
import { ENV } from '../src/lib/env'
import { verifyDNI } from '../src/lib/integrations'
import { compressDNIPhoto } from '../src/lib/imageCompress'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

const OFICIOS = [
  'Gasfitero', 'Electricista', 'Pintor', 'Cerrajero', 'Técnico en refrigeración',
  'Albañil', 'Carpintero', 'Limpieza profesional', 'Fumigador', 'Instalador',
  'Técnico en electrodomésticos', 'Techador', 'Vidriero', 'Soldador',
  'Jardinero', 'Mudanzas', 'Técnico en seguridad', 'Técnico en redes',
]

// V3.1: tope generoso por defecto, sin gates por plan. Los técnicos pueden
// agregar hasta 5 oficios y 10 zonas en registro. Si necesitan más, lo
// editan luego desde Mi cuenta.
const MAX_OFICIOS = 5
const MAX_ZONAS = 10

export default function RegistroScreen() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  // Foco visual de inputs (borde brand 2px al enfocar)
  const [focused, setFocused] = useState<string | null>(null)

  // Step 1
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Step 2 (sin plan en V3.1)
  const [oficios, setOficios] = useState<string[]>([])
  const [distritos, setDistritos] = useState<string[]>([])
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [showOficios, setShowOficios] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)
  const [distritoSearch, setDistritoSearch] = useState('')

  // Step 3
  const [dniFront, setDniFront] = useState<string | null>(null)
  const [dniBack, setDniBack] = useState<string | null>(null)

  async function pickImage(setter: (uri: string) => void) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos del DNI')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (!result.canceled) {
      const compressed = await compressDNIPhoto(result.assets[0].uri)
      setter(compressed)
    }
  }

  async function uploadDni(uri: string, side: string) {
    try {
      const ext = uri.split('.').pop()
      const safeDni = dni.replace(/[^0-9]/g, '')
      const name = `dni/${Date.now()}_${side}_${safeDni}.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('fotos').upload(name, blob)
      return error ? null : name
    } catch (err) {
      logger.error('Upload error:', err)
      return null
    }
  }

  function validateStep1() {
    if (!nombre.trim()) { Alert.alert('Error', 'Ingresa tu nombre completo'); return false }
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      Alert.alert('Error', 'Ingresa un número de WhatsApp válido (9 dígitos, empieza con 9)')
      return false
    }
    if (dni.length !== 8 || !/^\d{8}$/.test(dni)) {
      Alert.alert('Error', 'El DNI debe tener exactamente 8 dígitos')
      return false
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Error', 'Ingresa un email válido')
      return false
    }
    if (password && password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres')
      return false
    }
    if (password && password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden')
      return false
    }
    return true
  }

  async function submit() {
    if (!nombre || !whatsapp || !dni || oficios.length === 0 || distritos.length === 0) {
      return Alert.alert('Error', 'Completa todos los campos obligatorios')
    }
    if (!validateStep1()) return
    setLoading(true)

    try {
      const reniec = await verifyDNI(dni, nombre)
      if (!reniec.valid) {
        setLoading(false)
        return Alert.alert(
          'DNI no verificado',
          reniec.error || 'No pudimos verificar tu DNI en RENIEC. Revisa que esté bien escrito.',
        )
      }
      if (reniec.nameMatches === false) {
        setLoading(false)
        return Alert.alert(
          'Nombre no coincide',
          `Según RENIEC tu nombre es "${reniec.nombre}". El nombre que ingresaste no coincide. Corrige tu nombre y vuelve a intentar.`,
        )
      }

      let dniFrenteUrl = null
      let dniPosteriorUrl = null

      if (dniFront) dniFrenteUrl = await uploadDni(dniFront, 'frente')
      if (dniBack) dniPosteriorUrl = await uploadDni(dniBack, 'posterior')

      // V3.1: no enviamos `plan` al backend (eliminado). El backend acredita
      // los 5,000 SoluCoins de bienvenida automáticamente al crear el técnico.
      const res = await fetch(`${ENV.API_BASE_URL}/register-tech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          whatsapp: whatsapp.replace(/\D/g, ''),
          email: email || undefined,
          dni,
          password: password || undefined,
          oficio: oficios[0],
          oficios,
          distrito: distritos[0],
          zonas: distritos,
          precio_desde: precio ? parseInt(precio) : undefined,
          experiencia: experiencia || undefined,
          descripcion: descripcion || undefined,
          dni_frente_url: dniFrenteUrl,
          dni_posterior_url: dniPosteriorUrl,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        Alert.alert('Error', result.error || 'No se pudo completar el registro.')
      } else {
        haptics.success()
        Alert.alert(
          '¡Bienvenido a SOLU! 🎉',
          'Tu cuenta está creada. Recibes 5,000 SoluCoins gratis para tus primeros leads. Inicia sesión desde Mi cuenta.',
          [{ text: 'Empezar', onPress: () => router.back() }]
        )
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const STEP_TITLES = ['Datos personales', 'Tu servicio', 'Verificación']

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      contentContainerStyle={{ paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ padding: THEME.space.xl }}>
        {/* Progress */}
        <FadeInUp delay={0}>
          <View style={{ marginBottom: THEME.space.xl }}>
            <View style={{ flexDirection: 'row', gap: THEME.space.sm }}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={{
                    flex: 1, height: 5, borderRadius: THEME.radius.full,
                    backgroundColor: s <= step ? THEME.color.brand : THEME.color.line,
                  }}
                />
              ))}
            </View>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.sm }}>
              Paso {step} de 3 · {STEP_TITLES[step - 1]}
            </Text>
          </View>
        </FadeInUp>

        {step === 1 && (
          <>
            <FadeInUp delay={60}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.ink, marginBottom: THEME.space.xs }}>Datos personales</Text>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginBottom: THEME.space.lg }}>
                Los campos con * son obligatorios
              </Text>
              {/* Banner bienvenida — anuncia los 5,000 SoluCoins gratis antes de empezar */}
              <View
                style={{
                  flexDirection: 'row', gap: THEME.space.md, alignItems: 'center',
                  backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg,
                  padding: THEME.space.lg, marginBottom: THEME.space.xl,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>🎁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.brandDark }}>5,000 SoluCoins gratis</Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 2 }}>
                    Te llegan al crear tu cuenta. Alcanzan para tus primeros leads.
                  </Text>
                </View>
              </View>
            </FadeInUp>

            <FadeInUp delay={120}>
              <View style={styles.card}>
                <Text style={styles.label}>Nombre completo *</Text>
                <View style={styles.inputWrap(focused === 'nombre')}>
                  <Ionicons name="person-outline" size={18} color={focused === 'nombre' ? THEME.color.brand : THEME.color.inkMuted} />
                  <TextInput placeholder="Juan Pérez López" value={nombre} onChangeText={setNombre} onFocus={() => setFocused('nombre')} onBlur={() => setFocused(null)} style={styles.inputField} placeholderTextColor={THEME.color.inkMuted} />
                </View>

                <Text style={styles.label}>WhatsApp *</Text>
                <View style={styles.inputWrap(focused === 'whatsapp')}>
                  <Ionicons name="logo-whatsapp" size={18} color={focused === 'whatsapp' ? THEME.color.brand : THEME.color.inkMuted} />
                  <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" onFocus={() => setFocused('whatsapp')} onBlur={() => setFocused(null)} style={styles.inputField} placeholderTextColor={THEME.color.inkMuted} />
                </View>

                <Text style={styles.label}>Email (opcional)</Text>
                <View style={styles.inputWrap(focused === 'email')}>
                  <Ionicons name="mail-outline" size={18} color={focused === 'email' ? THEME.color.brand : THEME.color.inkMuted} />
                  <TextInput placeholder="correo@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} style={styles.inputField} placeholderTextColor={THEME.color.inkMuted} />
                </View>

                <Text style={styles.label}>Contraseña (opcional)</Text>
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

                <Text style={styles.label}>Confirmar contraseña</Text>
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

                <Text style={styles.label}>DNI *</Text>
                <View style={styles.inputWrap(focused === 'dni')}>
                  <Ionicons name="card-outline" size={18} color={focused === 'dni' ? THEME.color.brand : THEME.color.inkMuted} />
                  <TextInput placeholder="12345678" value={dni} onChangeText={setDni} keyboardType="number-pad" maxLength={8} onFocus={() => setFocused('dni')} onBlur={() => setFocused(null)} style={styles.inputField} placeholderTextColor={THEME.color.inkMuted} />
                </View>
              </View>
            </FadeInUp>

            <FadeInUp delay={180}>
              <PressableScale
                onPress={() => { if (validateStep1()) setStep(2) }}
                accessibilityLabel="Continuar al paso 2"
                style={[styles.primaryBtn, { marginTop: THEME.space.xl }]}
              >
                <Text style={styles.primaryBtnText}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </PressableScale>
            </FadeInUp>
          </>
        )}

        {step === 2 && (
          <>
            <FadeInUp delay={60}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.ink, marginBottom: THEME.space.xs }}>Tu servicio</Text>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginBottom: THEME.space.lg }}>
                Configura qué ofreces y dónde
              </Text>
            </FadeInUp>

            <FadeInUp delay={120}>
              <View style={styles.card}>
                {/* Oficios — sin gate por plan, tope generoso */}
                <Text style={styles.label}>Oficios * {oficios.length > 0 ? `(${oficios.length}/${MAX_OFICIOS})` : ''}</Text>
                {oficios.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm, marginBottom: THEME.space.sm }}>
                    {oficios.map((o, idx) => (
                      <TouchableOpacity
                        key={o}
                        onPress={() => setOficios(oficios.filter((_, i) => i !== idx))}
                        style={[styles.chip, { backgroundColor: idx === 0 ? THEME.color.brand : THEME.color.brandLight }]}
                        accessibilityLabel={`Quitar oficio ${o}`}
                      >
                        <Text style={{ ...THEME.font.label, color: idx === 0 ? '#fff' : THEME.color.brandDark }}>{o}</Text>
                        <Ionicons name="close-circle" size={15} color={idx === 0 ? 'rgba(255,255,255,0.8)' : THEME.color.brand} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity onPress={() => setShowOficios(!showOficios)} activeOpacity={0.8} style={styles.inputWrap(showOficios)}>
                  <Ionicons name="construct-outline" size={18} color={showOficios ? THEME.color.brand : THEME.color.inkMuted} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: THEME.color.inkMuted }}>{oficios.length === 0 ? 'Seleccionar oficio' : 'Agregar otro oficio'}</Text>
                  <Ionicons name={showOficios ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.color.inkMuted} />
                </TouchableOpacity>
                {showOficios && (
                  <View style={styles.dropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                      {OFICIOS.filter(o => !oficios.includes(o)).map((o) => (
                        <TouchableOpacity key={o} onPress={() => {
                          if (oficios.length >= MAX_OFICIOS) {
                            Alert.alert('Tope alcanzado', `Por ahora puedes registrar hasta ${MAX_OFICIOS} oficios. Si tienes más experiencia puedes agregar otros desde Mi cuenta.`)
                            return
                          }
                          setOficios([...oficios, o])
                          setShowOficios(false)
                        }} style={styles.dropdownItem}>
                          <Ionicons name="construct-outline" size={15} color={THEME.color.inkMuted} />
                          <Text style={{ ...THEME.font.bodySm, color: THEME.color.ink }}>{o}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.label}>Zonas de cobertura * {distritos.length > 0 ? `(${distritos.length}/${MAX_ZONAS})` : ''}</Text>
                {distritos.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm, marginBottom: THEME.space.sm }}>
                    {distritos.map((d, idx) => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setDistritos(distritos.filter((_, i) => i !== idx))}
                        style={[styles.chip, { backgroundColor: idx === 0 ? THEME.color.brand : THEME.color.brandLight }]}
                        accessibilityLabel={`Quitar zona ${d}`}
                      >
                        <Text style={{ ...THEME.font.label, color: idx === 0 ? '#fff' : THEME.color.brandDark }}>{d}</Text>
                        <Ionicons name="close-circle" size={15} color={idx === 0 ? 'rgba(255,255,255,0.8)' : THEME.color.brand} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity onPress={() => setShowDistritos(!showDistritos)} activeOpacity={0.8} style={styles.inputWrap(showDistritos)}>
                  <Ionicons name="location-outline" size={18} color={showDistritos ? THEME.color.brand : THEME.color.inkMuted} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: THEME.color.inkMuted }}>{distritos.length === 0 ? 'Seleccionar distrito' : 'Agregar otro distrito'}</Text>
                  <Ionicons name={showDistritos ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.color.inkMuted} />
                </TouchableOpacity>
                {showDistritos && (
                  <View style={styles.dropdown}>
                    <TextInput
                      placeholder="Escribe para buscar distrito…"
                      placeholderTextColor={THEME.color.inkMuted}
                      value={distritoSearch}
                      onChangeText={setDistritoSearch}
                      style={{
                        paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md,
                        fontSize: 14, fontWeight: '500', color: THEME.color.ink,
                        borderBottomWidth: 1, borderBottomColor: THEME.color.line,
                      }}
                      autoFocus
                    />
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                      {DISTRITOS.filter(d => !distritos.includes(d) && (!distritoSearch || d.toLowerCase().includes(distritoSearch.toLowerCase()))).map((d) => (
                        <TouchableOpacity key={d} onPress={() => {
                          if (distritos.length >= MAX_ZONAS) {
                            Alert.alert('Tope alcanzado', `Hasta ${MAX_ZONAS} distritos en registro. Puedes ajustarlos luego desde Mi cuenta.`)
                            return
                          }
                          setDistritos([...distritos, d])
                          setDistritoSearch('')
                          setShowDistritos(false)
                        }} style={styles.dropdownItem}>
                          <Ionicons name="location-outline" size={15} color={THEME.color.inkMuted} />
                          <Text style={{ ...THEME.font.bodySm, color: THEME.color.ink }}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                      {distritoSearch.trim() && !DISTRITOS.some(d => d.toLowerCase() === distritoSearch.toLowerCase()) && (
                        <TouchableOpacity onPress={() => {
                          if (distritos.length >= MAX_ZONAS) {
                            Alert.alert('Tope alcanzado', `Hasta ${MAX_ZONAS} distritos en registro.`)
                            return
                          }
                          setDistritos([...distritos, distritoSearch.trim()])
                          setDistritoSearch('')
                          setShowDistritos(false)
                        }} style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, backgroundColor: THEME.color.brandLight }}>
                          <Ionicons name="add-circle" size={16} color={THEME.color.brand} />
                          <Text style={{ ...THEME.font.bodySm, color: THEME.color.brand, fontWeight: '700' }}>Agregar &quot;{distritoSearch.trim()}&quot;</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.label}>Precio desde (S/) — opcional</Text>
                <View style={styles.inputWrap(focused === 'precio')}>
                  <Ionicons name="cash-outline" size={18} color={focused === 'precio' ? THEME.color.brand : THEME.color.inkMuted} />
                  <TextInput placeholder="Ej: 50" value={precio} onChangeText={setPrecio} keyboardType="number-pad" onFocus={() => setFocused('precio')} onBlur={() => setFocused(null)} style={styles.inputField} placeholderTextColor={THEME.color.inkMuted} />
                </View>

                <Text style={styles.label}>Experiencia (opcional)</Text>
                <View style={styles.inputWrap(focused === 'experiencia')}>
                  <Ionicons name="ribbon-outline" size={18} color={focused === 'experiencia' ? THEME.color.brand : THEME.color.inkMuted} />
                  <TextInput placeholder="Ej: 5 años" value={experiencia} onChangeText={setExperiencia} onFocus={() => setFocused('experiencia')} onBlur={() => setFocused(null)} style={styles.inputField} placeholderTextColor={THEME.color.inkMuted} />
                </View>

                <Text style={styles.label}>Descripción (opcional)</Text>
                <View style={[styles.inputWrap(focused === 'descripcion'), { alignItems: 'flex-start', minHeight: 96, paddingTop: THEME.space.md }]}>
                  <TextInput placeholder="Describe tus servicios…" value={descripcion} onChangeText={setDescripcion} multiline numberOfLines={3} onFocus={() => setFocused('descripcion')} onBlur={() => setFocused(null)} style={[styles.inputField, { height: 72, textAlignVertical: 'top', paddingVertical: 0 }]} placeholderTextColor={THEME.color.inkMuted} />
                </View>
              </View>
            </FadeInUp>

            <FadeInUp delay={180}>
              <View style={{ flexDirection: 'row', gap: THEME.space.md, marginTop: THEME.space.xl }}>
                <PressableScale onPress={() => setStep(1)} accessibilityLabel="Volver al paso 1" style={styles.secondaryBtn}>
                  <Ionicons name="arrow-back" size={18} color={THEME.color.inkSoft} />
                  <Text style={styles.secondaryBtnText}>Atrás</Text>
                </PressableScale>
                <PressableScale onPress={() => {
                  if (oficios.length === 0) return Alert.alert('Error', 'Selecciona al menos un oficio')
                  if (distritos.length === 0) return Alert.alert('Error', 'Selecciona al menos un distrito')
                  setStep(3)
                }} accessibilityLabel="Continuar al paso 3" style={[styles.primaryBtn, { flex: 1 }]}>
                  <Text style={styles.primaryBtnText}>Siguiente</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </PressableScale>
              </View>
            </FadeInUp>
          </>
        )}

        {step === 3 && (
          <>
            <FadeInUp delay={60}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.ink, marginBottom: THEME.space.xs }}>Verificación</Text>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginBottom: THEME.space.lg }}>
                Sube fotos de tu DNI para validar tu identidad
              </Text>

              {/* Nota de confianza: por qué pedimos el DNI */}
              <View
                style={{
                  flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start',
                  backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg,
                  padding: THEME.space.lg, marginBottom: THEME.space.xl,
                }}
              >
                <Ionicons name="lock-closed" size={18} color={THEME.color.success} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#065F46', lineHeight: 19 }}>
                  Tus fotos solo se usan para verificar tu identidad y darte el badge ✅ Verificado. Los clientes nunca las ven.
                </Text>
              </View>
            </FadeInUp>

            <FadeInUp delay={120}>
              <PressableScale onPress={() => pickImage(setDniFront)} accessibilityLabel={dniFront ? 'Foto del DNI frente subida. Toca para cambiarla' : 'Subir foto del frente de tu DNI'} style={[styles.photoBox, dniFront ? styles.photoBoxDone : null]}>
                {dniFront ? (
                  <View style={{ alignItems: 'center' }}>
                    <View style={styles.photoCheck}>
                      <Ionicons name="checkmark-circle" size={34} color={THEME.color.success} />
                    </View>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.success, marginTop: THEME.space.sm }}>DNI Frente listo</Text>
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>Toca para cambiar</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <View style={styles.photoIcon}>
                      <Ionicons name="camera-outline" size={28} color={THEME.color.brand} />
                    </View>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: THEME.space.sm }}>DNI Frente</Text>
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Toca para subir</Text>
                  </View>
                )}
              </PressableScale>
            </FadeInUp>

            <FadeInUp delay={180}>
              <PressableScale onPress={() => pickImage(setDniBack)} accessibilityLabel={dniBack ? 'Foto del DNI posterior subida. Toca para cambiarla' : 'Subir foto de la parte posterior de tu DNI'} style={[styles.photoBox, dniBack ? styles.photoBoxDone : null]}>
                {dniBack ? (
                  <View style={{ alignItems: 'center' }}>
                    <View style={styles.photoCheck}>
                      <Ionicons name="checkmark-circle" size={34} color={THEME.color.success} />
                    </View>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.success, marginTop: THEME.space.sm }}>DNI Posterior listo</Text>
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>Toca para cambiar</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <View style={styles.photoIcon}>
                      <Ionicons name="camera-outline" size={28} color={THEME.color.brand} />
                    </View>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: THEME.space.sm }}>DNI Posterior</Text>
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Toca para subir</Text>
                  </View>
                )}
              </PressableScale>
            </FadeInUp>

            <FadeInUp delay={240}>
              <View style={{ flexDirection: 'row', gap: THEME.space.md, marginTop: THEME.space.sm }}>
                <PressableScale onPress={() => setStep(2)} accessibilityLabel="Volver al paso 2" style={styles.secondaryBtn}>
                  <Ionicons name="arrow-back" size={18} color={THEME.color.inkSoft} />
                  <Text style={styles.secondaryBtnText}>Atrás</Text>
                </PressableScale>
                <PressableScale onPress={submit} disabled={loading} accessibilityLabel="Crear mi cuenta" style={[styles.primaryBtn, { flex: 1 }]}>
                  <Text style={styles.primaryBtnText}>{loading ? 'Creando tu cuenta…' : 'Crear mi cuenta'}</Text>
                  {!loading && <Ionicons name="checkmark" size={18} color="#fff" />}
                </PressableScale>
              </View>
            </FadeInUp>
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = {
  card: {
    backgroundColor: THEME.color.surface,
    borderRadius: THEME.radius.xl,
    padding: THEME.space.xl,
    ...THEME.shadow.md,
  },
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
    minHeight: 54,
    marginBottom: THEME.space.lg,
  }),
  inputField: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: THEME.color.ink,
    paddingVertical: THEME.space.md,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: THEME.space.xs,
    borderRadius: THEME.radius.full,
    paddingHorizontal: THEME.space.md,
    paddingVertical: 7,
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
  photoBox: {
    backgroundColor: THEME.color.surface,
    borderRadius: THEME.radius.xl,
    paddingVertical: THEME.space.xxxl,
    paddingHorizontal: THEME.space.lg,
    marginBottom: THEME.space.md,
    borderWidth: 2,
    borderColor: THEME.color.line,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoBoxDone: {
    borderStyle: 'solid' as const,
    borderColor: THEME.color.success,
    backgroundColor: THEME.color.successBg,
  },
  photoIcon: {
    width: 56, height: 56, borderRadius: THEME.radius.lg,
    backgroundColor: THEME.color.brandLight,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  photoCheck: {
    width: 56, height: 56, borderRadius: THEME.radius.lg,
    backgroundColor: '#fff',
    alignItems: 'center' as const, justifyContent: 'center' as const,
    ...THEME.shadow.sm,
  },
  primaryBtn: {
    flexDirection: 'row' as const,
    gap: THEME.space.sm,
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
  secondaryBtn: {
    flexDirection: 'row' as const,
    gap: THEME.space.xs,
    backgroundColor: THEME.color.surface,
    borderRadius: THEME.radius.lg,
    height: 52,
    paddingHorizontal: THEME.space.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: THEME.color.line,
  },
  secondaryBtnText: {
    color: THEME.color.inkSoft,
    fontSize: 15,
    fontWeight: '700' as const,
  },
}
