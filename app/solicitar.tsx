import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, Image, Animated } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS, SERVICIOS, DISTRITOS, URGENCIAS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { ENV } from '../src/lib/env'
import { notifyTech, trackEvent } from '../src/lib/integrations'
import { compressImage } from '../src/lib/imageCompress'
import { track } from '../src/lib/analytics'
import { useLocationDetection } from '../src/lib/useLocation'

const DRAFT_KEY = 'solu_solicitar_draft'

export default function SolicitarScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tecnicoId?: string; tecnicoNombre?: string; tecnicoOficio?: string }>()
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [preselectedTechId] = useState(params.tecnicoId ? parseInt(params.tecnicoId) : null)

  // Auto-fill from logged-in client + tech params
  useEffect(() => {
    AsyncStorage.getItem('solu_client_session').then((stored) => {
      if (stored) {
        try {
          const user = JSON.parse(stored)
          if (user.nombre && !nombre) setNombre(user.nombre)
          if (user.whatsapp && !whatsapp) setWhatsapp(user.whatsapp)
          if (user.distrito && !distrito) setDistrito(user.distrito)
        } catch {}
      }
    })
    // Pre-fill service from tech profile
    if (params.tecnicoOficio && !servicio) setServicio(params.tecnicoOficio)
  }, [])
  const [servicio, setServicio] = useState(params.tecnicoOficio || '')
  const [distrito, setDistrito] = useState('')
  const [urgencia, setUrgencia] = useState('normal')
  const [descripcion, setDescripcion] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showServicios, setShowServicios] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)
  const [distritoFilter, setDistritoFilter] = useState('')
  const [distritoAutoDetected, setDistritoAutoDetected] = useState(false)
  const locationDetection = useLocationDetection()
  const [result, setResult] = useState<{ codigo: string; techName?: string; techWhatsapp?: string } | null>(null)
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load draft from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((stored) => {
      if (stored) {
        try {
          const draft = JSON.parse(stored)
          if (draft.servicio && !servicio) setServicio(draft.servicio)
          if (draft.distrito && !distrito) setDistrito(draft.distrito)
          if (draft.urgencia) setUrgencia(draft.urgencia)
          if (draft.descripcion && !descripcion) setDescripcion(draft.descripcion)
        } catch {}
      }
    })
  }, [])

  // Save draft to AsyncStorage (debounced 1s)
  useEffect(() => {
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
    draftTimeoutRef.current = setTimeout(() => {
      const draft = { servicio, distrito, urgencia, descripcion }
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {})
    }, 1000)
    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
    }
  }, [servicio, distrito, urgencia, descripcion])

  // Auto-detect district from GPS location
  useEffect(() => {
    locationDetection.detectLocation().then((detected) => {
      if (detected && !distrito) {
        setDistrito(detected)
        setDistritoAutoDetected(true)
      }
    })
  }, [])

  // Reset auto-detected badge when user manually changes distrito
  const handleDistritoChange = (value: string) => {
    setDistrito(value)
    setDistritoAutoDetected(false)
  }

  async function pickFoto() {
    if (fotos.length >= 3) {
      return Alert.alert('Límite', 'Puedes agregar máximo 3 fotos')
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri)
      setFotos([...fotos, compressed])
    }
  }

  async function uploadFoto(uri: string, index: number): Promise<string | null> {
    try {
      const ext = uri.split('.').pop() || 'jpg'
      const name = `solicitudes/${Date.now()}_${index}.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('fotos').upload(name, blob)
      if (error) return null
      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(name)
      return urlData.publicUrl
    } catch {
      return null
    }
  }

  async function submit() {
    if (!nombre || !whatsapp || !servicio || !distrito) {
      return Alert.alert('Error', 'Completa los campos obligatorios')
    }
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un número de WhatsApp válido (9 dígitos, empieza con 9)')
    }
    if (loading) return
    setLoading(true)
    track('Service Request Started', { servicio, distrito, urgencia })

    try {
      const codigo = 'SOLU-' + Math.random().toString(36).substring(2, 8).toUpperCase()

      // Upload photos if any
      let descripcionFinal = descripcion
      if (fotos.length > 0) {
        const uploadedUrls: string[] = []
        for (let i = 0; i < fotos.length; i++) {
          const url = await uploadFoto(fotos[i], i)
          if (url) uploadedUrls.push(url)
        }
        if (uploadedUrls.length > 0) {
          descripcionFinal = descripcionFinal
            ? `${descripcionFinal}\n\n[Fotos adjuntas]\n${uploadedUrls.join('\n')}`
            : `[Fotos adjuntas]\n${uploadedUrls.join('\n')}`
        }
      }

      // If coming from tech profile, assign directly
      let assignedTech: { id: number; nombre: string; whatsapp: string; push_token?: string } | null = null
      if (preselectedTechId) {
        const { data: preselected } = await supabase
          .from('tecnicos')
          .select('id, nombre, whatsapp, push_token')
          .eq('id', preselectedTechId)
          .single()
        if (preselected) assignedTech = preselected
      }

      // Otherwise find best available technician in the district
      if (!assignedTech) {
        const { data: techs } = await supabase
          .from('tecnicos')
          .select('id, nombre, whatsapp, push_token')
          .eq('disponible', true)
          .eq('distrito', distrito)
          .order('plan', { ascending: false })
          .order('calificacion', { ascending: false })
          .limit(3)
        assignedTech = techs?.[0] || null
      }
      if (!assignedTech) {
        const { data: anyTechs } = await supabase
          .from('tecnicos')
          .select('id, nombre, whatsapp, push_token')
          .eq('disponible', true)
          .order('calificacion', { ascending: false })
          .limit(3)
        assignedTech = anyTechs?.[0] || null
      }

      // Insert the solicitud
      const { error } = await supabase.from('clientes').insert({
        nombre, whatsapp: waClean, servicio, distrito, urgencia, descripcion: descripcionFinal, codigo,
        estado: assignedTech ? 'Asignado' : 'Nuevo',
        tecnico_asignado: assignedTech?.id || null,
      })

      if (error) {
        Alert.alert('Error', 'No se pudo enviar la solicitud. Verifica tu conexión e intenta de nuevo.')
        setLoading(false)
        return
      }

      // Create notification for the technician
      if (assignedTech) {
        try {
          await supabase.from('notificaciones').insert({
            tecnico_id: assignedTech.id,
            tipo: 'nueva_solicitud',
            titulo: '¡Nueva solicitud!',
            mensaje: `${nombre} necesita ${servicio} en ${distrito}. Código: ${codigo}`,
            leido: false,
          })
        } catch {}

        // Send push notification
        if (assignedTech.push_token) {
          sendPushNotification(
            assignedTech.push_token,
            '¡Nueva solicitud de servicio!',
            `${nombre} necesita ${servicio} en ${distrito}`
          ).catch(() => {})
        }
      }

      // Clear draft on successful submission
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {})
      track('Service Request Completed', { servicio, distrito, codigo })

      // Show success screen
      setResult({
        codigo,
        techName: assignedTech?.nombre,
        techWhatsapp: assignedTech?.whatsapp,
      })
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Success screen after sending
  if (result) {
    return (
      <SuccessScreen
        result={result}
        nombre={nombre}
        servicio={servicio}
        distrito={distrito}
        whatsapp={whatsapp}
        router={router}
      />
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Premium */}
      <View style={{ backgroundColor: '#1A1A2E', padding: 24, paddingTop: 48, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="build" size={18} color="#fff" />
          </View>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>Solicitar Técnico</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Completa el formulario y te asignamos uno</Text>
          </View>
        </View>
        {/* Steps indicator premium */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>1</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Completa datos</Text>
          </View>
          <View style={{ flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '900' }}>2</Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>Te asignamos técnico</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>

        <Text style={styles.label}>Nombre *</Text>
        <TextInput placeholder="Tu nombre" value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor={COLORS.gray2} />

        <Text style={styles.label}>WhatsApp *</Text>
        <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} placeholderTextColor={COLORS.gray2} />

        <Text style={styles.label}>Servicio *</Text>
        <TouchableOpacity onPress={() => setShowServicios(!showServicios)} style={styles.input}>
          <Text style={{ color: servicio ? COLORS.dark : COLORS.gray2, fontSize: 14 }}>{servicio || 'Seleccionar servicio'}</Text>
        </TouchableOpacity>
        {showServicios && (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
            <ScrollView nestedScrollEnabled>
              {SERVICIOS.map((s) => (
                <TouchableOpacity key={s} onPress={() => { setServicio(s); setShowServicios(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <Text style={{ fontSize: 13, color: COLORS.dark }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.label}>Distrito *</Text>
          {distritoAutoDetected && distrito ? (
            <View style={{ backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 }}>
              <Text style={{ fontSize: 10, color: '#065F46', fontWeight: '600' }}>📍 Detectado automaticamente</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setShowDistritos(!showDistritos)} style={styles.input}>
          <Text style={{ color: distrito ? COLORS.dark : COLORS.gray2, fontSize: 14 }}>{distrito || 'Seleccionar distrito'}</Text>
        </TouchableOpacity>
        {showDistritos && (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 280, borderWidth: 1, borderColor: COLORS.border }}>
            <TextInput
              placeholder="Escribe para buscar distrito..."
              placeholderTextColor="#9CA3AF"
              value={distritoFilter}
              onChangeText={setDistritoFilter}
              style={{ padding: 12, fontSize: 14, color: COLORS.dark, borderBottomWidth: 1, borderBottomColor: COLORS.border }}
              autoFocus
            />
            <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
              {DISTRITOS.filter(d => !distritoFilter || d.toLowerCase().includes(distritoFilter.toLowerCase())).map((d) => (
                <TouchableOpacity key={d} onPress={() => { handleDistritoChange(d); setDistritoFilter(''); setShowDistritos(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <Text style={{ fontSize: 13, color: COLORS.dark }}>{d}</Text>
                </TouchableOpacity>
              ))}
              {distritoFilter.trim() && !DISTRITOS.some(d => d.toLowerCase() === distritoFilter.toLowerCase()) && (
                <TouchableOpacity onPress={() => { handleDistritoChange(distritoFilter.trim()); setDistritoFilter(''); setShowDistritos(false) }} style={{ padding: 12, backgroundColor: '#EFF6FF' }}>
                  <Text style={{ fontSize: 13, color: '#2563EB', fontWeight: '700' }}>+ Agregar "{distritoFilter.trim()}"</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Urgencia</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {URGENCIAS.map((u) => (
            <TouchableOpacity
              key={u.value}
              onPress={() => setUrgencia(u.value)}
              style={{
                flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: urgencia === u.value ? u.color : COLORS.white,
                borderWidth: 1, borderColor: urgencia === u.value ? u.color : COLORS.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: urgencia === u.value ? COLORS.white : COLORS.gray }}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Descripción del problema</Text>
        <TextInput
          placeholder="Describe qué necesitas..."
          value={descripcion}
          onChangeText={(text) => setDescripcion(text.slice(0, 500))}
          multiline
          numberOfLines={4}
          maxLength={500}
          style={[styles.input, { height: 100, textAlignVertical: 'top', marginBottom: 4 }]}
          placeholderTextColor={COLORS.gray2}
        />
        <Text style={{ fontSize: 11, color: COLORS.gray2, textAlign: 'right', marginBottom: 16 }}>
          {descripcion.length}/500
        </Text>

        {/* Photos */}
        <Text style={styles.label}>Fotos del problema (opcional, máx 3)</Text>
        {fotos.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {fotos.map((uri, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: '#F1F5F9' }} />
                <TouchableOpacity
                  onPress={() => setFotos(fotos.filter((_, idx) => idx !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {fotos.length < 3 && (
          <TouchableOpacity
            onPress={pickFoto}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#93C5FD' }}
          >
            <Ionicons name="camera-outline" size={20} color="#2563EB" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>Agregar foto del problema</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={{ backgroundColor: '#EA580C', borderRadius: 20, padding: 20, alignItems: 'center', marginTop: 12, shadowColor: '#EA580C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 }}>
            {loading ? 'ENVIANDO...' : 'SOLICITAR TÉCNICO →'}
          </Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={{ marginTop: 16, padding: 16, backgroundColor: 'rgba(234,88,12,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(234,88,12,0.15)' }}>
          <Text style={{ fontSize: 12, color: '#9A3412', lineHeight: 18, fontWeight: '600' }}>
            🛡️ Al enviar tu solicitud, buscaremos al mejor técnico verificado en tu zona y lo conectaremos contigo por WhatsApp. El servicio es gratuito para clientes.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

// --- Confetti dot colors ---
const CONFETTI_COLORS = ['#10B981', '#F26B21', '#2563EB', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444']

function ConfettiDot({ delay, color, startX, startY }: { delay: number; color: string; startX: number; startY: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start()
  }, [])
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, startX] })
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, startY] })
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.5, 0.3] })
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 1, 1, 0] })
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        transform: [{ translateX }, { translateY }, { scale }],
        opacity,
      }}
    />
  )
}

function SuccessScreen({ result, nombre, servicio, distrito, whatsapp, router }: {
  result: { codigo: string; techName?: string; techWhatsapp?: string }
  nombre: string; servicio: string; distrito: string; whatsapp: string; router: any
}) {
  const checkScale = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  async function copyCode() {
    try {
      await Clipboard.setStringAsync(result.codigo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // Generate confetti dots around the checkmark
  const confettiDots = CONFETTI_COLORS.map((color, i) => {
    const angle = (i / CONFETTI_COLORS.length) * Math.PI * 2
    const dist = 60 + Math.random() * 40
    return {
      color,
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      delay: 200 + i * 60,
    }
  })

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20, paddingTop: 40 }}>
      {/* Animated success icon with confetti */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {/* Confetti dots */}
          {confettiDots.map((dot, i) => (
            <ConfettiDot key={i} delay={dot.delay} color={dot.color} startX={dot.startX} startY={dot.startY} />
          ))}
          {/* Checkmark circle */}
          <Animated.View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: '#10B981',
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: checkScale }],
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 12,
          }}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: contentOpacity, alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.dark, textAlign: 'center' }}>
            ¡Solicitud enviada!
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
            {result.techName ? 'Te asignamos un tecnico verificado' : 'Estamos buscando el mejor tecnico para ti'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: contentOpacity }}>
        {/* Tracking code with copy button */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 20, padding: 24, marginBottom: 14,
          borderWidth: 1, borderColor: '#E2E8F0',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
        }}>
          <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6, fontWeight: '600' }}>
            Tu codigo de seguimiento
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: COLORS.pri, letterSpacing: 2 }}>
              {result.codigo}
            </Text>
            <TouchableOpacity
              onPress={copyCode}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: copied ? '#10B98115' : '#F1F5F9',
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              }}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? '#10B981' : COLORS.gray} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: copied ? '#10B981' : COLORS.gray }}>
                {copied ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 8 }}>
            Guarda este codigo para consultar el estado de tu servicio
          </Text>
        </View>

        {/* Assigned tech info */}
        {result.techName && (
          <View style={{
            backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 14,
            borderWidth: 1, borderColor: '#E2E8F0',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E3A5F',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{result.techName}</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>Tecnico asignado</Text>
              </View>
              <View style={{ backgroundColor: '#10B98115', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Asignado</Text>
              </View>
            </View>

            {/* WhatsApp direct contact */}
            <TouchableOpacity
              onPress={() => {
                const msg = `Hola ${result.techName}, soy ${nombre}. Solicite un servicio de ${servicio} en ${distrito} por SOLU (codigo: ${result.codigo}).`
                Linking.openURL(`https://wa.me/51${result.techWhatsapp}?text=${encodeURIComponent(msg)}`)
              }}
              style={{
                backgroundColor: '#25D366', borderRadius: 14, padding: 15,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Contactar por WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Track service */}
        <TouchableOpacity
          onPress={() => router.replace({ pathname: '/tracking/[code]', params: { code: result.codigo } })}
          style={{
            backgroundColor: '#1E3A5F', borderRadius: 16, padding: 17,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
            shadowColor: '#1E3A5F', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
          }}
        >
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Seguir mi servicio</Text>
        </TouchableOpacity>

        {/* Back to home */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 17, borderWidth: 1, borderColor: '#E2E8F0',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Ionicons name="home" size={18} color={COLORS.dark} />
          <Text style={{ color: COLORS.dark, fontWeight: '700', fontSize: 14 }}>Volver al inicio</Text>
        </TouchableOpacity>

        {/* Help */}
        {!result.techName && (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 14, padding: 18, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="time" size={18} color="#92400E" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>Buscando tecnico...</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 18 }}>
              No encontramos un tecnico disponible en {distrito} ahora mismo. Tu solicitud quedo registrada y te contactaremos pronto por WhatsApp al {whatsapp}.
            </Text>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  )
}

async function sendPushNotification(expoPushToken: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      priority: 'high',
    }),
  })
}

const styles = {
  label: { fontSize: 13, fontWeight: '800' as const, color: '#1A1A2E', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    color: '#1A1A2E',
    fontWeight: '600' as const,
  },
}
