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
import { COLORS, DISTRITOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { logger } from '../src/lib/logger'
import { ENV } from '../src/lib/env'
import { verifyDNI } from '../src/lib/integrations'
import { compressDNIPhoto } from '../src/lib/imageCompress'

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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }} keyboardShouldPersistTaps="handled">
      <View style={{ padding: 20 }}>
        {/* Progress */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? COLORS.pri : COLORS.border }} />
          ))}
        </View>

        {step === 1 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Datos personales</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 4 }}>Paso 1 de 3 · Los campos con * son obligatorios</Text>
            {/* Banner bienvenida — anuncia los 5,000 SoluCoins gratis antes de empezar */}
            <View style={{
              backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, marginBottom: 18,
              borderLeftWidth: 4, borderLeftColor: COLORS.pri, flexDirection: 'row', gap: 10,
            }}>
              <Text style={{ fontSize: 22 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>5,000 SoluCoins gratis</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>
                  Te llegan al crear tu cuenta. Alcanzan para tus primeros leads.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput placeholder="Juan Pérez López" value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>WhatsApp *</Text>
            <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Email (opcional)</Text>
            <TextInput placeholder="correo@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Contraseña (opcional)</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={[styles.input, { paddingRight: 48 }]}
                placeholderTextColor={COLORS.gray2}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 14, top: 14 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.gray2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirmar contraseña</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                style={[styles.input, { paddingRight: 48 }]}
                placeholderTextColor={COLORS.gray2}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: 14, top: 14 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.gray2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>DNI *</Text>
            <TextInput placeholder="12345678" value={dni} onChangeText={setDni} keyboardType="number-pad" maxLength={8} style={styles.input} placeholderTextColor={COLORS.gray2} />

            <TouchableOpacity onPress={() => { if (validateStep1()) setStep(2) }} style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>Siguiente →</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Tu servicio</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Paso 2 de 3 — Configura qué ofreces y dónde</Text>

            {/* Oficios — sin gate por plan, tope generoso */}
            <Text style={styles.label}>Oficios * {oficios.length > 0 ? `(${oficios.length}/${MAX_OFICIOS})` : ''}</Text>
            {oficios.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {oficios.map((o, idx) => (
                  <TouchableOpacity
                    key={o}
                    onPress={() => setOficios(oficios.filter((_, i) => i !== idx))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: idx === 0 ? '#1E3A5F' : '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: idx === 0 ? '#fff' : '#1E3A5F' }}>{o}</Text>
                    <Ionicons name="close-circle" size={14} color={idx === 0 ? 'rgba(255,255,255,0.7)' : '#1E3A5F'} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={() => setShowOficios(!showOficios)} style={styles.input}>
              <Text style={{ color: COLORS.gray2 }}>{oficios.length === 0 ? 'Seleccionar oficio' : 'Agregar otro oficio'}</Text>
            </TouchableOpacity>
            {showOficios && (
              <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
                <ScrollView nestedScrollEnabled>
                  {OFICIOS.filter(o => !oficios.includes(o)).map((o) => (
                    <TouchableOpacity key={o} onPress={() => {
                      if (oficios.length >= MAX_OFICIOS) {
                        Alert.alert('Tope alcanzado', `Por ahora puedes registrar hasta ${MAX_OFICIOS} oficios. Si tienes más experiencia puedes agregar otros desde Mi cuenta.`)
                        return
                      }
                      setOficios([...oficios, o])
                      setShowOficios(false)
                    }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                      <Text style={{ fontSize: 13, color: COLORS.dark }}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Zonas de cobertura * {distritos.length > 0 ? `(${distritos.length}/${MAX_ZONAS})` : ''}</Text>
            {distritos.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {distritos.map((d, idx) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDistritos(distritos.filter((_, i) => i !== idx))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: idx === 0 ? '#1E3A5F' : '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: idx === 0 ? '#fff' : '#1E3A5F' }}>{d}</Text>
                    <Ionicons name="close-circle" size={14} color={idx === 0 ? 'rgba(255,255,255,0.7)' : '#1E3A5F'} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={() => setShowDistritos(!showDistritos)} style={styles.input}>
              <Text style={{ color: COLORS.gray2 }}>{distritos.length === 0 ? 'Seleccionar distrito' : 'Agregar otro distrito'}</Text>
            </TouchableOpacity>
            {showDistritos && (
              <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 280, borderWidth: 1, borderColor: COLORS.border }}>
                <TextInput
                  placeholder="Escribe para buscar distrito..."
                  placeholderTextColor={COLORS.gray2}
                  value={distritoSearch}
                  onChangeText={setDistritoSearch}
                  style={{ padding: 12, fontSize: 14, color: COLORS.dark, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  autoFocus
                />
                <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                  {DISTRITOS.filter(d => !distritos.includes(d) && (!distritoSearch || d.toLowerCase().includes(distritoSearch.toLowerCase()))).map((d) => (
                    <TouchableOpacity key={d} onPress={() => {
                      if (distritos.length >= MAX_ZONAS) {
                        Alert.alert('Tope alcanzado', `Hasta ${MAX_ZONAS} distritos en registro. Puedes ajustarlos luego desde Mi cuenta.`)
                        return
                      }
                      setDistritos([...distritos, d])
                      setDistritoSearch('')
                      setShowDistritos(false)
                    }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                      <Text style={{ fontSize: 13, color: COLORS.dark }}>{d}</Text>
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
                    }} style={{ padding: 12, backgroundColor: '#EFF6FF' }}>
                      <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: '700' }}>+ Agregar &quot;{distritoSearch.trim()}&quot;</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Precio desde (S/) — opcional</Text>
            <TextInput placeholder="Ej: 50" value={precio} onChangeText={setPrecio} keyboardType="number-pad" style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Experiencia (opcional)</Text>
            <TextInput placeholder="Ej: 5 años" value={experiencia} onChangeText={setExperiencia} style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput placeholder="Describe tus servicios..." value={descripcion} onChangeText={setDescripcion} multiline numberOfLines={3} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholderTextColor={COLORS.gray2} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setStep(1)} style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ color: COLORS.gray, fontWeight: '700', fontSize: 14 }}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                if (oficios.length === 0) return Alert.alert('Error', 'Selecciona al menos un oficio')
                if (distritos.length === 0) return Alert.alert('Error', 'Selecciona al menos un distrito')
                setStep(3)
              }} style={{ flex: 1, backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center' }}>
                <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>Siguiente →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Verificación</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 16 }}>Paso 3 de 3 — Sube fotos de tu DNI</Text>

            {/* Nota de confianza: por qué pedimos el DNI */}
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', gap: 10 }}>
              <Ionicons name="lock-closed" size={18} color="#10B981" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: '#065F46', lineHeight: 17 }}>
                Tus fotos solo se usan para verificar tu identidad y darte el badge ✅ Verificado. Los clientes nunca las ven.
              </Text>
            </View>

            <TouchableOpacity onPress={() => pickImage(setDniFront)} style={styles.photoBox} accessibilityLabel={dniFront ? 'Foto del DNI frente subida. Toca para cambiarla' : 'Subir foto del frente de tu DNI'}>
              {dniFront ? (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={32} color={COLORS.acc} />
                  <Text style={{ color: COLORS.acc, fontWeight: '700', marginTop: 4 }}>DNI Frente ✓</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.gray2} />
                  <Text style={{ color: COLORS.gray, fontWeight: '600', marginTop: 4 }}>DNI Frente</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => pickImage(setDniBack)} style={styles.photoBox} accessibilityLabel={dniBack ? 'Foto del DNI posterior subida. Toca para cambiarla' : 'Subir foto de la parte posterior de tu DNI'}>
              {dniBack ? (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={32} color={COLORS.acc} />
                  <Text style={{ color: COLORS.acc, fontWeight: '700', marginTop: 4 }}>DNI Posterior ✓</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.gray2} />
                  <Text style={{ color: COLORS.gray, fontWeight: '600', marginTop: 4 }}>DNI Posterior</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setStep(2)} style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ color: COLORS.gray, fontWeight: '700', fontSize: 14 }}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submit} disabled={loading} style={{ flex: 1, backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center', opacity: loading ? 0.7 : 1 }}>
                <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>{loading ? 'Creando tu cuenta...' : 'Crear mi cuenta ✓'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = {
  label: { fontSize: 13, fontWeight: '700' as const, color: COLORS.dark, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.dark,
  },
  photoBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 30,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}
