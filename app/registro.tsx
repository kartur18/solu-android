import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS, SERVICIOS, DISTRITOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'

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

  // Step 2
  const [oficio, setOficio] = useState('')
  const [distrito, setDistrito] = useState('')
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [showOficios, setShowOficios] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)

  // Step 3
  const [dniFront, setDniFront] = useState<string | null>(null)
  const [dniBack, setDniBack] = useState<string | null>(null)

  async function pickImage(setter: (uri: string) => void) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (!result.canceled) setter(result.assets[0].uri)
  }

  async function uploadDni(uri: string, side: string) {
    const ext = uri.split('.').pop()
    const name = `dni/${Date.now()}_${side}_${dni}.${ext}`
    const response = await fetch(uri)
    const blob = await response.blob()
    const { error } = await supabase.storage.from('fotos').upload(name, blob)
    return error ? null : name
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
    return true
  }

  async function submit() {
    if (!nombre || !whatsapp || !dni || !oficio || !distrito) {
      return Alert.alert('Error', 'Completa todos los campos obligatorios')
    }
    if (!validateStep1()) return
    setLoading(true)

    let dniFrenteUrl = null
    let dniPosteriorUrl = null

    if (dniFront) dniFrenteUrl = await uploadDni(dniFront, 'frente')
    if (dniBack) dniPosteriorUrl = await uploadDni(dniBack, 'posterior')

    const { error } = await supabase.from('tecnicos').insert({
      nombre, whatsapp, email, dni, oficio, distrito,
      precio_desde: precio ? parseInt(precio) : null,
      experiencia, descripcion,
      dni_frente_url: dniFrenteUrl,
      dni_posterior_url: dniPosteriorUrl,
      plan: 'trial',
      disponible: true,
      verificado: false,
      calificacion: 0,
      num_resenas: 0,
      servicios_completados: 0,
      fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (error) {
      const msg = error.message?.includes('duplicate')
        ? 'Ya existe una cuenta con ese DNI o WhatsApp'
        : 'No se pudo completar el registro. Verifica tu conexión e intenta de nuevo.'
      Alert.alert('Error', msg)
    } else {
      Alert.alert(
        '¡Registro exitoso!',
        'Tu cuenta ha sido creada con 30 días de prueba gratuita. Te notificaremos cuando tu perfil sea verificado.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    }
    setLoading(false)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
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
            <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 20 }}>Paso 2 de 3</Text>

            <Text style={styles.label}>Oficio *</Text>
            <TouchableOpacity onPress={() => setShowOficios(!showOficios)} style={styles.input}>
              <Text style={{ color: oficio ? COLORS.dark : COLORS.gray2 }}>{oficio || 'Seleccionar oficio'}</Text>
            </TouchableOpacity>
            {showOficios && (
              <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
                <ScrollView nestedScrollEnabled>
                  {OFICIOS.map((o) => (
                    <TouchableOpacity key={o} onPress={() => { setOficio(o); setShowOficios(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                      <Text style={{ fontSize: 13, color: COLORS.dark }}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Distrito principal *</Text>
            <TouchableOpacity onPress={() => setShowDistritos(!showDistritos)} style={styles.input}>
              <Text style={{ color: distrito ? COLORS.dark : COLORS.gray2 }}>{distrito || 'Seleccionar distrito'}</Text>
            </TouchableOpacity>
            {showDistritos && (
              <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
                <ScrollView nestedScrollEnabled>
                  {DISTRITOS.map((d) => (
                    <TouchableOpacity key={d} onPress={() => { setDistrito(d); setShowDistritos(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                      <Text style={{ fontSize: 13, color: COLORS.dark }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
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
              <TouchableOpacity onPress={() => setStep(3)} style={{ flex: 1, backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center' }}>
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
