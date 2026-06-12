import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, Image, Animated, ActivityIndicator } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { SERVICIOS, DISTRITOS, URGENCIAS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { sendPush } from '../src/lib/integrations'
import { compressImage } from '../src/lib/imageCompress'
import { useLocationDetection } from '../src/lib/useLocation'
import { useClientProfile } from '../src/lib/useClientProfile'
import { getPrecioSugerido, formatPrecio } from '../src/lib/smartIntent'
import { findBestTech } from '../src/lib/matching'
import { fetchTechWhatsapp } from '../src/lib/contacto'
import { registerForPushNotifications, upsertGuestClientPushToken } from '../src/lib/notifications'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

const DRAFT_KEY = 'solu_solicitar_draft'

// Color de cada urgencia mapeado a la paleta semántica del theme.
const URGENCIA_COLOR: Record<string, string> = {
  normal: THEME.color.success,
  urgente: THEME.color.warning,
  emergencia: THEME.color.danger,
}

export default function SolicitarScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    tecnicoId?: string
    tecnicoNombre?: string
    tecnicoOficio?: string
    servicio?: string
    descripcion?: string
    urgencia?: string
  }>()
  const { profile, save: saveProfile } = useClientProfile()
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [preselectedTechId] = useState(params.tecnicoId ? parseInt(params.tecnicoId) : null)

  // Auto-fill from saved client profile + tech params
  useEffect(() => {
    if (profile?.nombre && !nombre) setNombre(profile.nombre)
    if (profile?.whatsapp && !whatsapp) setWhatsapp(profile.whatsapp)
    if (profile?.distrito && !distrito) setDistrito(profile.distrito)
    if (params.tecnicoOficio && !servicio) setServicio(params.tecnicoOficio)
  }, [profile])

  const [servicio, setServicio] = useState(params.servicio || params.tecnicoOficio || '')
  const [distrito, setDistrito] = useState('')
  const [urgencia, setUrgencia] = useState(params.urgencia || 'normal')
  const [descripcion, setDescripcion] = useState(params.descripcion || '')
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
      return Alert.alert('Máximo 3 fotos', 'Ya agregaste 3 fotos. Elimina una si quieres cambiarla.')
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
    const faltantes: string[] = []
    if (!whatsapp.trim()) faltantes.push('tu WhatsApp')
    if (!servicio) faltantes.push('el servicio que necesitas')
    if (!distrito) faltantes.push('tu distrito')
    if (faltantes.length > 0) {
      return Alert.alert('Te falta completar', `Agrega ${faltantes.join(', ')} para poder asignarte un técnico.`)
    }
    const nombreFinal = nombre.trim() || 'Cliente SOLU'
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Revisa tu WhatsApp', 'Debe tener 9 dígitos y empezar con 9. Por ejemplo: 999 888 777')
    }
    if (loading) return
    setLoading(true)

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

      // If coming from tech profile, assign directly. El whatsapp NO se lee
      // del listado (lockdown): se revela aparte vía endpoint server-side.
      let assignedTech: { id: number; nombre: string; whatsapp: string | null } | null = null
      if (preselectedTechId) {
        const { data: preselected } = await supabase
          .from('tecnicos')
          .select('id, nombre')
          .eq('id', preselectedTechId)
          .single()
        if (preselected) assignedTech = { id: preselected.id, nombre: preselected.nombre, whatsapp: null }
      }

      // Otherwise find best available technician (smart scoring)
      if (!assignedTech) {
        const best = await findBestTech({
          servicio,
          distrito,
          clientCoords: locationDetection.coords,
        })
        if (best) {
          assignedTech = { id: best.id, nombre: best.nombre, whatsapp: null }
        }
      }

      // Revelar el WhatsApp del técnico asignado (server-side, post-lockdown)
      if (assignedTech) {
        assignedTech.whatsapp = await fetchTechWhatsapp(assignedTech.id)
      }

      // Insert the solicitud (estado depende de si hay técnico disponible)
      const { error } = await supabase.from('clientes').insert({
        nombre: nombreFinal, whatsapp: waClean, servicio, distrito, urgencia, descripcion: descripcionFinal, codigo,
        estado: assignedTech ? 'Asignado' : 'En espera',
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
            mensaje: `${nombreFinal} necesita ${servicio} en ${distrito}. Código: ${codigo}`,
            leido: false,
          })
        } catch {}

        // Send push notification via backend
        sendPush(
          'tecnico',
          String(assignedTech.id),
          '¡Nueva solicitud de servicio!',
          `${nombreFinal} necesita ${servicio} en ${distrito}`,
        ).catch(() => {})
      }

      // Clear draft on successful submission
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {})
      // Save client profile for next time
      saveProfile({ nombre: nombreFinal, whatsapp: waClean, distrito, lastServicio: servicio }).catch(() => {})
      // Register push token so cliente receive notifications on estado changes
      registerForPushNotifications().then((token) => {
        if (token) upsertGuestClientPushToken(waClean, token, nombreFinal).catch(() => {})
      }).catch(() => {})

      haptics.success()
      // Show success screen
      setResult({
        codigo,
        techName: assignedTech?.nombre,
        techWhatsapp: assignedTech?.whatsapp ?? undefined,
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
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header Premium */}
      <FadeInUp delay={0}>
        <View style={{ backgroundColor: THEME.color.navy, padding: THEME.space.xxl, paddingTop: 52, paddingBottom: THEME.space.xxxl, borderBottomLeftRadius: THEME.radius.xxl, borderBottomRightRadius: THEME.radius.xxl, marginBottom: THEME.space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.lg }}>
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityLabel="Volver"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ width: 40, height: 40, borderRadius: THEME.radius.full, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={22} color={THEME.color.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.white }}>Solicitar técnico</Text>
              <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.6)' }}>Completa y te asignamos al mejor</Text>
            </View>
          </View>
          {/* Trust line */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: 'rgba(22,163,74,0.15)', paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm, borderRadius: THEME.radius.full, alignSelf: 'flex-start' }}>
            <Ionicons name="flash" size={14} color="#4ADE80" />
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: '#4ADE80' }}>Asignación automática en menos de 2 minutos</Text>
          </View>
        </View>
      </FadeInUp>

      <View style={{ paddingHorizontal: THEME.space.xl }}>
        <FadeInUp delay={60}>
          <Text style={styles.label}>Nombre <Text style={{ color: THEME.color.inkMuted, fontWeight: '600' }}>(opcional)</Text></Text>
          <TextInput placeholder="Tu nombre" value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor={THEME.color.inkMuted} />

          <Text style={styles.label}>WhatsApp *</Text>
          <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} placeholderTextColor={THEME.color.inkMuted} />
        </FadeInUp>

        <FadeInUp delay={120}>
          <Text style={styles.label}>Servicio *</Text>
          <TouchableOpacity
            onPress={() => setShowServicios(!showServicios)}
            accessibilityLabel="Seleccionar servicio"
            style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          >
            <Text style={{ color: servicio ? THEME.color.ink : THEME.color.inkMuted, fontSize: 15 }}>{servicio || 'Seleccionar servicio'}</Text>
            <Ionicons name={showServicios ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.color.inkMuted} />
          </TouchableOpacity>
          {showServicios && (
            <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, marginTop: -8, marginBottom: THEME.space.md, maxHeight: 220, ...THEME.shadow.md }}>
              <ScrollView nestedScrollEnabled>
                {SERVICIOS.map((s) => (
                  <TouchableOpacity key={s} onPress={() => { setServicio(s); setShowServicios(false) }} style={{ paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}>
                    <Text style={{ ...THEME.font.body, color: THEME.color.ink }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Precio sugerido (transparencia) */}
          {servicio && getPrecioSugerido(servicio) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.lg, padding: THEME.space.md, marginTop: -4, marginBottom: THEME.space.lg }}>
              <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: THEME.color.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pricetag" size={18} color={THEME.color.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.caption, color: THEME.color.info, fontWeight: '700' }}>Precio referencial</Text>
                <Text style={{ ...THEME.font.h3, color: '#1E3A8A', marginTop: 1 }}>{formatPrecio(getPrecioSugerido(servicio)!)}</Text>
              </View>
              <Text style={{ ...THEME.font.caption, color: THEME.color.info, fontWeight: '600', textAlign: 'right' }}>El técnico{'\n'}confirma</Text>
            </View>
          ) : null}
        </FadeInUp>

        <FadeInUp delay={180}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs }}>
            <Text style={styles.label}>Distrito *</Text>
            {distritoAutoDetected && distrito ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.sm, paddingVertical: 2, marginBottom: THEME.space.sm }}>
                <Ionicons name="location" size={11} color={THEME.color.success} />
                <Text style={{ ...THEME.font.caption, color: '#15803D', fontWeight: '600' }}>Detectado automáticamente</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => setShowDistritos(!showDistritos)}
            accessibilityLabel="Seleccionar distrito"
            style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          >
            <Text style={{ color: distrito ? THEME.color.ink : THEME.color.inkMuted, fontSize: 15 }}>{distrito || 'Seleccionar distrito'}</Text>
            <Ionicons name={showDistritos ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.color.inkMuted} />
          </TouchableOpacity>
          {showDistritos && (
            <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, marginTop: -8, marginBottom: THEME.space.md, maxHeight: 300, ...THEME.shadow.md }}>
              <TextInput
                placeholder="Escribe para buscar distrito..."
                placeholderTextColor={THEME.color.inkMuted}
                value={distritoFilter}
                onChangeText={setDistritoFilter}
                style={{ paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, fontSize: 15, color: THEME.color.ink, borderBottomWidth: 1, borderBottomColor: THEME.color.line }}
                autoFocus
              />
              <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
                {DISTRITOS.filter(d => !distritoFilter || d.toLowerCase().includes(distritoFilter.toLowerCase())).map((d) => (
                  <TouchableOpacity key={d} onPress={() => { handleDistritoChange(d); setDistritoFilter(''); setShowDistritos(false) }} style={{ paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}>
                    <Text style={{ ...THEME.font.body, color: THEME.color.ink }}>{d}</Text>
                  </TouchableOpacity>
                ))}
                {distritoFilter.trim() && !DISTRITOS.some(d => d.toLowerCase() === distritoFilter.toLowerCase()) && (
                  <TouchableOpacity onPress={() => { handleDistritoChange(distritoFilter.trim()); setDistritoFilter(''); setShowDistritos(false) }} style={{ paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, backgroundColor: THEME.color.brandLight }}>
                    <Text style={{ ...THEME.font.body, color: THEME.color.brand, fontWeight: '700' }}>+ Agregar "{distritoFilter.trim()}"</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </FadeInUp>

        <FadeInUp delay={240}>
          <Text style={styles.label}>Urgencia</Text>
          <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginBottom: THEME.space.lg }}>
            {URGENCIAS.map((u) => {
              const uColor = URGENCIA_COLOR[u.value] || THEME.color.brand
              const active = urgencia === u.value
              return (
                <TouchableOpacity
                  key={u.value}
                  onPress={() => setUrgencia(u.value)}
                  accessibilityLabel={`Urgencia ${u.label}`}
                  style={{
                    flex: 1, minHeight: 48, borderRadius: THEME.radius.md, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? uColor : THEME.color.surface,
                    borderWidth: 1.5, borderColor: active ? uColor : THEME.color.line,
                  }}
                >
                  <Text style={{ ...THEME.font.label, fontWeight: '700', color: active ? THEME.color.white : THEME.color.inkSoft }}>{u.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </FadeInUp>

        <FadeInUp delay={300}>
          <Text style={styles.label}>Descripción del problema</Text>
          <TextInput
            placeholder="Describe qué necesitas..."
            value={descripcion}
            onChangeText={(text) => setDescripcion(text.slice(0, 500))}
            multiline
            numberOfLines={4}
            maxLength={500}
            style={[styles.input, { height: 104, textAlignVertical: 'top', marginBottom: THEME.space.xs }]}
            placeholderTextColor={THEME.color.inkMuted}
          />
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, textAlign: 'right', marginBottom: THEME.space.lg }}>
            {descripcion.length}/500
          </Text>

          {/* Photos */}
          <Text style={styles.label}>Fotos del problema (opcional, máx 3)</Text>
          {fotos.length > 0 && (
            <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginBottom: THEME.space.sm }}>
              {fotos.map((uri, i) => (
                <View key={i} style={{ position: 'relative' }}>
                  <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: THEME.radius.md, backgroundColor: THEME.color.surfaceSunken }} />
                  <TouchableOpacity
                    onPress={() => setFotos(fotos.filter((_, idx) => idx !== i))}
                    accessibilityLabel={`Eliminar foto ${i + 1}`}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={{ position: 'absolute', top: -6, right: -6, backgroundColor: THEME.color.danger, borderRadius: 11, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: THEME.color.surface }}
                  >
                    <Ionicons name="close" size={12} color={THEME.color.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {fotos.length < 3 && (
            <TouchableOpacity
              onPress={pickFoto}
              accessibilityLabel="Agregar foto del problema"
              style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#93C5FD' }}
            >
              <Ionicons name="camera-outline" size={20} color={THEME.color.info} />
              <Text style={{ ...THEME.font.body, fontWeight: '600', color: THEME.color.info }}>Agregar foto del problema</Text>
            </TouchableOpacity>
          )}
        </FadeInUp>

        <FadeInUp delay={360}>
          <PressableScale
            onPress={submit}
            disabled={loading}
            accessibilityLabel="Solicitar técnico"
            style={{ height: 52, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.sm, ...THEME.shadow.brand }}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                <ActivityIndicator color={THEME.color.white} />
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Enviando tu solicitud...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Solicitar técnico</Text>
                <Ionicons name="arrow-forward" size={18} color={THEME.color.white} />
              </View>
            )}
          </PressableScale>

          {/* Info */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: THEME.space.sm, marginTop: THEME.space.lg, padding: THEME.space.lg, backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg }}>
            <Ionicons name="shield-checkmark" size={18} color={THEME.color.brand} style={{ marginTop: 1 }} />
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, lineHeight: 19, flex: 1 }}>
              Buscaremos al mejor técnico verificado con DNI/RENIEC en tu zona. Solo necesitas tu WhatsApp para coordinar. Solicitar no te cuesta nada: el precio del trabajo lo acuerdas directo con el técnico.
            </Text>
          </View>
        </FadeInUp>
      </View>
    </ScrollView>
  )
}

// --- Confetti dot colors ---
const CONFETTI_COLORS = ['#16A34A', '#F26B21', '#2563EB', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444']

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
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ padding: THEME.space.xl, paddingTop: 48 }}>
      {/* Animated success icon with confetti */}
      <View style={{ alignItems: 'center', marginBottom: THEME.space.xxxl }}>
        <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {/* Confetti dots */}
          {confettiDots.map((dot, i) => (
            <ConfettiDot key={i} delay={dot.delay} color={dot.color} startX={dot.startX} startY={dot.startY} />
          ))}
          {/* Checkmark circle */}
          <Animated.View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: THEME.color.success,
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: checkScale }],
            shadowColor: THEME.color.success,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 12,
          }}>
            <Ionicons name="checkmark" size={48} color={THEME.color.white} />
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: contentOpacity, alignItems: 'center', marginTop: THEME.space.sm }}>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center' }}>
            ¡Solicitud enviada!
          </Text>
          <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs, lineHeight: 20 }}>
            {result.techName ? 'Te asignamos un técnico verificado' : 'Estamos buscando el mejor técnico para ti'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: contentOpacity }}>
        {/* Tracking code with copy button */}
        <View style={{
          backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xxl, marginBottom: THEME.space.md,
          ...THEME.shadow.md,
        }}>
          <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft, marginBottom: THEME.space.xs }}>
            Tu código de seguimiento
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: THEME.color.brand, letterSpacing: 2 }}>
              {result.codigo}
            </Text>
            <PressableScale
              onPress={copyCode}
              accessibilityLabel="Copiar código"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: copied ? THEME.color.successBg : THEME.color.surfaceAlt,
                borderRadius: THEME.radius.md, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm,
              }}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? THEME.color.success : THEME.color.inkSoft} />
              <Text style={{ ...THEME.font.label, fontWeight: '700', color: copied ? THEME.color.success : THEME.color.inkSoft }}>
                {copied ? 'Copiado' : 'Copiar'}
              </Text>
            </PressableScale>
          </View>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.sm }}>
            Guarda este código para consultar el estado de tu servicio
          </Text>
        </View>

        {/* Assigned tech info */}
        {result.techName && (
          <View style={{
            backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.md,
            ...THEME.shadow.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.md }}>
              <View style={{
                width: 52, height: 52, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.navy,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="person" size={24} color={THEME.color.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>{result.techName}</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>Técnico asignado</Text>
              </View>
              <View style={{ backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: 6 }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.success }}>Asignado</Text>
              </View>
            </View>

            {/* WhatsApp direct contact */}
            <PressableScale
              onPress={() => {
                const msg = `Hola ${result.techName}, soy ${nombre}. Solicité un servicio de ${servicio} en ${distrito} por SOLU (código: ${result.codigo}).`
                Linking.openURL(`https://wa.me/51${result.techWhatsapp}?text=${encodeURIComponent(msg)}`)
              }}
              accessibilityLabel="Contactar por WhatsApp"
              style={{
                height: 48, backgroundColor: '#25D366', borderRadius: THEME.radius.lg,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color={THEME.color.white} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Contactar por WhatsApp</Text>
            </PressableScale>
          </View>
        )}

        {/* Track service */}
        <PressableScale
          onPress={() => router.replace({ pathname: '/tracking/[code]', params: { code: result.codigo } })}
          accessibilityLabel="Seguir mi servicio"
          style={{
            height: 52, backgroundColor: THEME.color.navy, borderRadius: THEME.radius.lg,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md,
            ...THEME.shadow.md,
          }}
        >
          <Ionicons name="navigate" size={18} color={THEME.color.white} />
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Seguir mi servicio</Text>
        </PressableScale>

        {/* Back to home */}
        <PressableScale
          onPress={() => router.back()}
          accessibilityLabel="Volver al inicio"
          style={{
            height: 52, backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.color.line,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
          }}
        >
          <Ionicons name="home" size={18} color={THEME.color.ink} />
          <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Volver al inicio</Text>
        </PressableScale>

        {/* Help */}
        {!result.techName && (
          <View style={{ backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginTop: THEME.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.xs }}>
              <Ionicons name="time" size={18} color="#92400E" />
              <Text style={{ ...THEME.font.h3, color: '#92400E' }}>Buscando técnico...</Text>
            </View>
            <Text style={{ ...THEME.font.bodySm, color: '#92400E', lineHeight: 19 }}>
              No encontramos un técnico disponible en {distrito} ahora mismo. Tu solicitud quedó registrada y te contactaremos pronto por WhatsApp al {whatsapp}.
            </Text>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  )
}

const styles = {
  label: { ...THEME.font.label, fontWeight: '700' as const, color: THEME.color.ink, marginBottom: THEME.space.sm },
  input: {
    backgroundColor: THEME.color.surface,
    borderRadius: THEME.radius.lg,
    paddingHorizontal: THEME.space.lg,
    paddingVertical: THEME.space.md + 2,
    fontSize: 15,
    marginBottom: THEME.space.lg,
    borderWidth: 1.5,
    borderColor: THEME.color.line,
    color: THEME.color.ink,
    fontWeight: '500' as const,
  },
}
