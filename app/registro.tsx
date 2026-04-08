import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS, SERVICIOS, DISTRITOS, PLAN_FEATURES } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { logger } from '../src/lib/logger'
import { ENV } from '../src/lib/env'
import { verifyDNI, notifyTech, trackEvent } from '../src/lib/integrations'
import { compressDNIPhoto } from '../src/lib/imageCompress'

const OFICIOS = [
  'Gasfitero', 'Electricista', 'Pintor', 'Cerrajero', 'Técnico en refrigeración',
  'Albañil', 'Carpintero', 'Limpieza profesional', 'Fumigador', 'Instalador',
  'Técnico en electrodomésticos', 'Techador', 'Vidriero', 'Soldador',
  'Jardinero', 'Mudanzas', 'Técnico en seguridad', 'Técnico en redes',
]

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

  // Step 2
  const [selectedPlan, setSelectedPlan] = useState<'profesional' | 'premium' | 'elite'>('profesional')
  const [oficios, setOficios] = useState<string[]>([])
  const [distritos, setDistritos] = useState<string[]>([])
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [showOficios, setShowOficios] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)
  const [distritoSearch, setDistritoSearch] = useState('')

  // Plan limits
  const maxOficios = selectedPlan === 'profesional' ? 1 : selectedPlan === 'premium' ? 2 : 999
  const maxDistritos = selectedPlan === 'profesional' ? 2 : selectedPlan === 'premium' ? 4 : 999

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
      let dniFrenteUrl = null
      let dniPosteriorUrl = null

      if (dniFront) dniFrenteUrl = await uploadDni(dniFront, 'frente')
      if (dniBack) dniPosteriorUrl = await uploadDni(dniBack, 'posterior')

      // Register via backend API (handles uniqueness checks, bcrypt hashing, free trial calc)
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
          plan: selectedPlan,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        Alert.alert('Error', result.error || 'No se pudo completar el registro.')
      } else {
        Alert.alert(
          '¡Registro exitoso!',
          `Tu cuenta ha sido creada con el plan ${PLAN_FEATURES[selectedPlan].name}. Inicia sesión desde la pestaña Mi Cuenta.`,
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
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Paso 1 de 3</Text>

            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput placeholder="Juan Pérez López" value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>WhatsApp *</Text>
            <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Email</Text>
            <TextInput placeholder="correo@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Contraseña</Text>
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
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Tu servicio y plan</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Paso 2 de 3</Text>

            {/* Plan selection */}
            <Text style={styles.label}>Elige tu plan *</Text>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {(['profesional', 'premium', 'elite'] as const).map((planKey) => {
                const plan = PLAN_FEATURES[planKey]
                const isSelected = selectedPlan === planKey
                return (
                  <TouchableOpacity
                    key={planKey}
                    onPress={() => setSelectedPlan(planKey)}
                    style={{
                      backgroundColor: isSelected ? '#1E3A5F' : '#fff',
                      borderRadius: 14, padding: 14,
                      borderWidth: 2, borderColor: isSelected ? '#1E3A5F' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: isSelected ? '#fff' : COLORS.dark }}>{plan.name}</Text>
                        <Text style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.gray, marginTop: 2 }}>
                          {planKey === 'profesional' ? '1 oficio · 2 zonas' : planKey === 'premium' ? '2 oficios · 4 zonas' : 'Oficios y zonas ilimitados'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: isSelected ? '#fff' : COLORS.pri }}>S/{plan.price}</Text>
                        <Text style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.6)' : COLORS.gray2 }}>Primer mes gratis</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={styles.label}>Oficios * {maxOficios < 999 ? `(máx ${maxOficios})` : '(ilimitados)'}</Text>
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
                      if (oficios.length >= maxOficios) {
                        Alert.alert('Límite alcanzado', `Tu plan ${selectedPlan} permite máximo ${maxOficios} oficio${maxOficios > 1 ? 's' : ''}. Elige un plan superior para más oficios.`)
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

            <Text style={styles.label}>Distritos * {maxDistritos < 999 ? `(máx ${maxDistritos})` : '(ilimitados)'}</Text>
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
                      if (distritos.length >= maxDistritos) {
                        Alert.alert('Límite alcanzado', `Tu plan ${selectedPlan} permite máximo ${maxDistritos} distrito${maxDistritos > 1 ? 's' : ''}. Elige un plan superior para más zonas.`)
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
                      if (distritos.length >= maxDistritos) {
                        Alert.alert('Límite alcanzado', `Tu plan ${selectedPlan} permite máximo ${maxDistritos} distrito${maxDistritos > 1 ? 's' : ''}`)
                        return
                      }
                      setDistritos([...distritos, distritoSearch.trim()])
                      setDistritoSearch('')
                      setShowDistritos(false)
                    }} style={{ padding: 12, backgroundColor: '#EFF6FF' }}>
                      <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: '700' }}>+ Agregar "{distritoSearch.trim()}"</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Precio desde (S/)</Text>
            <TextInput placeholder="Ej: 50" value={precio} onChangeText={setPrecio} keyboardType="number-pad" style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Experiencia</Text>
            <TextInput placeholder="Ej: 5 años" value={experiencia} onChangeText={setExperiencia} style={styles.input} placeholderTextColor={COLORS.gray2} />

            <Text style={styles.label}>Descripción</Text>
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
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Paso 3 de 3 — Sube fotos de tu DNI</Text>

            <TouchableOpacity onPress={() => pickImage(setDniFront)} style={styles.photoBox}>
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

            <TouchableOpacity onPress={() => pickImage(setDniBack)} style={styles.photoBox}>
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
              <TouchableOpacity onPress={submit} disabled={loading} style={{ flex: 1, backgroundColor: COLORS.acc, borderRadius: 14, padding: 16, alignItems: 'center' }}>
                <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>{loading ? 'Registrando...' : 'Registrarme ✓'}</Text>
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
