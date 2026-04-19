import { useState, useCallback, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, Switch, RefreshControl, Image, Modal, FlatList, ActivityIndicator, Share } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS, getTechLevel, getTechLevelProgress, ACHIEVEMENTS, PLAN_FEATURES, LEVELS, waLink, DISTRITOS, SUPPORT_PHONE, ESTADOS, OFICIOS_LIST } from '../../src/lib/constants'
import { ENV } from '../../src/lib/env'
import { fetchWithTimeout } from '../../src/lib/env'
import { supabase } from '../../src/lib/supabase'
import { registerForPushNotifications, savePushToken } from '../../src/lib/notifications'
import { sendPush } from '../../src/lib/integrations'
import type { Tecnico, Cliente, Resena, Notificacion, Cotizacion } from '../../src/lib/types'
import NotificationCenter from '../../src/components/NotificationCenter'

type Tab = 'dashboard' | 'servicios' | 'resenas' | 'cotizaciones' | 'ingresos' | 'plan' | 'perfil'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'dashboard', icon: 'grid', label: 'Inicio' },
  { key: 'servicios', icon: 'briefcase', label: 'Servicios' },
  { key: 'resenas', icon: 'star', label: 'Reseñas' },
  { key: 'cotizaciones', icon: 'document-text', label: 'Cotizaciones' },
  { key: 'ingresos', icon: 'cash', label: 'Ingresos' },
  { key: 'plan', icon: 'diamond', label: 'Plan' },
  { key: 'perfil', icon: 'person', label: 'Perfil' },
]

const NOTIF_ICONS: Record<string, string> = {
  nueva_solicitud: 'notifications',
  pago_recibido: 'cash',
  plan_vencimiento: 'warning',
  nueva_resena: 'star',
}

const NOTIF_COLORS: Record<string, string> = {
  nueva_solicitud: '#2563EB',
  pago_recibido: '#10B981',
  plan_vencimiento: '#F59E0B',
  nueva_resena: '#F59E0B',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mes`
}

export default function CuentaScreen() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [leads, setLeads] = useState<Cliente[]>([])
  const [reviews, setReviews] = useState<Resena[]>([])
  const [openRequests, setOpenRequests] = useState<{ id: number; codigo: string; servicio: string; cliente_nombre: string; distrito: string; urgencia: string; created_at: string }[]>([])
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null)
  const [profileViews, setProfileViews] = useState(0)
  const [editOficios, setEditOficios] = useState<string[]>([])
  const [editZonas, setEditZonas] = useState<string[]>([])
  const [showOficiosPicker, setShowOficiosPicker] = useState(false)
  const [showZonasPicker, setShowZonasPicker] = useState(false)
  const [zonaSearch, setZonaSearch] = useState('')

  async function handleSubscribe(planKey: string) {
    if (!tech) return
    setSubscribingTo(planKey)
    try {
      const res = await fetch(`${ENV.API_BASE_URL}/flow-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tecnicoId: tech.id, plan: planKey })
      })
      if (!res.ok) throw new Error('Error al conectar con la pasarela Flow')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const payUrl = data.redirectUrl || data.url || data.paymentUrl
      if (payUrl) {
        Linking.openURL(payUrl)
      } else {
        throw new Error('No se recibió el enlace de pago')
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar el pago')
    } finally {
      setSubscribingTo(null)
    }
  }

  // Edit profile state
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editPrecio, setEditPrecio] = useState('')
  const [editDisponible, setEditDisponible] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)

  // Documents state
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

  // Pagos state
  const [pagos, setPagos] = useState<any[]>([])

  // Cotizaciones state
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [showNewCotizacion, setShowNewCotizacion] = useState(false)
  const [cotLeadId, setCotLeadId] = useState('')
  const [cotMonto, setCotMonto] = useState('')
  const [cotDescripcion, setCotDescripcion] = useState('')
  const [cotServicio, setCotServicio] = useState('')
  const [savingCotizacion, setSavingCotizacion] = useState(false)

  // Auto-login from saved session
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('solu_tech_session')
        if (!saved) return
        const session = JSON.parse(saved)
        if (session?.id) {
          setLoading(true)
          const { data } = await supabase.from('tecnicos').select('*').eq('id', session.id).single()
          if (data) {
            setTech(data)
            setLoggedIn(true)
            setEditDesc(data.descripcion || '')
            setEditPrecio(data.precio_desde?.toString() || '')
            setEditDisponible(data.disponible)
            setGalleryImages(data.galeria || [])
            registerForPushNotifications().then(token => {
              if (token) savePushToken(data.id, token)
            })
            await loadData(data.id)
          } else {
            await AsyncStorage.removeItem('solu_tech_session')
          }
          setLoading(false)
        }
      } catch {
        setLoading(false)
      }
    })()
  }, [])

  async function doLogin() {
    const trimmedId = loginId.trim()
    if (!trimmedId) return Alert.alert('Error', 'Ingresa tu email o WhatsApp')

    const isEmail = trimmedId.includes('@')
    const isWhatsApp = /^\d{7,15}$/.test(trimmedId.replace(/\s/g, ''))

    if (!isEmail && !isWhatsApp) {
      return Alert.alert('Error', 'Ingresa un email válido o número de WhatsApp')
    }

    setLoading(true)
    try {
      const identifier = isEmail ? trimmedId : trimmedId.replace(/\s/g, '')
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/login-tech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: loginPassword || undefined }),
      })
      const result = await res.json()

      if (!res.ok) {
        Alert.alert('Error', result.error || 'Error al iniciar sesión')
        setLoading(false)
        return
      }

      const data = result.technician

      setTech(data)
      setLoggedIn(true)
      setEditDesc(data.descripcion || '')
      setEditPrecio(data.precio_desde?.toString() || '')
      setEditDisponible(data.disponible)
      setGalleryImages(data.galeria || [])
      setEditOficios(data.oficios || [data.oficio].filter(Boolean))
      setEditZonas(data.zonas || [data.distrito].filter(Boolean))

      // Persist session
      await AsyncStorage.setItem('solu_tech_session', JSON.stringify({ id: data.id, nombre: data.nombre }))

      registerForPushNotifications().then(token => {
        if (token) savePushToken(data.id, token)
      })
      await loadData(data.id)
    } catch {
      Alert.alert('Error', 'Error de conexión. Verifica tu internet.')
    } finally {
      setLoading(false)
    }
  }

  async function loadData(techId: number) {
    try {
      const [leadsRes, revRes, notifRes, cotRes, pagosRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('tecnico_asignado', techId).order('created_at', { ascending: false }).limit(30),
        supabase.from('resenas').select('*').eq('tecnico_id', techId).order('created_at', { ascending: false }).limit(30),
        supabase.from('notificaciones').select('*').eq('tecnico_id', techId).order('created_at', { ascending: false }).limit(50),
        supabase.from('cotizaciones').select('*').eq('tecnico_id', techId).order('created_at', { ascending: false }).limit(30),
        supabase.from('pagos').select('*').eq('tecnico_id', techId).order('created_at', { ascending: false }).limit(20),
      ])
      setLeads(leadsRes.data || [])
      setReviews(revRes.data || [])
      // Load open solicitudes for "Trabajos disponibles"
      try {
        const { data: openData } = await supabase
          .from('solicitudes_servicio')
          .select('id, codigo, servicio, cliente_nombre, distrito, urgencia, created_at')
          .eq('estado', 'abierta')
          .order('created_at', { ascending: false })
          .limit(10)
        setOpenRequests(openData || [])
      } catch {}
      const notifs = notifRes.data || []
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n: Notificacion) => !n.leido).length)
      setCotizaciones(cotRes.data || [])
      setPagos(pagosRes.data || [])
      // Load profile views count
      try {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        const { count } = await supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('tecnico_id', techId).gte('created_at', weekAgo)
        setProfileViews(count || 0)
      } catch { /* table might not exist */ }
    } catch {
      // silent
    }
  }

  const onRefresh = useCallback(async () => {
    if (!tech) return
    setRefreshing(true)
    try {
      const { data } = await supabase.from('tecnicos').select('*').eq('id', tech.id).single()
      if (data) {
        setTech(data)
        setEditDesc(data.descripcion || '')
        setEditPrecio(data.precio_desde?.toString() || '')
        setEditDisponible(data.disponible)
        setGalleryImages(data.galeria || [])
      }
      await loadData(tech.id)
    } catch {} finally {
      setRefreshing(false)
    }
  }, [tech])

  async function saveProfile() {
    if (!tech) return
    setSavingProfile(true)
    try {
      const updates: any = {
        descripcion: editDesc || null,
        precio_desde: editPrecio ? parseInt(editPrecio) : null,
        disponible: editDisponible,
      }
      if (editOficios.length > 0) {
        updates.oficios = editOficios
        updates.oficio = editOficios[0]
      }
      if (editZonas.length > 0) {
        updates.zonas = editZonas
        updates.distrito = editZonas[0]
      }
      const { error } = await supabase.from('tecnicos').update(updates).eq('id', tech.id)

      if (error) throw error
      setTech({ ...tech, ...updates } as Tecnico)
      setEditing(false)
      Alert.alert('Guardado', 'Tu perfil se actualizó correctamente')
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo guardar: ' + (err?.message || 'Intenta de nuevo'))
    } finally {
      setSavingProfile(false)
    }
  }

  // --- Notification functions ---
  async function markNotifRead(notifId: number) {
    try {
      await supabase.from('notificaciones').update({ leido: true }).eq('id', notifId)
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, leido: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  // --- Gallery functions ---
  function getMaxPhotos(): number {
    if (!tech) return 0
    if (tech.plan === 'elite') return 999
    if (tech.plan === 'premium') return 8
    return 3 // profesional/starter
  }

  async function pickAndUploadProfilePhoto() {
    if (!tech) return
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.[0]) return
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop() || 'jpg'
      const fileName = `profile_${tech.id}_${Date.now()}.${ext}`
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const { error: uploadError } = await supabase.storage.from('fotos').upload(fileName, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(fileName)
      await supabase.from('tecnicos').update({ foto_url: urlData.publicUrl }).eq('id', tech.id)
      setTech({ ...tech, foto_url: urlData.publicUrl })
      Alert.alert('Listo', 'Foto de perfil actualizada')
    } catch (err) {
      Alert.alert('Error', 'No se pudo subir la foto')
    }
  }

  async function pickAndUploadImage() {
    if (!tech) return
    const maxPhotos = getMaxPhotos()
    if (galleryImages.length >= maxPhotos) {
      return Alert.alert('Límite alcanzado', `Tu plan permite máximo ${maxPhotos} fotos. Elimina alguna o mejora tu plan.`)
    }

    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos.')
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })

    if (result.canceled || !result.assets?.[0]) return

    setUploadingImage(true)
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop() || 'jpg'
      const fileName = `tech_${tech.id}_${Date.now()}.${ext}`

      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('fotos')
        .upload(`galeria/${fileName}`, blob, { contentType: `image/${ext}`, upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(`galeria/${fileName}`)
      const publicUrl = urlData.publicUrl

      const newGaleria = [...galleryImages, publicUrl]
      const { error: updateError } = await supabase.from('tecnicos').update({ galeria: newGaleria }).eq('id', tech.id)
      if (updateError) throw updateError

      setGalleryImages(newGaleria)
      setTech({ ...tech, galeria: newGaleria })
      Alert.alert('Subida exitosa', 'La foto se agregó a tu galería.')
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo subir la imagen: ' + (err?.message || 'Intenta de nuevo'))
    } finally {
      setUploadingImage(false)
    }
  }

  async function deleteGalleryImage(imageUrl: string) {
    if (!tech) return
    Alert.alert('Eliminar foto', '¿Seguro que quieres eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            // Extract file path from URL
            const pathMatch = imageUrl.match(/galeria\/[^?]+/)
            if (pathMatch) {
              await supabase.storage.from('fotos').remove([pathMatch[0]])
            }
            const newGaleria = galleryImages.filter(url => url !== imageUrl)
            await supabase.from('tecnicos').update({ galeria: newGaleria }).eq('id', tech.id)
            setGalleryImages(newGaleria)
            setTech({ ...tech, galeria: newGaleria })
          } catch (err: any) {
            Alert.alert('Error', 'No se pudo eliminar: ' + (err?.message || 'Intenta de nuevo'))
          }
        }
      },
    ])
  }

  // --- Document upload ---
  async function pickAndUploadDoc(tipo: 'antecedentes_penales' | 'antecedentes_policiales' | 'certificado_estudios') {
    if (!tech) return
    const TIPO_LABELS: Record<string, string> = {
      antecedentes_penales: 'Antecedentes Penales',
      antecedentes_policiales: 'Antecedentes Policiales',
      certificado_estudios: 'Certificado de Estudios',
    }
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir documentos.')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.[0]) return
    setUploadingDoc(tipo)
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop() || 'jpg'
      const type = `image/${ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpeg'}`
      
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: `doc_${tech.id}_${tipo}.${ext}`,
        type,
      } as any)
      formData.append('tipo', tipo)
      formData.append('tecnicoId', String(tech.id))

      const uploadRes = await fetch(`${ENV.API_BASE_URL}/upload-doc`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (!uploadRes.ok) {
        throw new Error('Error al subir documento en el servidor')
      }

      const resData = await uploadRes.json()
      if (resData.error) throw new Error(resData.error)

      const pubUrl = resData.url

      const ESTADO_FIELD: Record<string, string> = {
        antecedentes_penales: 'antecedentes_penales_estado',
        antecedentes_policiales: 'antecedentes_policiales_estado',
        certificado_estudios: 'certificado_estudios_estado',
      }
      const URL_FIELD: Record<string, string> = {
        antecedentes_penales: 'antecedentes_penales_url',
        antecedentes_policiales: 'antecedentes_policiales_url',
        certificado_estudios: 'certificado_estudios_url',
      }
      
      setTech({ ...tech, [URL_FIELD[tipo]]: pubUrl, [ESTADO_FIELD[tipo]]: 'pendiente' } as any)
      Alert.alert('¡Documento subido!', `Tu ${TIPO_LABELS[tipo]} fue enviado para revisión. El equipo de SOLU lo verificará en 24-48 horas.`)
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo subir el documento: ' + (err?.message || 'Intenta de nuevo'))
    } finally {
      setUploadingDoc(null)
    }
  }

  // --- Cotizacion functions ---
  async function createCotizacion() {
    if (!tech) return
    if (!cotLeadId || !cotMonto || !cotDescripcion) {
      return Alert.alert('Error', 'Completa todos los campos')
    }
    const selectedLead = leads.find(l => l.id === parseInt(cotLeadId))
    if (!selectedLead) {
      return Alert.alert('Error', 'Selecciona un lead válido')
    }

    setSavingCotizacion(true)
    try {
      const { error } = await supabase.from('cotizaciones').insert({
        tecnico_id: tech.id,
        cliente_id: selectedLead.id,
        servicio: cotServicio || selectedLead.servicio,
        descripcion: cotDescripcion,
        monto: parseFloat(cotMonto),
        estado: 'pendiente',
        codigo_solicitud: selectedLead.codigo,
        cliente_nombre: selectedLead.nombre,
        cliente_whatsapp: selectedLead.whatsapp,
      })

      if (error) throw error

      // Auto-notify client via WhatsApp
      const waMsg = `Hola ${selectedLead.nombre}, soy ${tech.nombre} de SOLU. Te envío una cotización por ${cotServicio || selectedLead.servicio}:\n\n💰 Monto: S/${cotMonto}\n📝 ${cotDescripcion}\n\nCódigo: ${selectedLead.codigo}\n\n¿Aceptas la cotización?`
      Linking.openURL(`https://wa.me/51${selectedLead.whatsapp}?text=${encodeURIComponent(waMsg)}`)

      Alert.alert('Cotización enviada', 'Se abrió WhatsApp para notificar al cliente.')
      setShowNewCotizacion(false)
      setCotLeadId('')
      setCotMonto('')
      setCotDescripcion('')
      setCotServicio('')
      // Reload
      const { data: cotData } = await supabase.from('cotizaciones').select('*').eq('tecnico_id', tech.id).order('created_at', { ascending: false }).limit(30)
      setCotizaciones(cotData || [])
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo crear: ' + (err?.message || 'Intenta de nuevo'))
    } finally {
      setSavingCotizacion(false)
    }
  }

  const daysLeft = tech?.fecha_vencimiento
    ? Math.max(0, Math.ceil((new Date(tech.fecha_vencimiento).getTime() - Date.now()) / 86400000))
    : 0
  const isExpired = tech?.fecha_vencimiento
    ? new Date(tech.fecha_vencimiento).getTime() < Date.now()
    : false

  // Stats
  const thisMonthLeads = leads.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const completedLeads = leads.filter(l => l.estado === 'Completado' || l.estado === 'Calificado').length
  const activeLeads = leads.filter(l => l.estado !== 'Completado' && l.estado !== 'Calificado' && l.estado !== 'Cancelado').length

  // LOGIN SCREEN
  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 28, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          {/* Logo SOLU */}
          <View style={{ width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20, overflow: 'hidden' }}>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff' }}>S</Text>
            </View>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 4 }}>Bienvenido, Técnico</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 28 }}>Ingresa para gestionar tus servicios</Text>

          <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Email o WhatsApp</Text>
          <TextInput
            placeholder="correo@email.com o 999888777"
            value={loginId}
            onChangeText={setLoginId}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, fontSize: 16, marginBottom: 14, fontWeight: '700', color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            placeholderTextColor="rgba(255,255,255,0.3)"
          />

          <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Contraseña</Text>
          <View style={{ position: 'relative', marginBottom: 6 }}>
            <TextInput
              placeholder="Tu contraseña"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry={!showLoginPassword}
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, paddingRight: 52, fontSize: 16, fontWeight: '700', color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TouchableOpacity
              onPress={() => setShowLoginPassword(!showLoginPassword)}
              style={{ position: 'absolute', right: 16, top: 18 }}
            >
              <Ionicons name={showLoginPassword ? 'eye-off' : 'eye'} size={22} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/recuperar')}
            style={{ alignSelf: 'flex-end', marginBottom: 20 }}
          >
            <Text style={{ fontSize: 12, color: '#EA580C', fontWeight: '700' }}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={doLogin}
            disabled={loading}
            style={{ backgroundColor: '#EA580C', borderRadius: 18, padding: 18, alignItems: 'center', shadowColor: '#EA580C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>{loading ? 'Verificando...' : 'INGRESAR'}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 4 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>¿No tienes cuenta?</Text>
            <TouchableOpacity onPress={() => router.push('/registro')}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C' }}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
        <LegalSection router={router} />
      </View>
    )
  }

  if (!tech) return null

  const level = getTechLevel(tech.servicios_completados)
  const planInfo = PLAN_FEATURES[tech.plan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.profesional

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" />}
      >
        {/* Header Premium */}
        <View style={{ backgroundColor: '#1A1A2E', padding: 24, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={pickAndUploadProfilePhoto} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}>
                {tech.foto_url ? (
                  <Image source={{ uri: tech.foto_url }} style={{ width: 48, height: 48 }} />
                ) : (
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>{tech.nombre?.[0] || 'S'}</Text>
                )}
              </TouchableOpacity>
              <View>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Bienvenido</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>{tech.nombre}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => Share.share({ message: `Soy ${tech.nombre}, ${tech.oficio} verificado en SOLU. Mira mi perfil: https://solu.pe/tecnico/${tech.id}`, title: `${tech.nombre} - SOLU` })}
                style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowNotifications(true)}
                style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.7)" />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#1A1A2E' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Salir', style: 'destructive', onPress: () => { AsyncStorage.removeItem('solu_tech_session'); setLoggedIn(false); setTech(null); setTab('dashboard') } },
                ])}
                style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard value={`★ ${tech.calificacion?.toFixed(1) || '0.0'}`} label="Rating" />
            <StatCard value={String(tech.num_resenas || 0)} label="Reseñas" />
            <StatCard value={String(tech.servicios_completados || 0)} label="Servicios" />
            <StatCard value={`${daysLeft}d`} label={isExpired ? 'Vencido' : 'Restantes'} expired={isExpired} />
          </View>

          {/* Plan badge */}
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(234,88,12,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: isExpired ? '#FCA5A5' : '#F97316' }}>
                {level.emoji} {level.name} · Plan {tech.plan?.toUpperCase() || 'TRIAL'}
              </Text>
            </View>
            {tech.verificado && (
              <View style={{ backgroundColor: 'rgba(16,185,129,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#34D399' }}>✅ Verificado</Text>
              </View>
            )}
          </View>
        </View>

        {/* Expired alert */}
        {isExpired && (
          <View style={{ margin: 16, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>⚠️ Tu plan venció</Text>
            <Text style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>Tu perfil sigue visible pero perdiste prioridad y beneficios. Renueva para recibir más clientes.</Text>
            <TouchableOpacity onPress={() => setTab('plan')} style={{ backgroundColor: '#DC2626', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Renovar ahora</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan expiring soon warning */}
        {!isExpired && daysLeft > 0 && daysLeft <= 7 && (
          <View style={{ margin: 16, marginBottom: 0, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>⏰ Tu plan vence en {daysLeft} día{daysLeft > 1 ? 's' : ''}</Text>
            <Text style={{ fontSize: 11, color: '#78350F', marginTop: 4 }}>Renueva para no perder tu posición y seguir recibiendo clientes.</Text>
            <TouchableOpacity onPress={() => setTab('plan')} style={{ backgroundColor: '#F59E0B', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Renovar ahora</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                backgroundColor: tab === t.key ? '#1E3A5F' : '#fff',
                marginRight: 6, borderWidth: 1,
                borderColor: tab === t.key ? '#1E3A5F' : '#E2E8F0',
              }}
            >
              <Ionicons name={t.icon as any} size={14} color={tab === t.key ? '#fff' : COLORS.gray} />
              <Text style={{ fontWeight: '700', fontSize: 11, color: tab === t.key ? '#fff' : COLORS.gray }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ padding: 16, paddingTop: 4 }}>

          {/* ═══ DASHBOARD ═══ */}
          {tab === 'dashboard' && (
            <View style={{ gap: 12 }}>
              {/* Quick stats */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>Resumen del mes</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <QuickStat icon="trending-up" color="#2563EB" value={String(thisMonthLeads)} label="Solicitudes" />
                  <QuickStat icon="checkmark-circle" color={COLORS.green} value={String(completedLeads)} label="Completados" />
                  <QuickStat icon="time" color={COLORS.pri} value={String(activeLeads)} label="Activos" />
                </View>
              </View>

              {/* Profile views */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="eye-outline" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.dark }}>{profileViews}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray }}>Vistas a tu perfil esta semana</Text>
                </View>
                <TouchableOpacity onPress={() => Share.share({ message: `Soy ${tech.nombre}, ${tech.oficio} verificado en SOLU. Mira mi perfil: https://solu.pe/tecnico/${tech.id}` })} style={{ backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Compartir</Text>
                </TouchableOpacity>
              </View>

              {/* Level progress */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 28 }}>{level.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{level.name}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.gray }}>{tech.servicios_completados} servicios completados</Text>
                  </View>
                </View>
                <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: '100%', backgroundColor: level.color, borderRadius: 4, width: `${Math.min(getTechLevelProgress(tech.servicios_completados) * 100, 100)}%` }} />
                </View>
                {(() => {
                  const idx = LEVELS.indexOf(level)
                  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
                  return next ? (
                    <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 6 }}>
                      {next.min - tech.servicios_completados} servicios más para {next.emoji} {next.name}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 6 }}>Nivel máximo alcanzado 🎉</Text>
                  )
                })()}
              </View>

              {/* Achievements */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Logros</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 12 }}>
                  {ACHIEVEMENTS.filter(a => a.check(tech)).length}/{ACHIEVEMENTS.length} desbloqueados
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ACHIEVEMENTS.map((a) => {
                    const unlocked = a.check(tech)
                    return (
                      <View key={a.id} style={{ width: '22%', alignItems: 'center', opacity: unlocked ? 1 : 0.3, padding: 4 }}>
                        <Text style={{ fontSize: 22 }}>{unlocked ? a.emoji : '🔒'}</Text>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: COLORS.dark, textAlign: 'center', marginTop: 2 }}>{a.name}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* Today's calendar */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="calendar" size={18} color="#2563EB" />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Agenda de hoy</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(`https://solu.pe/api/calendar-sync?tecnicoId=${tech.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color="#2563EB" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>Sincronizar</Text>
                  </TouchableOpacity>
                </View>
                {(() => {
                  const today = new Date().toISOString().split('T')[0]
                  const todayLeads = leads.filter(l => {
                    const d = l.created_at?.split('T')[0]
                    return (l.estado === 'Asignado' || l.estado === 'En camino' || l.estado === 'En proceso') && d === today
                  })
                  if (todayLeads.length === 0) {
                    return (
                      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                        <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark, marginTop: 8 }}>Sin citas para hoy</Text>
                        <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 2 }}>Tu agenda está libre</Text>
                      </View>
                    )
                  }
                  return todayLeads.map(l => (
                    <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: l.estado === 'En proceso' ? '#F97316' : l.estado === 'En camino' ? '#8B5CF6' : '#2563EB' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{l.nombre}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.gray }}>{l.servicio} · {l.distrito}</Text>
                      </View>
                      <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>{l.estado}</Text>
                      </View>
                    </View>
                  ))
                })()}
              </View>

              {/* Recent leads preview */}
              {leads.length > 0 && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Últimas solicitudes</Text>
                    <TouchableOpacity onPress={() => setTab('servicios')}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>Ver todas →</Text>
                    </TouchableOpacity>
                  </View>
                  {leads.slice(0, 3).map((l) => (
                    <LeadRow key={l.id} lead={l} tech={tech} router={router} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ═══ PROMOCIONES (Premium/Elite in dashboard) ═══ */}
          {tab === 'dashboard' && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: -4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Mis promociones</Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.prompt ? Alert.prompt('Nueva promoción', 'Describe tu descuento (ej: 20% en gasfitería)', async (text) => {
                      if (text) {
                        await supabase.from('promociones').insert({
                          tecnico_id: tech.id, descripcion: text, activa: true,
                          descuento: 10, tecnico_nombre: tech.nombre,
                        })
                        Alert.alert('Promoción creada', 'Tu promoción ya está visible para los clientes')
                      }
                    }) : Alert.alert('Crear promoción', 'Para crear una promoción, describe tu descuento y se publicará a los clientes.\n\nEjemplo: "20% de descuento en gasfitería esta semana"', [
                      { text: 'Cancelar' },
                      { text: 'Crear', onPress: async () => {
                        await supabase.from('promociones').insert({
                          tecnico_id: tech.id, descripcion: `Descuento especial de ${tech.nombre}`,
                          activa: true, descuento: 10, tecnico_nombre: tech.nombre,
                        })
                        Alert.alert('Promoción creada', 'Tu promoción ya está visible')
                      }},
                    ])
                  }}
                  style={{ backgroundColor: COLORS.pri, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>Nueva</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: COLORS.gray }}>
                {tech.plan === 'premium' ? 'Plan Premium: 1 promoción activa por mes' : 'Plan Elite: Promociones ilimitadas'}
              </Text>
            </View>
          )}

          {/* ═══ TARJETA DIGITAL ═══ */}
          {tab === 'dashboard' && (
            <View style={{ backgroundColor: '#1A1A2E', borderRadius: 20, padding: 20, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(234,88,12,0.15)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {tech.foto_url ? <Image source={{ uri: tech.foto_url }} style={{ width: 50, height: 50 }} /> : <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>{tech.nombre?.[0]}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{tech.nombre}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{tech.oficio} · {tech.distrito}</Text>
                </View>
                {tech.verificado && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>WhatsApp</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{tech.whatsapp}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Precio desde</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C' }}>S/{tech.precio_desde || '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Rating</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>★ {tech.calificacion?.toFixed(1) || '0.0'}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => Share.share({
                  message: `🔧 ${tech.nombre}\n${tech.oficio} verificado en SOLU\n\n📍 ${tech.distrito}\n💰 Desde S/${tech.precio_desde || '—'}\n⭐ ${tech.calificacion?.toFixed(1) || '0.0'} estrellas\n📱 ${tech.whatsapp}\n\n👉 Ver perfil: https://solu.pe/tecnico/${tech.id}`,
                })}
                style={{ backgroundColor: '#EA580C', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Compartir mi tarjeta digital</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ SERVICIOS ═══ */}
          {tab === 'servicios' && (
            <View style={{ gap: 12 }}>

              {/* Trabajos disponibles — solicitudes abiertas para aceptar */}
              {openRequests.length > 0 && (
                <View style={{ backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: '#10B981' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Ionicons name="flash" size={16} color="#10B981" />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Trabajos disponibles</Text>
                    <View style={{ backgroundColor: '#10B981', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{openRequests.length}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#065F46', marginBottom: 12 }}>Acepta rápido — el primero se lo queda</Text>
                  {openRequests.map((s) => (
                    <View key={s.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#D1FAE5' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>{s.cliente_nombre?.charAt(0)?.toUpperCase() || '?'}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{s.cliente_nombre}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.gray }}>{s.servicio} · {s.distrito}</Text>
                          </View>
                        </View>
                        {s.urgencia === 'emergencia' && (
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444' }}>URGENTE</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        disabled={acceptingId === s.id}
                        onPress={async () => {
                          setAcceptingId(s.id)
                          try {
                            const res = await fetch(`${ENV.API_BASE_URL}/solicitudes/${s.id}/accept`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ tecnicoId: tech?.id }),
                            })
                            const data = await res.json()
                            if (res.ok) {
                              Alert.alert('¡Trabajo aceptado!', `Contacta a ${s.cliente_nombre} por WhatsApp.`)
                              setOpenRequests(prev => prev.filter(r => r.id !== s.id))
                              if (tech) loadData(tech.id)
                            } else if (data.taken) {
                              Alert.alert('Ya tomado', 'Otro técnico fue más rápido.')
                              setOpenRequests(prev => prev.filter(r => r.id !== s.id))
                            } else {
                              Alert.alert('Error', data.error || 'No se pudo aceptar')
                            }
                          } catch {
                            Alert.alert('Error', 'Error de conexión')
                          } finally {
                            setAcceptingId(null)
                          }
                        }}
                        style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: acceptingId === s.id ? 0.5 : 1 }}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                          {acceptingId === s.id ? 'Aceptando...' : 'Aceptar trabajo'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Active */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Servicios activos</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 10 }}>Solicitudes pendientes y en proceso</Text>
                {leads.filter(l => l.estado !== 'Completado' && l.estado !== 'Calificado' && l.estado !== 'Cancelado').length === 0 ? (
                  <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 16, fontSize: 12 }}>No tienes servicios activos</Text>
                ) : (
                  leads.filter(l => l.estado !== 'Completado' && l.estado !== 'Calificado' && l.estado !== 'Cancelado').map((l) => (
                    <LeadRow key={l.id} lead={l} onStatusChange={() => tech && loadData(tech.id)} tech={tech} router={router} />
                  ))
                )}
              </View>

              {/* History */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Historial</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 10 }}>Servicios completados</Text>
                {leads.filter(l => l.estado === 'Completado' || l.estado === 'Calificado').length === 0 ? (
                  <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 16, fontSize: 12 }}>Sin historial aún</Text>
                ) : (
                  leads.filter(l => l.estado === 'Completado' || l.estado === 'Calificado').map((l) => (
                    <LeadRow key={l.id} lead={l} tech={tech} router={router} />
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══ RESEÑAS ═══ */}
          {tab === 'resenas' && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Mis reseñas</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 12 }}>Lo que dicen tus clientes</Text>
              {reviews.length === 0 ? (
                <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20, fontSize: 12 }}>Aún no tienes reseñas</Text>
              ) : (
                reviews.map((r) => (
                  <View key={r.id} style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{r.nombre_cliente}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons key={s} name="star" size={12} color={s <= r.calificacion ? '#F59E0B' : '#E2E8F0'} />
                        ))}
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.gray, fontStyle: 'italic' }}>"{r.comentario}"</Text>
                    <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 4 }}>{r.servicio} · {new Date(r.created_at).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══ PLAN ═══ */}
          {/* ═══ INGRESOS ═══ */}
          {tab === 'ingresos' && (
            <View style={{ gap: 12 }}>
              {/* Summary cards */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.dark }}>{completedLeads}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.gray, fontWeight: '600' }}>Completados</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.pri }}>S/{completedLeads * (tech.precio_desde || 80)}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.gray, fontWeight: '600' }}>Ingresos est.</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' }}>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#F59E0B' }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
                  <Text style={{ fontSize: 10, color: COLORS.gray, fontWeight: '600' }}>Calificación</Text>
                </View>
              </View>

              {/* Conversion rate & projections */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>Rendimiento</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#10B981' }}>{leads.length > 0 ? Math.round((completedLeads / leads.length) * 100) : 0}%</Text>
                    <Text style={{ fontSize: 9, color: '#065F46', fontWeight: '600', marginTop: 2 }}>Tasa de conversión</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#2563EB' }}>S/{Math.round(completedLeads * (tech.precio_desde || 80) * 12 / Math.max(leads.length > 0 ? (new Set(leads.map(l => new Date(l.created_at).getMonth())).size) : 1, 1))}</Text>
                    <Text style={{ fontSize: 9, color: '#1E40AF', fontWeight: '600', marginTop: 2 }}>Proyección mensual</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#92400E' }}>{profileViews}</Text>
                    <Text style={{ fontSize: 9, color: '#78350F', fontWeight: '600', marginTop: 2 }}>Vistas esta semana</Text>
                  </View>
                </View>
              </View>

              {/* Monthly breakdown */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>Últimos 6 meses</Text>
                {(() => {
                  const months: { label: string; count: number }[] = []
                  for (let i = 5; i >= 0; i--) {
                    const d = new Date()
                    d.setMonth(d.getMonth() - i)
                    const m = d.getMonth()
                    const y = d.getFullYear()
                    const count = leads.filter(l => {
                      const ld = new Date(l.created_at)
                      return ld.getMonth() === m && ld.getFullYear() === y && (l.estado === 'Completado' || l.estado === 'Calificado')
                    }).length
                    months.push({ label: d.toLocaleDateString('es-PE', { month: 'short' }), count })
                  }
                  const maxCount = Math.max(...months.map(m => m.count), 1)
                  return months.map((m, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Text style={{ width: 35, fontSize: 11, fontWeight: '600', color: COLORS.gray, textTransform: 'capitalize' }}>{m.label}</Text>
                      <View style={{ flex: 1, height: 24, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
                        <View style={{ width: `${(m.count / maxCount) * 100}%`, height: '100%', backgroundColor: COLORS.pri, borderRadius: 6, minWidth: m.count > 0 ? 20 : 0, justifyContent: 'center', paddingLeft: 6 }}>
                          {m.count > 0 && <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{m.count}</Text>}
                        </View>
                      </View>
                    </View>
                  ))
                })()}
              </View>

              {/* Premium/Elite: Monthly trend */}
              {(tech.plan === 'premium' || tech.plan === 'elite') && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Tendencia</Text>
                  {(() => {
                    const thisM = leads.filter(l => { const d = new Date(l.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length
                    const lastM = leads.filter(l => { const d = new Date(l.created_at); const n = new Date(); n.setMonth(n.getMonth() - 1); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length
                    const diff = thisM - lastM
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name={diff >= 0 ? 'trending-up' : 'trending-down'} size={24} color={diff >= 0 ? '#10B981' : '#EF4444'} />
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: diff >= 0 ? '#10B981' : '#EF4444' }}>
                            {diff >= 0 ? '+' : ''}{diff} solicitudes vs mes anterior
                          </Text>
                          <Text style={{ fontSize: 11, color: COLORS.gray }}>Este mes: {thisM} · Mes anterior: {lastM}</Text>
                        </View>
                      </View>
                    )
                  })()}
                </View>
              )}

              {/* Elite: Best services */}
              {tech.plan === 'elite' && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Servicios más solicitados</Text>
                  {(() => {
                    const serviceCounts: Record<string, number> = {}
                    leads.forEach(l => { serviceCounts[l.servicio] = (serviceCounts[l.servicio] || 0) + 1 })
                    const top = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
                    return top.length > 0 ? top.map(([svc, count], i) => (
                      <View key={svc} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < top.length - 1 ? 1 : 0, borderBottomColor: '#F1F5F9' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark }}>{svc}</Text>
                        <View style={{ backgroundColor: COLORS.pri + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.pri }}>{count}</Text>
                        </View>
                      </View>
                    )) : <Text style={{ fontSize: 12, color: COLORS.gray2 }}>Sin datos aún</Text>
                  })()}
                </View>
              )}

              {/* Info */}
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14 }}>
                <Text style={{ fontSize: 11, color: '#1E40AF', lineHeight: 16 }}>
                  {tech.plan === 'elite' ? 'Estadísticas avanzadas: tendencia, servicios top y desglose mensual.' :
                   tech.plan === 'premium' ? 'Estadísticas detalladas: tendencia mensual y desglose. Mejora a Elite para ver servicios más solicitados.' :
                   'Estadísticas básicas. Mejora tu plan para ver tendencias y análisis detallado.'}
                </Text>
              </View>
            </View>
          )}

          {/* ═══ PLAN ═══ */}
          {tab === 'plan' && (
            <View style={{ gap: 12 }}>
              {/* Current plan status */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Tu plan actual</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: isExpired ? '#FEE2E2' : '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontWeight: '800', color: isExpired ? '#EF4444' : '#1E3A5F' }}>{planInfo?.name || 'Profesional'}</Text>
                  </View>
                  {isExpired ? (
                    <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>Vencido</Text>
                  ) : daysLeft > 0 ? (
                    <Text style={{ fontSize: 11, color: daysLeft <= 7 ? '#F59E0B' : COLORS.gray2 }}>
                      {daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
                    </Text>
                  ) : null}
                </View>
                {tech.fecha_vencimiento && (
                  <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 6 }}>
                    Vigente hasta: {new Date(tech.fecha_vencimiento).toLocaleDateString('es-PE')}
                  </Text>
                )}
                <View style={{ marginTop: 12 }}>
                  {(planInfo?.features || []).map((f: string, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                      <Text style={{ fontSize: 12, color: COLORS.dark }}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Expired warning */}
              {isExpired && (
                <View style={{ backgroundColor: '#FEF3C7', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FDE68A' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 }}>Tu plan ha vencido</Text>
                  <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                    Renueva para seguir apareciendo en las búsquedas y recibir solicitudes de clientes.
                  </Text>
                </View>
              )}

              {/* Renew / Change plan - only shown when expired */}
              {isExpired && (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>
                    Renovar plan
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 12 }}>
                    Tu plan anterior: {planInfo?.name}. Puedes renovarlo o elegir otro.
                  </Text>

                  {(['profesional', 'premium', 'elite'] as const).map((planKey) => {
                    const plan = PLAN_FEATURES[planKey]
                    const isCurrent = planKey === tech.plan
                    return (
                      <View key={planKey} style={{
                        backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8,
                        borderWidth: isCurrent ? 2 : 1, borderColor: isCurrent ? COLORS.pri : '#E2E8F0',
                      }}>
                        {isCurrent && (
                          <View style={{ backgroundColor: COLORS.pri, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6 }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>TU PLAN</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>{plan.name}</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.pri }}>S/{plan.price}/mes</Text>
                        </View>
                        {plan.features.filter(f => !f.includes('Primer mes')).map((f, i) => (
                          <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                            <Ionicons name="checkmark" size={12} color={COLORS.green} />
                            <Text style={{ fontSize: 11, color: COLORS.gray }}>{f}</Text>
                          </View>
                        ))}
                        {/* Payment button — Flow handles tarjeta, Yape y PagoEfectivo */}
                        <TouchableOpacity
                          disabled={subscribingTo === planKey}
                          onPress={() => handleSubscribe(planKey)}
                          style={{ backgroundColor: isCurrent ? COLORS.pri : '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: subscribingTo === planKey ? 0.7 : 1 }}
                        >
                          {subscribingTo === planKey ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="card-outline" size={18} color="#fff" />
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{isCurrent ? `Renovar S/${plan.price}` : `Pagar S/${plan.price}/mes`}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <Text style={{ fontSize: 9, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>Acepta tarjeta, Yape y PagoEfectivo</Text>
                      </View>
                    )
                  })}
                </View>
              )}

              {/* Elite: Digital Certificate */}
              {tech.plan === 'elite' && !isExpired && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://solu.pe/api/certificado?tecnicoId=${tech.id}`)}
                  style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#FFD700' }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="ribbon" size={24} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Certificado Digital SOLU</Text>
                    <Text style={{ fontSize: 11, color: COLORS.gray }}>Descarga tu certificado de técnico verificado</Text>
                  </View>
                  <Ionicons name="download-outline" size={20} color={COLORS.pri} />
                </TouchableOpacity>
              )}

              {/* Active plan - no changes allowed */}
              {!isExpired && (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontSize: 11, color: '#065F46', lineHeight: 16 }}>
                    Tu plan está activo. Cuando se acerque la fecha de vencimiento podrás renovar o cambiar de plan.
                  </Text>
                </View>
              )}

              {/* Auto-renewal info */}
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#BFDBFE' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="information-circle" size={18} color="#2563EB" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF' }}>Membresía Automática con Flow</Text>
                </View>
                <Text style={{ fontSize: 12, color: '#1E40AF', lineHeight: 18 }}>
                  Tu plan se activará al momento o se renovará automáticamente usando el sistema seguro Flow. Podrás cancelarlo cuando quieras.
                </Text>
              </View>

              {/* Payment history */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="receipt-outline" size={18} color={COLORS.dark} />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Historial de pagos</Text>
                </View>
                {pagos.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <Ionicons name="wallet-outline" size={32} color={COLORS.gray2} />
                    <Text style={{ fontSize: 12, color: COLORS.gray2, marginTop: 8 }}>Sin pagos registrados</Text>
                  </View>
                ) : (
                  pagos.map((pago: any) => {
                    const methodColors: Record<string, string> = { culqi: '#7C3AED', yape: '#9333EA', tarjeta: '#2563EB' }
                    const methodColor = methodColors[pago.metodo] || COLORS.gray
                    return (
                      <View key={pago.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: methodColor + '15', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={pago.metodo === 'yape' ? 'phone-portrait' : 'card'} size={18} color={methodColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>
                            Plan {pago.plan ? pago.plan.charAt(0).toUpperCase() + pago.plan.slice(1) : 'N/A'}
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.gray }}>
                            {new Date(pago.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })} · {pago.metodo || 'N/A'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#10B981' }}>S/{pago.monto || '0'}</Text>
                      </View>
                    )
                  })
                )}
              </View>
            </View>
          )}

          {/* ═══ COTIZACIONES ═══ */}
          {tab === 'cotizaciones' && (
            <View style={{ gap: 12 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Mis cotizaciones</Text>
                    <Text style={{ fontSize: 11, color: COLORS.gray }}>Presupuestos enviados a clientes</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowNewCotizacion(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E3A5F', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Nueva</Text>
                  </TouchableOpacity>
                </View>

                {cotizaciones.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20, fontSize: 12 }}>No tienes cotizaciones aún</Text>
                ) : (
                  cotizaciones.map((cot) => {
                    const statusColors: Record<string, string> = { pendiente: '#F59E0B', aceptada: '#10B981', rechazada: '#EF4444' }
                    const color = statusColors[cot.estado] || COLORS.gray
                    return (
                      <View key={cot.id} style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{cot.cliente_nombre || 'Cliente'}</Text>
                          <View style={{ backgroundColor: color + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color }}>{cot.estado}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: COLORS.gray }}>{cot.servicio}</Text>
                        {cot.descripcion ? <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 2 }}>{cot.descripcion}</Text> : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E3A5F' }}>S/{cot.monto}</Text>
                          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>{new Date(cot.created_at).toLocaleDateString()}</Text>
                        </View>
                      </View>
                    )
                  })
                )}
              </View>

              {/* New cotizacion form modal */}
              <Modal visible={showNewCotizacion} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                  <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark }}>Nueva cotización</Text>
                      <TouchableOpacity onPress={() => setShowNewCotizacion(false)}>
                        <Ionicons name="close" size={24} color={COLORS.gray} />
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Seleccionar cliente</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 44 }}>
                      {leads.map((l) => (
                        <TouchableOpacity
                          key={l.id}
                          onPress={() => { setCotLeadId(String(l.id)); setCotServicio(l.servicio) }}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginRight: 6,
                            backgroundColor: cotLeadId === String(l.id) ? '#1E3A5F' : '#F1F5F9',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: cotLeadId === String(l.id) ? '#fff' : COLORS.dark }}>
                            {l.nombre}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Servicio</Text>
                    <TextInput
                      value={cotServicio}
                      onChangeText={setCotServicio}
                      placeholder="Ej: Reparación de tubería"
                      style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 12 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Monto (S/)</Text>
                    <TextInput
                      value={cotMonto}
                      onChangeText={setCotMonto}
                      placeholder="150"
                      keyboardType="numeric"
                      style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 12 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Descripción</Text>
                    <TextInput
                      value={cotDescripcion}
                      onChangeText={setCotDescripcion}
                      placeholder="Detalle del trabajo y materiales..."
                      multiline
                      numberOfLines={3}
                      style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 16, textAlignVertical: 'top', minHeight: 80 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <TouchableOpacity
                      onPress={createCotizacion}
                      disabled={savingCotizacion}
                      style={{ backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                        {savingCotizacion ? 'Creando...' : 'Crear cotización'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </View>
          )}

          {/* ═══ PERFIL (Editable) ═══ */}
          {tab === 'perfil' && (
            <View style={{ gap: 12 }}>
              {/* Profile photo */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={pickAndUploadProfilePhoto} style={{ alignItems: 'center' }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
                    {tech.foto_url ? (
                      <Image source={{ uri: tech.foto_url }} style={{ width: 80, height: 80 }} />
                    ) : (
                      <Text style={{ fontSize: 32, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.[0]}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="camera-outline" size={14} color="#2563EB" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>Cambiar foto de perfil</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Mi perfil</Text>
                  {!editing ? (
                    <TouchableOpacity onPress={() => setEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                      <Ionicons name="create-outline" size={14} color="#2563EB" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Editar</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => setEditing(false)} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveProfile} disabled={savingProfile} style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{savingProfile ? 'Guardando...' : 'Guardar'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <InfoRow label="Nombre" value={tech.nombre} />
                <InfoRow label="Oficio" value={tech.oficio} />
                <InfoRow label="Distrito" value={tech.distrito} />
                <InfoRow label="WhatsApp" value={tech.whatsapp} />
                <InfoRow label="Email" value={tech.email || 'No registrado'} />
                <InfoRow label="Verificado" value={tech.verificado ? 'Sí ✅' : 'Pendiente ⏳'} />

                {/* Editable fields */}
                {editing ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Descripción</Text>
                    <TextInput
                      value={editDesc}
                      onChangeText={setEditDesc}
                      multiline
                      numberOfLines={3}
                      placeholder="Ej: Gasfitero con 10 años de experiencia..."
                      style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12, textAlignVertical: 'top', minHeight: 70 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Precio base (S/)</Text>
                    <TextInput
                      value={editPrecio}
                      onChangeText={setEditPrecio}
                      keyboardType="numeric"
                      placeholder="60"
                      style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark }}>Disponible para trabajar</Text>
                      <Switch
                        value={editDisponible}
                        onValueChange={setEditDisponible}
                        trackColor={{ false: '#E2E8F0', true: '#86EFAC' }}
                        thumbColor={editDisponible ? COLORS.green : '#94A3B8'}
                      />
                    </View>

                    {/* Oficios editor */}
                    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Mis servicios/oficios</Text>
                      {editOficios.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {editOficios.map((o, i) => (
                            <TouchableOpacity key={o} onPress={() => setEditOficios(editOficios.filter((_, idx) => idx !== i))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: i === 0 ? '#1E3A5F' : '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: i === 0 ? '#fff' : '#1E3A5F' }}>{o}</Text>
                              <Ionicons name="close-circle" size={12} color={i === 0 ? 'rgba(255,255,255,0.7)' : '#1E3A5F'} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity onPress={() => setShowOficiosPicker(!showOficiosPicker)} style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                        <Text style={{ fontSize: 12, color: COLORS.gray2 }}>{editOficios.length === 0 ? 'Seleccionar oficio' : '+ Agregar oficio'}</Text>
                      </TouchableOpacity>
                      {showOficiosPicker && (
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: 4, maxHeight: 180, borderWidth: 1, borderColor: COLORS.border }}>
                          <ScrollView nestedScrollEnabled>
                            {OFICIOS_LIST.filter(o => !editOficios.includes(o)).map(o => (
                              <TouchableOpacity key={o} onPress={() => { setEditOficios([...editOficios, o]); setShowOficiosPicker(false) }} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                <Text style={{ fontSize: 12, color: COLORS.dark }}>{o}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Zonas editor */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Zonas de cobertura</Text>
                      {editZonas.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {editZonas.map((z, i) => (
                            <TouchableOpacity key={z} onPress={() => setEditZonas(editZonas.filter((_, idx) => idx !== i))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: i === 0 ? '#1E3A5F' : '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: i === 0 ? '#fff' : '#1E3A5F' }}>{z}</Text>
                              <Ionicons name="close-circle" size={12} color={i === 0 ? 'rgba(255,255,255,0.7)' : '#1E3A5F'} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity onPress={() => setShowZonasPicker(!showZonasPicker)} style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                        <Text style={{ fontSize: 12, color: COLORS.gray2 }}>{editZonas.length === 0 ? 'Seleccionar distrito' : '+ Agregar distrito'}</Text>
                      </TouchableOpacity>
                      {showZonasPicker && (
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, marginTop: 4, maxHeight: 220, borderWidth: 1, borderColor: COLORS.border }}>
                          <TextInput placeholder="Buscar distrito..." placeholderTextColor={COLORS.gray2} value={zonaSearch} onChangeText={setZonaSearch} style={{ padding: 10, fontSize: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border }} autoFocus />
                          <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}>
                            {DISTRITOS.filter(d => !editZonas.includes(d) && (!zonaSearch || d.toLowerCase().includes(zonaSearch.toLowerCase()))).map(d => (
                              <TouchableOpacity key={d} onPress={() => { setEditZonas([...editZonas, d]); setZonaSearch(''); setShowZonasPicker(false) }} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                <Text style={{ fontSize: 12, color: COLORS.dark }}>{d}</Text>
                              </TouchableOpacity>
                            ))}
                            {zonaSearch.trim() && !DISTRITOS.some(d => d.toLowerCase() === zonaSearch.toLowerCase()) && (
                              <TouchableOpacity onPress={() => { setEditZonas([...editZonas, zonaSearch.trim()]); setZonaSearch(''); setShowZonasPicker(false) }} style={{ padding: 10, backgroundColor: '#EFF6FF' }}>
                                <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>+ Agregar "{zonaSearch.trim()}"</Text>
                              </TouchableOpacity>
                            )}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Documentos de verificación */}
                    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Documentos de verificación</Text>
                      <Text style={{ fontSize: 10, color: COLORS.gray2, marginBottom: 12 }}>Sube tus documentos para generar más confianza</Text>
                      {[
                        { key: 'antecedentes_penales', label: 'Antecedentes Penales (INPE)', icon: '🔍', field: 'antecedentes_penales_estado' },
                        { key: 'antecedentes_policiales', label: 'Antecedentes Policiales (PNP)', icon: '🛡️', field: 'antecedentes_policiales_estado' },
                        { key: 'certificado_estudios', label: 'Certificado de Estudios', icon: '📜', field: 'certificado_estudios_estado' },
                      ].map(doc => {
                        const estado = (tech as any)?.[doc.field] || 'no_subido'
                        return (
                          <View key={doc.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                              <Text style={{ fontSize: 18 }}>{doc.icon}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark }}>{doc.label}</Text>
                                <Text style={{ fontSize: 9, fontWeight: '600', color: estado === 'verificado' ? '#10B981' : estado === 'pendiente' ? '#F59E0B' : COLORS.gray2 }}>
                                  {estado === 'verificado' ? '✅ Verificado' : estado === 'pendiente' ? '⏳ En revisión' : 'No subido'}
                                </Text>
                              </View>
                            </View>
                            {estado !== 'verificado' && (
                              <TouchableOpacity
                                onPress={async () => {
                                  const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
                                  if (!permResult.granted) return Alert.alert('Permiso requerido', 'Necesitamos acceso a tus archivos.')
                                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
                                  if (result.canceled || !result.assets?.[0]) return
                                  try {
                                    const asset = result.assets[0]
                                    const formData = new FormData()
                                    formData.append('file', { uri: asset.uri, name: `${doc.key}_${tech.id}.jpg`, type: 'image/jpeg' } as any)
                                    formData.append('tipo', doc.key)
                                    formData.append('tecnicoId', String(tech.id))
                                    const res = await fetch(`${ENV.API_BASE_URL}/upload-doc`, { method: 'POST', body: formData })
                                    const data = await res.json()
                                    if (data.success) {
                                      Alert.alert('Documento subido', 'Lo revisaremos pronto y te notificaremos.')
                                      const { data: fresh } = await supabase.from('tecnicos').select('*').eq('id', tech.id).single()
                                      if (fresh) setTech(fresh)
                                    } else {
                                      Alert.alert('Error', data.error || 'No se pudo subir')
                                    }
                                  } catch { Alert.alert('Error', 'Error de conexión') }
                                }}
                                style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>{estado === 'pendiente' ? 'Resubir' : 'Subir'}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )
                      })}
                    </View>

                    {/* Gallery section */}
                    <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>Galería de trabajos</Text>
                          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>{galleryImages.length}/{getMaxPhotos()} fotos</Text>
                        </View>
                        <TouchableOpacity
                          onPress={pickAndUploadImage}
                          disabled={uploadingImage}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                        >
                          {uploadingImage ? (
                            <ActivityIndicator size="small" color="#2563EB" />
                          ) : (
                            <Ionicons name="camera-outline" size={16} color="#2563EB" />
                          )}
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>
                            {uploadingImage ? 'Subiendo...' : 'Subir foto'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {galleryImages.length > 0 ? (
                        <View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {galleryImages.map((url, i) => (
                              <View key={i} style={{ marginRight: 10, position: 'relative' }}>
                                <Image
                                  source={{ uri: url }}
                                  style={{ width: 140, height: 105, borderRadius: 12, backgroundColor: '#F1F5F9' }}
                                />
                                <TouchableOpacity
                                  onPress={() => deleteGalleryImage(url)}
                                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Ionicons name="close" size={12} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </ScrollView>
                          <TouchableOpacity
                            onPress={() => Share.share({ message: `Mira mis trabajos en SOLU: https://solu.pe/tecnico/${tech.id}` })}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 }}
                          >
                            <Ionicons name="share-social-outline" size={14} color="#2563EB" />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Compartir portafolio con clientes</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 20, alignItems: 'center' }}>
                          <Ionicons name="images-outline" size={28} color={COLORS.gray2} />
                          <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 6 }}>Sube fotos de tus trabajos para atraer más clientes</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <InfoRow label="Descripción" value={tech.descripcion || 'Sin descripción'} />
                    <InfoRow label="Precio desde" value={tech.precio_desde ? `S/${tech.precio_desde}` : 'No especificado'} />
                    <InfoRow label="Disponible" value={tech.disponible ? 'Sí ✅' : 'No ❌'} />
                    {tech.zonas && tech.zonas.length > 0 && (
                      <InfoRow label="Zonas" value={tech.zonas.join(', ')} />
                    )}
                  </View>
                )}
              </View>

              {/* ─── DOCUMENTOS DE VERIFICACIÓN ─── */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="shield-checkmark" size={18} color='#10B981' />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Documentos de seguridad</Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 14, lineHeight: 16 }}>
                  Sube tus documentos para que los clientes vean que eres un profesional confiable y verificado por SOLU.
                </Text>

                {([
                  { tipo: 'antecedentes_penales' as const,    label: 'Antecedentes Penales',    sub: 'Certificado INPE', icon: 'document-text' },
                  { tipo: 'antecedentes_policiales' as const,  label: 'Antecedentes Policiales', sub: 'Certificado PNP',  icon: 'shield' },
                  { tipo: 'certificado_estudios' as const,     label: 'Certificado de Estudios', sub: 'Título técnico',    icon: 'school' },
                ]).map((doc) => {
                  const estadoField = `${doc.tipo}_estado` as keyof typeof tech
                  const estado = ((tech as any)[estadoField]) || 'sin_subir'
                  const estadoColors: Record<string, string> = {
                    sin_subir: COLORS.gray2, pendiente: '#F59E0B', verificado: '#10B981', rechazado: '#EF4444'
                  }
                  const estadoLabels: Record<string, string> = {
                    sin_subir: 'Sin subir', pendiente: '⏳ En revisión', verificado: '✅ Verificado', rechazado: '❌ Rechazado'
                  }
                  const isUploading = uploadingDoc === doc.tipo
                  return (
                    <View key={doc.tipo} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
                    }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: estadoColors[estado] + '15', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={doc.icon as any} size={18} color={estadoColors[estado]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark }}>{doc.label}</Text>
                        <Text style={{ fontSize: 10, color: COLORS.gray }}>{doc.sub}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: estadoColors[estado], marginTop: 2 }}>
                          {estadoLabels[estado]}
                        </Text>
                      </View>
                      {estado !== 'verificado' && (
                        <TouchableOpacity
                          onPress={() => pickAndUploadDoc(doc.tipo)}
                          disabled={isUploading}
                          style={{
                            backgroundColor: isUploading ? '#F1F5F9' : COLORS.pri,
                            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                          }}
                        >
                          {isUploading ? (
                            <ActivityIndicator size="small" color={COLORS.pri} />
                          ) : (
                            <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                          )}
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isUploading ? COLORS.gray : '#fff' }}>
                            {isUploading ? 'Subiendo...' : estado === 'rechazado' ? 'Volver a subir' : 'Subir'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}

                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <Text style={{ fontSize: 10, color: '#065F46', lineHeight: 14 }}>
                    🔒 Tus documentos son revisados manualmente por el equipo de SOLU antes de mostrarse. Los clientes solo ven los badges de verificación, no el documento.
                  </Text>
                </View>
              </View>

              {/* Danger zone */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray, marginBottom: 8 }}>Cuenta</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Cerrar sesión', '¿Seguro?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', style: 'destructive', onPress: () => { AsyncStorage.removeItem('solu_tech_session'); setLoggedIn(false); setTech(null); setTab('dashboard') } },
                  ])}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}
                >
                  <Ionicons name="log-out-outline" size={18} color={COLORS.gray} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray }}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <LegalSection router={router} />
      </ScrollView>

      {/* Notifications Modal */}
      {tech && (
        <NotificationCenter
          visible={showNotifications}
          onClose={() => {
            setShowNotifications(false)
            if (tech) loadData(tech.id)
          }}
          techId={tech.id}
        />
      )}
    </View>
  )
}

function StatCard({ value, label, expired }: { value: string; label: string; expired?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: expired ? '#FCA5A5' : '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 10, color: expired ? '#FCA5A5' : 'rgba(255,255,255,0.4)', fontWeight: '700', marginTop: 3 }}>{label}</Text>
    </View>
  )
}

function QuickStat({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color + '12', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: color + '20' }}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.dark, marginTop: 6 }}>{value}</Text>
      <Text style={{ fontSize: 10, color: COLORS.gray2, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}

function LeadRow({ lead, onStatusChange, tech, router }: { lead: Cliente; onStatusChange?: () => void; tech?: Tecnico | null; router?: any }) {
  const statusColors: Record<string, string> = {
    Nuevo: '#2563EB', Asignado: '#F59E0B', 'En camino': '#8B5CF6',
    'En proceso': '#F97316', Completado: '#10B981', Calificado: '#10B981', Cancelado: '#EF4444',
  }
  const statusLabels: Record<string, string> = {
    Nuevo: 'Nuevo', Asignado: 'Asignado', 'En camino': 'En camino',
    'En proceso': 'En proceso', Completado: 'Completado', Calificado: 'Calificado', Cancelado: 'Cancelado',
  }
  const color = statusColors[lead.estado] || COLORS.gray
  const isActive = lead.estado !== 'Completado' && lead.estado !== 'Calificado' && lead.estado !== 'Cancelado'

  const NEXT_STATUS: Record<string, string> = {
    Asignado: 'En camino',
    'En camino': 'En proceso',
    'En proceso': 'Completado',
  }

  async function updateStatus(newStatus: string) {
    const { error } = await supabase.from('clientes').update({ estado: newStatus }).eq('id', lead.id)
    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado')
    } else {
      try {
        const msgs: Record<string, string> = { 'En camino': 'Tu técnico está en camino', 'En proceso': 'El técnico está trabajando', Completado: '¡Servicio completado!' }
        const waClean = (lead.whatsapp || '').replace(/\D/g, '')
        if (waClean) {
          sendPush('cliente', waClean, `Servicio ${newStatus}`, msgs[newStatus] || `Estado: ${newStatus}`).catch(() => {})
        }
      } catch {}
      // Live GPS streaming: on "En camino" start, on "En proceso"/"Completado" stop
      try {
        const { startLiveTracking, stopLiveTracking } = await import('../../src/lib/liveTracking')
        if (newStatus === 'En camino') {
          await startLiveTracking(lead.id)
        } else if (newStatus === 'En proceso' || newStatus === 'Completado' || newStatus === 'Cancelado') {
          stopLiveTracking()
        }
      } catch {}
      Alert.alert('Actualizado', `Estado cambiado a: ${newStatus}`)
      onStatusChange?.()
    }
  }

  async function cancelLead() {
    Alert.alert('Cancelar servicio', `¿Seguro que quieres cancelar el servicio de ${lead.nombre}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          await supabase.from('clientes').update({ estado: 'Cancelado' }).eq('id', lead.id)
          onStatusChange?.()
        },
      },
    ])
  }

  const nextStatus = NEXT_STATUS[lead.estado]

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4, borderLeftWidth: 4, borderLeftColor: color }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="build" size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>{lead.nombre}</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>{lead.servicio} · {lead.distrito}</Text>
          <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 1 }}>{lead.codigo} · {new Date(lead.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={{ backgroundColor: color + '18', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color }}>{statusLabels[lead.estado] || lead.estado}</Text>
        </View>
      </View>

      {lead.descripcion ? (
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: COLORS.gray, fontStyle: 'italic' }} numberOfLines={2}>"{lead.descripcion}"</Text>
        </View>
      ) : null}

      {/* Action buttons Premium */}
      {isActive && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {/* WhatsApp */}
          <TouchableOpacity
            onPress={() => {
              const msg = `Hola ${lead.nombre}, soy tu técnico de SOLU. Sobre tu solicitud de ${lead.servicio} (${lead.codigo}).`
              Linking.openURL(`https://wa.me/51${lead.whatsapp}?text=${encodeURIComponent(msg)}`)
            }}
            style={{ flex: 1, backgroundColor: '#25D366', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>WhatsApp</Text>
          </TouchableOpacity>

          {/* Chat */}
          {router && tech && (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/chat/[id]',
                params: {
                  id: lead.id.toString(),
                  techId: tech.id.toString(),
                  techName: tech.nombre,
                  clientName: lead.nombre,
                  senderType: 'tecnico',
                  senderId: tech.id.toString(),
                },
              })}
              style={{ flex: 1, backgroundColor: '#1A1A2E', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="chatbubbles" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Chat</Text>
            </TouchableOpacity>
          )}

          {/* Next status - GRAN BOTÓN */}
          {nextStatus && (
            <TouchableOpacity
              onPress={() => updateStatus(nextStatus)}
              style={{ flex: 1.3, backgroundColor: nextStatus === 'Completado' ? '#10B981' : '#EA580C', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: nextStatus === 'Completado' ? '#10B981' : '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 }}
            >
              <Ionicons name={nextStatus === 'Completado' ? 'checkmark-circle' : 'arrow-forward'} size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{nextStatus === 'Completado' ? '✓ COBRAR' : nextStatus}</Text>
            </TouchableOpacity>
          )}

          {/* Reject (only when Asignado - return to pool) */}
          {lead.estado === 'Asignado' && (
            <TouchableOpacity
              onPress={() => Alert.alert('Rechazar solicitud', '¿No puedes atender este servicio? Se reasignará a otro técnico.', [
                { text: 'No', style: 'cancel' },
                { text: 'Rechazar', style: 'destructive', onPress: async () => {
                  await supabase.from('clientes').update({ estado: 'Nuevo', tecnico_asignado: null }).eq('id', lead.id)
                  onStatusChange?.()
                }},
              ])}
              style={{ backgroundColor: '#FEE2E2', borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}

          {/* Cancel (for other statuses) */}
          {lead.estado !== 'Asignado' && (
            <TouchableOpacity
              onPress={cancelLead}
              style={{ backgroundColor: '#FEE2E2', borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

function LegalSection({ router }: { router: any }) {
  return (
    <View style={{ margin: 16, marginBottom: 40 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
        {[
          { icon: 'shield-checkmark-outline', label: 'Política de Privacidad', route: '/privacidad', color: COLORS.gray },
          { icon: 'document-text-outline', label: 'Términos y Condiciones', route: '/terminos', color: COLORS.gray },
          { icon: 'chatbubble-ellipses-outline', label: 'Soporte por WhatsApp', route: null, color: COLORS.gray },
          { icon: 'trash-outline', label: 'Eliminar mi cuenta', route: '/eliminar-cuenta', color: COLORS.gray },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => item.route ? router.push(item.route) : Linking.openURL(waLink(SUPPORT_PHONE, 'Hola, necesito soporte con SOLU'))}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#F1F5F9' }}
          >
            <Ionicons name={item.icon as any} size={18} color={item.color} />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: item.color }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.gray2} />
          </TouchableOpacity>
        ))}
        <View style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>SOLU v1.0.0 · CITYLAND GROUP E.I.R.L.</Text>
        </View>
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      <Text style={{ fontSize: 12, color: COLORS.gray, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark, flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}
