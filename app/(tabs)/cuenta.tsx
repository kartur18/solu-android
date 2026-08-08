// Hub del técnico: login/sesión, header con stats y las 7 pestañas del panel.
// Cada pestaña vive en su propio componente (src/components/tecnico/panel/):
// esta pantalla conserva el estado y los handlers que comparten entre sí.

import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, RefreshControl, Image, Modal, ActivityIndicator, Share, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { tierFromServicios, type TierTecnico } from '../../src/lib/tecnico-columns'
import { ENV } from '../../src/lib/env'
import { fetchWithTimeout } from '../../src/lib/env'
import { getTechAuthToken } from '../../src/lib/tech-auth'
import { saveTechSession, getTechToken, getTechSessionMeta, clearTechSession } from '../../src/lib/tech-session'
import { subirImagen } from '../../src/lib/subirImagen'
import { registerSessionExpiredHandler, resetSessionExpired } from '../../src/lib/session-expired'
import { supabase } from '../../src/lib/supabase'
import { fetchMyTechProfile, fetchMyTechProfileResult, fetchMyTechDashboardResult, debeCerrarSesion, type CitaAgenda } from '../../src/lib/tech-profile'
import { registerForPushNotifications, savePushToken } from '../../src/lib/notifications'
import type { Tecnico, Cliente, Resena, Notificacion, Cotizacion } from '../../src/lib/types'
import NotificationCenter from '../../src/components/NotificationCenter'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale } from '../../src/components/ui/Motion'
import { SaldoCoinsBar } from '../../src/components/tecnico/SaldoCoinsBar'
import { ConfirmarCostoModal } from '../../src/components/tecnico/ConfirmarCostoModal'
import { estadoSaldo, type PrecioLead } from '../../src/components/tecnico/lead-utils'
import { fetchChatsResumen, fetchPrecioLead } from '../../src/components/tecnico/lead-api'
import { TIERS_FIDELIDAD, type PagoCoins, type SolicitudAbierta } from '../../src/components/tecnico/panel/panel-utils'
import { ToastAviso, type Aviso } from '../../src/components/tecnico/panel/ToastAviso'
import { LegalSection } from '../../src/components/tecnico/panel/LegalSection'
import { PanelDashboard } from '../../src/components/tecnico/panel/PanelDashboard'
import { PanelServicios } from '../../src/components/tecnico/panel/PanelServicios'
import { PanelResenas } from '../../src/components/tecnico/panel/PanelResenas'
import { PanelIngresos } from '../../src/components/tecnico/panel/PanelIngresos'
import { PanelBilletera } from '../../src/components/tecnico/panel/PanelBilletera'
import { PanelCotizaciones } from '../../src/components/tecnico/panel/PanelCotizaciones'
import { PanelPerfil } from '../../src/components/tecnico/panel/PanelPerfil'

type Tab = 'dashboard' | 'servicios' | 'resenas' | 'cotizaciones' | 'ingresos' | 'plan' | 'perfil'

const TAB_KEYS: Tab[] = ['dashboard', 'servicios', 'resenas', 'cotizaciones', 'ingresos', 'plan', 'perfil']

function esTab(valor: string | undefined): valor is Tab {
  return !!valor && (TAB_KEYS as string[]).includes(valor)
}

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'dashboard', icon: 'grid', label: 'Inicio' },
  { key: 'servicios', icon: 'briefcase', label: 'Servicios' },
  { key: 'resenas', icon: 'star', label: 'Reseñas' },
  { key: 'cotizaciones', icon: 'document-text', label: 'Cotizaciones' },
  { key: 'ingresos', icon: 'cash', label: 'Ingresos' },
  { key: 'plan', icon: 'wallet', label: 'Billetera' },
  { key: 'perfil', icon: 'person', label: 'Perfil' },
]

export default function CuentaScreen() {
  const router = useRouter()
  // Permite entrar directo a una sección: la bandeja de mensajes manda acá con
  // ?tab=servicios cuando el técnico no tiene contactos y hay que revisar su
  // zona de trabajo.
  const params = useLocalSearchParams<{ tab?: string }>()
  const [loggedIn, setLoggedIn] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [leads, setLeads] = useState<Cliente[]>([])
  // Agenda real del server. null = el deploy actual del server no manda el
  // campo: la UI cae al modo leads sin inventar "no tienes citas".
  const [citas, setCitas] = useState<CitaAgenda[] | null>(null)
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Resena[]>([])
  const [openRequests, setOpenRequests] = useState<SolicitudAbierta[]>([])
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  // Trabajo cuyo costo se está confirmando (undefined en `precio` = consultando).
  const [solicitudConfirmar, setSolicitudConfirmar] = useState<SolicitudAbierta | null>(null)
  const [precioConfirmar, setPrecioConfirmar] = useState<PrecioLead | null | undefined>(undefined)
  const confirmandoRef = useRef<string | null>(null)
  const [tab, setTab] = useState<Tab>(esTab(params.tab) ? params.tab : 'dashboard')
  // Clientes que escribieron y siguen sin leerse. El panel es la pantalla que
  // el técnico abre primero: si no dice que hay gente esperando, no entra a la
  // bandeja y el lead se enfría.
  const [chatsSinLeer, setChatsSinLeer] = useState(0)
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0)
  const [editOficios, setEditOficios] = useState<string[]>([])
  const [editZonas, setEditZonas] = useState<string[]>([])
  // Modal de "Nueva promoción" con input real (reemplaza Alert.prompt, iOS-only).
  const [promoModal, setPromoModal] = useState(false)
  const [promoTitulo, setPromoTitulo] = useState('')
  // % real que ve el cliente. Antes se publicaba `descuento: 10` fijo aunque
  // el título dijera "20%": dos números contradictorios firmados por el técnico.
  const [promoDescuento, setPromoDescuento] = useState('')
  const [promoEnviando, setPromoEnviando] = useState(false)
  // true mientras se restaura la sesión guardada (evita el flash del login)
  const [restoring, setRestoring] = useState(true)
  // No se pudo PREGUNTAR por el perfil al restaurar (red caída, 5xx, 429). La
  // sesión sigue guardada: se ofrece reintentar en vez de pedir la contraseña.
  const [sessionError, setSessionError] = useState(false)
  // El panel no pudo cargarse. Distinto de "el técnico no tiene datos": mientras
  // esté en true no se muestran los vacíos ("No hay trabajos en tu zona ahora").
  const [dashError, setDashError] = useState(false)
  // Aviso no bloqueante (reemplaza los Alert.alert informativos).
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const mostrarAviso = useCallback((a: Aviso) => setAviso(a), [])

  // V3.1: la función handleSubscribe (Flow-subscribe para planes mensuales)
  // fue eliminada. La compra de SoluCoins se hace desde la pantalla
  // /comprar-coins que abre webview a solu.pe/planes (Culqi).

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
  const [pagos, setPagos] = useState<PagoCoins[]>([])

  // Cotizaciones state
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  // Token de sesión del técnico (lo emite /api/login-tech). Se usa para
  // leer el perfil propio vía /api/tecnico/me (post-lockdown).
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Restaura la sesión guardada. Un fallo de RED jamás borra el token: antes,
  // cualquier respuesta no-2xx de /tecnico/me (429 del rate limit incluido) o un
  // fetch que reventaba sin internet ejecutaba clearTechSession(), así que abrir
  // la app en el subte o dos veces seguidas deslogueaba al técnico.
  async function restaurarSesion() {
    setSessionError(false)
    try {
      const session = await getTechSessionMeta()
      if (!session) return
      // El token vive en SecureStore (getTechToken hace fallback/migración
      // desde sesiones viejas que lo guardaban en AsyncStorage).
      const savedToken = await getTechToken()
      // El perfil propio se lee server-side con el token (post-lockdown).
      // Sesiones viejas sin token (o token vencido) -> pedir re-login.
      if (session?.id && savedToken) {
        setLoading(true)
        // Sesión restaurada con token: rearma la detección de 401.
        resetSessionExpired()
        setAuthToken(savedToken)
        const perfil = await fetchMyTechProfileResult(savedToken)
        if (perfil.ok) {
          const data = perfil.data
          setTech(data)
          setLoggedIn(true)
          setEditDesc(data.descripcion || '')
          setEditPrecio(data.precio_desde?.toString() || '')
          setEditDisponible(data.disponible)
          setGalleryImages(data.galeria || [])
          // Oficios y zonas TAMBIEN acá, igual que doLogin. Faltaban, y el
          // auto-login es el camino normal: el técnico abría Editar perfil,
          // veía sus oficios y zonas VACIOS aunque tuviera tres y cinco,
          // agregaba uno creyendo que sumaba, y saveProfile manda el array
          // entero — reemplazando todo por ese único valor. Perdía el resto
          // sin enterarse, y con ellos los leads de esos oficios y distritos.
          setEditOficios(data.oficios || [data.oficio].filter(Boolean))
          setEditZonas(data.zonas || [data.distrito].filter(Boolean))
          registerForPushNotifications().then(token => {
            if (token) savePushToken(data.id, token)
          })
          await loadData(data.id, savedToken)
        } else if (debeCerrarSesion(perfil)) {
          // 401/403: el token realmente no sirve.
          await clearTechSession()
        } else {
          // No se pudo preguntar: la sesión queda intacta y se ofrece reintentar.
          setSessionError(true)
        }
        setLoading(false)
      } else if (session?.id) {
        // Sesión legacy sin token: limpiar para forzar login nuevo.
        await clearTechSession()
      }
    } catch {
      setLoading(false)
    } finally {
      setRestoring(false)
    }
  }

  // Auto-login from saved session
  useEffect(() => {
    void restaurarSesion()
  }, [])

  useEffect(() => {
    if (esTab(params.tab)) setTab(params.tab)
  }, [params.tab])

  // Al volver de la bandeja, el contador de "clientes esperando" tiene que
  // reflejar lo que el técnico ya leyó, no lo que había al abrir el panel.
  useFocusEffect(
    useCallback(() => {
      if (!loggedIn) return
      let activo = true
      void (async () => {
        const token = await getTechToken()
        if (!token || !activo) return
        try {
          const chats = await fetchChatsResumen(token)
          if (!activo) return
          setChatsSinLeer(chats.filter((c) => c.mensajes_nuevos > 0).length)
          setMensajesSinLeer(chats.reduce((sum, c) => sum + c.mensajes_nuevos, 0))
        } catch { /* la bandeja tiene su propio manejo de error */ }
      })()
      return () => { activo = false }
    }, [loggedIn]),
  )

  // Si el token vence en mitad de sesión (401 detectado en cualquier fetch
  // autenticado), bajamos el estado local para mostrar el login. El layout raíz
  // ya limpió la sesión y mostró el aviso; acá solo reseteamos la UI.
  useEffect(() => {
    return registerSessionExpiredHandler(() => {
      setLoggedIn(false)
      setTech(null)
      setAuthToken(null)
      setTab('dashboard')
    })
  }, [])

  async function doLogin() {
    const trimmedId = loginId.trim()
    if (!trimmedId) return mostrarAviso({ tipo: 'error', texto: 'Ingresa tu email o WhatsApp' })

    const isEmail = trimmedId.includes('@')
    const isWhatsApp = /^\d{7,15}$/.test(trimmedId.replace(/\s/g, ''))

    if (!isEmail && !isWhatsApp) {
      return mostrarAviso({ tipo: 'error', texto: 'Ingresa un email válido o número de WhatsApp' })
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
        mostrarAviso({ tipo: 'error', texto: result.error || 'Error al iniciar sesión' })
        setLoading(false)
        return
      }

      const data = result.technician
      const token: string | null = result.auth_token ?? null

      setTech(data)
      setAuthToken(token)
      setLoggedIn(true)
      setEditDesc(data.descripcion || '')
      setEditPrecio(data.precio_desde?.toString() || '')
      setEditDisponible(data.disponible)
      setGalleryImages(data.galeria || [])
      setEditOficios(data.oficios || [data.oficio].filter(Boolean))
      setEditZonas(data.zonas || [data.distrito].filter(Boolean))

      // Persist session: {id, nombre} en AsyncStorage y el token en SecureStore
      // (necesario para /api/tecnico/me).
      await saveTechSession({ id: data.id, nombre: data.nombre }, token)
      // Rearma la detección de 401: un futuro vencimiento vuelve a desloguear.
      resetSessionExpired()

      registerForPushNotifications().then(token => {
        if (token) savePushToken(data.id, token)
      })
      await loadData(data.id, token)
    } catch {
      mostrarAviso({ tipo: 'error', texto: 'Error de conexión. Verifica tu internet.' })
    } finally {
      setLoading(false)
    }
  }

  async function loadData(techId: number, token?: string | null) {
    try {
      // Todo el panel se lee server-side con el token (clientes estaba
      // expuesta a anon; notificaciones/cotizaciones/pagos en deny-all
      // daban vacío). Un solo endpoint autenticado: seguro + datos reales.
      const dash = await fetchMyTechDashboardResult(token ?? authToken)
      if (dash.ok) {
        setDashError(false)
        setLeads(dash.data.leads)
        // Campos nuevos (agenda real + .ics firmado): el server los está
        // ganando en paralelo; un deploy viejo no los manda y queda null.
        const citasSrv = Array.isArray(dash.data.citas)
          ? dash.data.citas
          : Array.isArray(dash.data.agenda) ? dash.data.agenda : null
        setCitas(citasSrv)
        setCalendarUrl(
          typeof dash.data.calendar_url === 'string' && dash.data.calendar_url.startsWith('http')
            ? dash.data.calendar_url
            : null,
        )
        setReviews(dash.data.resenas)
        setOpenRequests(dash.data.openRequests)
        setNotifications(dash.data.notificaciones)
        setUnreadCount(dash.data.notificaciones.filter((n: Notificacion) => !n.leido).length)
        setCotizaciones(dash.data.cotizaciones)
        setPagos(dash.data.pagos)
      } else {
        // Sin datos frescos: el panel NO puede afirmar "no tienes trabajos".
        setDashError(true)
      }
      // Resumen de la bandeja: cuántos clientes están esperando respuesta.
      // Falla en silencio — el panel no puede quedarse sin cargar por esto.
      try {
        const tokenChats = token ?? authToken
        if (tokenChats) {
          const chats = await fetchChatsResumen(tokenChats)
          setChatsSinLeer(chats.filter((c) => c.mensajes_nuevos > 0).length)
          setMensajesSinLeer(chats.reduce((sum, c) => sum + c.mensajes_nuevos, 0))
        }
      } catch { /* la bandeja tiene su propio manejo de error */ }
      // La métrica de "vistas al perfil" se quitó: consultaba la tabla
      // profile_views, que no existe. supabase-js no lanza ante tabla
      // inexistente (el error viaja en el objeto), así que el contador se
      // quedaba en 0 en silencio y mostraba un dato falso al técnico.
    } catch {
      // silent
    }
  }

  // Consulta el costo y abre la hoja de confirmación. La consulta corre con la
  // hoja ya abierta para que el técnico no toque un botón que "no hace nada"
  // mientras el endpoint responde.
  async function pedirConfirmacion(s: SolicitudAbierta) {
    confirmandoRef.current = s.codigo
    setSolicitudConfirmar(s)
    setPrecioConfirmar(undefined)
    const precio = await fetchPrecioLead(s.codigo, authToken)
    // Si mientras tanto cerró la hoja o abrió otro trabajo, este precio ya no
    // corresponde a lo que está viendo.
    if (confirmandoRef.current !== s.codigo) return
    setPrecioConfirmar(precio)
  }

  async function aceptarTrabajo(s: SolicitudAbierta) {
    confirmandoRef.current = null
    setSolicitudConfirmar(null)
    setAcceptingId(s.id)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/solicitudes/${s.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Bearer firmado: el endpoint deriva el tecnicoId del token
          // (no del body). Sin esto el endpoint devolvía 401.
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ tecnicoId: tech?.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setOpenRequests(prev => prev.filter(r => r.id !== s.id))
        if (tech) loadData(tech.id)
        // El endpoint devuelve el contacto que el técnico acaba de pagar:
        // llevarlo directo al cliente. La velocidad del primer mensaje decide
        // si el lead responde. Sigue siendo Alert porque acá hay una DECISIÓN
        // (WhatsApp / chat / después), no un aviso.
        const sol = (data as { solicitud?: { codigo?: string; clienteWhatsapp?: string } }).solicitud
        const waCliente = (sol?.clienteWhatsapp || '').replace(/\D/g, '')
        const msg = `Hola ${s.cliente_nombre}, soy ${tech?.nombre || 'tu técnico'} de SOLU. Acabo de tomar tu solicitud de ${s.servicio} (${s.codigo}). ¿Cuándo te queda bien?`
        Alert.alert(
          '¡Trabajo aceptado!',
          `Escríbele ahora a ${s.cliente_nombre}: los primeros minutos deciden si te responde.`,
          [
            ...(waCliente
              ? [{
                  text: 'Abrir WhatsApp',
                  onPress: () => { void Linking.openURL(`https://wa.me/51${waCliente}?text=${encodeURIComponent(msg)}`) },
                }]
              : []),
            {
              text: 'Abrir chat',
              onPress: () => router.push({
                pathname: '/chat/[id]',
                params: {
                  id: s.id.toString(),
                  codigo: sol?.codigo || s.codigo,
                  techName: tech?.nombre || '',
                  clientName: s.cliente_nombre,
                  senderType: 'tecnico',
                },
              }),
            },
            { text: 'Después', style: 'cancel' as const },
          ],
        )
      } else if (data.taken) {
        mostrarAviso({ tipo: 'error', texto: 'Ya tomado: otro técnico fue más rápido.' })
        setOpenRequests(prev => prev.filter(r => r.id !== s.id))
      } else {
        mostrarAviso({ tipo: 'error', texto: data.error || 'No se pudo aceptar' })
      }
    } catch {
      mostrarAviso({ tipo: 'error', texto: 'Error de conexión' })
    } finally {
      setAcceptingId(null)
    }
  }

  const onRefresh = useCallback(async () => {
    if (!tech) return
    setRefreshing(true)
    try {
      const data = await fetchMyTechProfile(authToken)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el body del endpoint acepta varios campos opcionales
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
      // El id sale del token (Bearer); el endpoint ignora cualquier id del body.
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/update-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `update_profile_${res.status}`)
      }
      setTech({ ...tech, ...updates } as Tecnico)
      setEditing(false)
      mostrarAviso({ tipo: 'ok', texto: 'Tu perfil se actualizó correctamente' })
    } catch (err: any) {
      mostrarAviso({ tipo: 'error', texto: 'No se pudo guardar: ' + (err?.message || 'Intenta de nuevo') })
    } finally {
      setSavingProfile(false)
    }
  }

  // --- Gallery functions ---
  // V3.1: límite generoso para todos los técnicos verificados (sin gates por
  // plan mensual). Se mantiene un tope sano para no inflar el bucket.
  function getMaxPhotos(): number {
    if (!tech) return 0
    return 20
  }

  async function pickAndUploadProfilePhoto() {
    if (!tech) return
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      return mostrarAviso({ tipo: 'error', texto: 'Necesitamos acceso a tu galería.' })
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
      // Va por el servidor (Cloudinary): antes subía al bucket `fotos`, que es
      // PRIVADO, y guardaba una URL pública inexistente — la foto no cargaba
      // para nadie y quedaba una URL muerta en la BD.
      const fotoUrl = await subirImagen(asset.uri, 'perfil', authToken)
      if (!fotoUrl) throw new Error('upload_failed')
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/foto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ foto_url: fotoUrl }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `foto_${res.status}`)
      }
      setTech({ ...tech, foto_url: fotoUrl })
      mostrarAviso({ tipo: 'ok', texto: 'Foto de perfil actualizada' })
    } catch (err) {
      mostrarAviso({ tipo: 'error', texto: 'No se pudo subir la foto' })
    }
  }

  async function pickAndUploadImage() {
    if (!tech) return
    const maxPhotos = getMaxPhotos()
    if (galleryImages.length >= maxPhotos) {
      return mostrarAviso({ tipo: 'error', texto: `Puedes tener hasta ${maxPhotos} fotos en tu galería. Elimina alguna para subir una nueva.` })
    }

    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      return mostrarAviso({ tipo: 'error', texto: 'Necesitamos acceso a tu galería para subir fotos.' })
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
      // Mismo motivo que la foto de perfil: el bucket es privado y la URL
      // pública que se guardaba no existía.
      const publicUrl = await subirImagen(asset.uri, 'galeria', authToken)
      if (!publicUrl) throw new Error('upload_failed')

      const newGaleria = [...galleryImages, publicUrl]
      // Se manda el array completo resultante; el endpoint lo persiste tal cual.
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/galeria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ galeria: newGaleria }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `galeria_${res.status}`)
      }

      setGalleryImages(newGaleria)
      setTech({ ...tech, galeria: newGaleria })
      mostrarAviso({ tipo: 'ok', texto: 'La foto se agregó a tu galería.' })
    } catch (err: any) {
      mostrarAviso({ tipo: 'error', texto: 'No se pudo subir la imagen: ' + (err?.message || 'Intenta de nuevo') })
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
            // El borrado del archivo en Storage ya se hizo arriba; acá se persiste el array resultante.
            const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/galeria`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
              body: JSON.stringify({ galeria: newGaleria }),
            })
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as { error?: string }
              throw new Error(body.error || `galeria_${res.status}`)
            }
            setGalleryImages(newGaleria)
            setTech({ ...tech, galeria: newGaleria })
          } catch (err: any) {
            mostrarAviso({ tipo: 'error', texto: 'No se pudo eliminar: ' + (err?.message || 'Intenta de nuevo') })
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
      return mostrarAviso({ tipo: 'error', texto: 'Necesitamos acceso a tu galería para subir documentos.' })
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
      // El endpoint exige auth_token en el FormData (verifica ownership) o devuelve 401.
      const docToken = authToken ?? (await getTechAuthToken())
      if (!docToken) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
      formData.append('auth_token', docToken)

      // Sin header Content-Type manual: fetch arma el boundary multipart solo
      // (forzarlo en React Native rompe el parseo del FormData en el server).
      const uploadRes = await fetchWithTimeout(`${ENV.API_BASE_URL}/upload-doc`, {
        method: 'POST',
        body: formData,
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
      mostrarAviso({ tipo: 'ok', texto: `Tu ${TIPO_LABELS[tipo]} fue enviado para revisión. El equipo de SOLU lo verificará en 24-48 horas.` })
    } catch (err: any) {
      mostrarAviso({ tipo: 'error', texto: 'No se pudo subir el documento: ' + (err?.message || 'Intenta de nuevo') })
    } finally {
      setUploadingDoc(null)
    }
  }

  function cerrarSesion() {
    void clearTechSession()
    setLoggedIn(false)
    setTech(null)
    setTab('dashboard')
  }

  // Splash mientras se restaura la sesión guardada (evita pantalla en blanco / flash del login)
  if (!loggedIn && restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.navy, alignItems: 'center', justifyContent: 'center', gap: THEME.space.lg }}>
        <View style={{ width: 64, height: 64, borderRadius: THEME.radius.xl, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: THEME.color.white }}>S</Text>
        </View>
        <ActivityIndicator size="small" color={THEME.color.brand} />
        <Text style={{ color: 'rgba(255,255,255,0.6)', ...THEME.font.bodySm, fontWeight: '600' }}>Cargando tu cuenta...</Text>
      </View>
    )
  }

  // No se pudo contactar a SOLU al restaurar la sesión. El token sigue guardado:
  // se ofrece reintentar en vez de mandarlo a escribir la contraseña de nuevo.
  if (!loggedIn && sessionError) {
    return (
      <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: THEME.color.navy, alignItems: 'center', justifyContent: 'center', padding: THEME.space.xxl, gap: THEME.space.lg }}>
        <Ionicons name="cloud-offline-outline" size={48} color={THEME.color.brand} />
        <Text style={{ color: THEME.color.white, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>No pudimos conectar con SOLU</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
          Tu sesión sigue activa. Revisa tu internet y vuelve a intentar.
        </Text>
        <TouchableOpacity
          onPress={() => { setRestoring(true); void restaurarSesion() }}
          accessibilityLabel="Reintentar la conexión con SOLU"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, paddingHorizontal: 24, minHeight: 48, minWidth: 200 }}
        >
          <Ionicons name="refresh" size={18} color={THEME.color.white} />
          <Text style={{ color: THEME.color.white, fontSize: 15, fontWeight: '800' }}>Reintentar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSessionError(false)}
          accessibilityLabel="Ingresar con mi contraseña"
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700' }}>Ingresar con mi contraseña</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // LOGIN SCREEN
  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.navy }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: THEME.space.xxl }} keyboardShouldPersistTaps="handled">
          <FadeInUp delay={0}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: THEME.radius.xxl, padding: THEME.space.xxxl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              {/* Logo SOLU */}
              <View style={{ width: 72, height: 72, borderRadius: THEME.radius.xl, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: THEME.space.xl, ...THEME.shadow.brand }}>
                <Text style={{ fontSize: 32, fontWeight: '900', color: THEME.color.white }}>S</Text>
              </View>
              <Text style={{ ...THEME.font.h1, color: THEME.color.white, textAlign: 'center', marginBottom: THEME.space.xs }}>Bienvenido, técnico</Text>
              <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: THEME.space.xxl }}>Ingresa para gestionar tus servicios</Text>

              <Text style={{ ...THEME.font.label, color: 'rgba(255,255,255,0.7)', marginBottom: THEME.space.sm }}>Email o WhatsApp</Text>
              <TextInput
                placeholder="correo@email.com o 999888777"
                value={loginId}
                onChangeText={setLoginId}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: THEME.radius.lg, padding: 18, fontSize: 16, marginBottom: THEME.space.md, fontWeight: '700', color: THEME.color.white, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                placeholderTextColor="rgba(255,255,255,0.3)"
              />

              <Text style={{ ...THEME.font.label, color: 'rgba(255,255,255,0.7)', marginBottom: THEME.space.sm }}>Contraseña</Text>
              <View style={{ position: 'relative', marginBottom: THEME.space.sm }}>
                <TextInput
                  placeholder="Tu contraseña"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry={!showLoginPassword}
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: THEME.radius.lg, padding: 18, paddingRight: 52, fontSize: 16, fontWeight: '700', color: THEME.color.white, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
                <TouchableOpacity
                  onPress={() => setShowLoginPassword(!showLoginPassword)}
                  style={{ position: 'absolute', right: 16, top: 18 }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Ionicons name={showLoginPassword ? 'eye-off' : 'eye'} size={22} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/recuperar')}
                style={{ alignSelf: 'flex-end', marginBottom: THEME.space.xl }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ ...THEME.font.label, color: THEME.color.brand }}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              <PressableScale
                onPress={doLogin}
                disabled={loading}
                accessibilityLabel="Ingresar"
                style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, height: 52, alignItems: 'center', ...THEME.shadow.brand, flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm }}
              >
                {loading && <ActivityIndicator size="small" color={THEME.color.white} />}
                <Text style={{ color: THEME.color.white, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>{loading ? 'Verificando...' : 'INGRESAR'}</Text>
              </PressableScale>
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: THEME.space.lg, gap: THEME.space.xs }}>
                <Text style={{ ...THEME.font.label, color: 'rgba(255,255,255,0.5)' }}>¿No tienes cuenta?</Text>
                <TouchableOpacity onPress={() => router.push('/registro')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.brand }}>Crear cuenta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </FadeInUp>
          <LegalSection router={router} />
        </ScrollView>
        <ToastAviso aviso={aviso} onOcultar={() => setAviso(null)} />
      </View>
    )
  }

  if (!tech) return null

  // Tier real: el del server si viene en el perfil; si no, derivado con los
  // umbrales de fidelidad (10/50/200) — la misma regla que la card pública.
  const tierKey: TierTecnico = tech.tier ?? tierFromServicios(tech.servicios_completados)
  const tierInfo = TIERS_FIDELIDAD.find((t) => t.key === tierKey) ?? TIERS_FIDELIDAD[0]
  const tierIdx = TIERS_FIDELIDAD.indexOf(tierInfo)
  const tierNext = tierIdx < TIERS_FIDELIDAD.length - 1 ? TIERS_FIDELIDAD[tierIdx + 1] : null
  const tierProgress = tierNext
    ? Math.min(Math.max((tech.servicios_completados - tierInfo.min) / (tierNext.min - tierInfo.min), 0), 1)
    : 1
  // /api/tecnico/me devuelve el row completo; estas columnas no están en el tipo compartido.
  const dniData = tech as Tecnico & { dni_frente_url?: string | null; dni_posterior_url?: string | null }
  const dniCompleto = !!(dniData.dni_frente_url && dniData.dni_posterior_url)
  // V3.1: planInfo eliminado (modelo de planes mensuales deprecado). El tier
  // loyalty (`tierInfo` arriba) y `tech.coins_balance` son los datos que
  // alimentan las pantallas que antes usaban planInfo.

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.color.navy} />}
      >
        {/* Header Premium */}
        <View style={{ backgroundColor: THEME.color.navy, padding: THEME.space.xxl, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...THEME.shadow.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.space.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
              <PressableScale onPress={() => { void pickAndUploadProfilePhoto() }} accessibilityLabel="Cambiar foto de perfil" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...THEME.shadow.brand }}>
                {tech.foto_url ? (
                  <Image source={{ uri: tech.foto_url }} style={{ width: 48, height: 48 }} />
                ) : (
                  <Text style={{ fontSize: 22, fontWeight: '900', color: THEME.color.white }}>{tech.nombre?.[0] || 'S'}</Text>
                )}
              </PressableScale>
              <View>
                <Text style={{ ...THEME.font.label, color: 'rgba(255,255,255,0.4)' }}>Bienvenido</Text>
                <Text style={{ ...THEME.font.h2, color: THEME.color.white }}>{tech.nombre}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: THEME.space.sm }}>
              <PressableScale
                onPress={() => Share.share({ message: `Soy ${tech.nombre}, ${tech.oficio} verificado en SOLU. Mira mi perfil: https://www.solu.pe/tecnico/${tech.id}`, title: `${tech.nombre} - SOLU` })}
                accessibilityLabel="Compartir mi perfil"
                style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.7)" />
              </PressableScale>
              <PressableScale
                onPress={() => setShowNotifications(true)}
                accessibilityLabel={unreadCount > 0 ? `Ver notificaciones, ${unreadCount} sin leer` : 'Ver notificaciones'}
                style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.7)" />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: THEME.color.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: THEME.color.navy }}>
                    <Text style={{ color: THEME.color.white, fontSize: 10, fontWeight: '900' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </PressableScale>
              <PressableScale
                onPress={() => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Salir', style: 'destructive', onPress: cerrarSesion },
                ])}
                accessibilityLabel="Cerrar sesión"
                style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.7)" />
              </PressableScale>
            </View>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatCard value={`★ ${tech.calificacion?.toFixed(1) || '0.0'}`} label="Rating" />
            <StatCard value={String(tech.num_resenas || 0)} label="Reseñas" />
            <StatCard value={String(tech.servicios_completados || 0)} label="Servicios" />
            <StatCard
              value={(tech.coins_balance ?? 0).toLocaleString('es-PE')}
              label="SoluCoins"
              highlight
              onPress={() => setTab('plan')}
            />
          </View>

          {/* Tier loyalty badge (V3.1: reemplaza el badge de plan mensual) */}
          <View style={{ marginTop: THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
            <View style={{ backgroundColor: 'rgba(242,107,33,0.2)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm }}>
              <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.brand }}>
                {tierInfo.emoji} Tier {tierInfo.name}
              </Text>
            </View>
            {tech.verificado && (
              <View style={{ backgroundColor: 'rgba(22,163,74,0.18)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '800', color: '#34D399' }}>✅ Verificado</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sin verificar = invisible: no aparece en búsquedas y accept devuelve
            404. Antes solo había un "Pendiente ⏳" enterrado en Perfil y ninguna
            pantalla para subir el DNI; el aviso vive fijo en el panel con el
            camino directo a resolverlo. */}
        {!tech.verificado && (
          <FadeInUp delay={40}>
            <View
              accessibilityRole="alert"
              style={{
                marginHorizontal: THEME.space.lg, marginTop: THEME.space.lg,
                backgroundColor: dniCompleto ? '#FEF3C7' : '#FEE2E2',
                borderRadius: 16, padding: 14,
                borderWidth: 1, borderColor: dniCompleto ? '#FDE68A' : '#FECACA',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Ionicons name={dniCompleto ? 'time' : 'alert-circle'} size={20} color={dniCompleto ? '#B45309' : '#DC2626'} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: dniCompleto ? '#92400E' : '#991B1B' }}>
                    {dniCompleto ? 'Tu DNI está en revisión' : 'Sin tu DNI no apareces en las búsquedas'}
                  </Text>
                  <Text style={{ fontSize: 11, color: dniCompleto ? '#92400E' : '#B91C1C', marginTop: 2, lineHeight: 16 }}>
                    {dniCompleto
                      ? 'Ya tenemos las dos caras. Te activamos apenas lo validemos.'
                      : 'Los clientes no pueden encontrarte ni puedes aceptar trabajos. Sube las dos caras de tu DNI y te activamos.'}
                  </Text>
                </View>
              </View>
              {!dniCompleto && (
                <TouchableOpacity
                  onPress={() => router.push('/subir-dni')}
                  accessibilityLabel="Subir mi DNI para aparecer en las búsquedas"
                  style={{ backgroundColor: '#DC2626', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginTop: 10 }}
                >
                  <Ionicons name="card-outline" size={16} color={THEME.color.white} />
                  <Text style={{ color: THEME.color.white, fontSize: 13, fontWeight: '800' }}>Subir mi DNI</Text>
                </TouchableOpacity>
              )}
            </View>
          </FadeInUp>
        )}

        {/* Saldo — misma barra y mismo umbral que la bandeja de mensajes: el
            técnico que usa las dos pantallas ve el mismo estado y el mismo
            camino a comprar. Con saldo sano no aparece: ya está en la cabecera. */}
        {/* Sin dato de saldo no se avisa nada: si /tecnico/me no pudo derivarlo,
            decirle "te quedaste sin coins" sería una falsa alarma. */}
        {typeof tech.coins_balance === 'number' && estadoSaldo(tech.coins_balance) !== 'ok' && (
          <FadeInUp delay={60}>
            <View style={{ marginHorizontal: THEME.space.lg, marginTop: THEME.space.lg }}>
              <SaldoCoinsBar
                saldo={tech.coins_balance}
                onComprar={() => router.push('/comprar-coins')}
              />
            </View>
          </FadeInUp>
        )}

        {/* V3.1: el banner "Tu plan vence" del modelo viejo fue reemplazado
            por el banner "Saldo bajo de SoluCoins" más arriba, que se basa en
            tech.coins_balance en vez de fecha_vencimiento. */}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: THEME.space.md, paddingHorizontal: THEME.space.md }}>
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <PressableScale
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityLabel={t.label}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
                  // 44px: el técnico cambia de sección con el celular en una
                  // mano, muchas veces con guantes o los dedos sucios.
                  minHeight: 44,
                  paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, borderRadius: THEME.radius.full,
                  backgroundColor: active ? THEME.color.navy : THEME.color.surface,
                  marginRight: THEME.space.sm,
                  ...(active ? THEME.shadow.md : THEME.shadow.sm),
                }}
              >
                <Ionicons name={t.icon as keyof typeof Ionicons.glyphMap} size={14} color={active ? THEME.color.white : THEME.color.inkSoft} />
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: active ? THEME.color.white : THEME.color.inkSoft }}>
                  {t.label}
                </Text>
              </PressableScale>
            )
          })}
        </ScrollView>

        {/* Aviso global: lo que se ve abajo puede estar viejo o incompleto. Sin
            esto, un refresh fallido dejaba números de negocio (solicitudes del
            mes, completados) que el técnico leía como reales. */}
        {dashError && (
          <View
            accessibilityRole="alert"
            style={{ marginHorizontal: THEME.space.lg, marginTop: 4, backgroundColor: '#FEF3C7', borderRadius: THEME.radius.md, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons name="cloud-offline-outline" size={20} color="#B45309" />
            <Text style={{ flex: 1, ...THEME.font.label, fontWeight: '700', color: '#B45309', lineHeight: 17 }}>
              No pudimos actualizar tu panel. Lo que ves puede estar incompleto.
            </Text>
            <TouchableOpacity
              onPress={() => { void loadData(tech.id) }}
              accessibilityLabel="Reintentar la carga de tu panel"
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}
            >
              <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: '#B45309' }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ padding: 16, paddingTop: 4 }}>
          {tab === 'dashboard' && (
            <PanelDashboard
              tech={tech}
              leads={leads}
              citas={citas}
              calendarUrl={calendarUrl}
              chatsSinLeer={chatsSinLeer}
              mensajesSinLeer={mensajesSinLeer}
              tierInfo={tierInfo}
              tierNext={tierNext}
              tierProgress={tierProgress}
              router={router}
              onVerServicios={() => setTab('servicios')}
              onNuevaPromo={() => { setPromoTitulo(''); setPromoDescuento(''); setPromoModal(true) }}
              onAviso={mostrarAviso}
            />
          )}

          {tab === 'servicios' && (
            <PanelServicios
              tech={tech}
              leads={leads}
              openRequests={openRequests}
              dashError={dashError}
              acceptingId={acceptingId}
              authToken={authToken}
              router={router}
              onReload={() => { void loadData(tech.id) }}
              onAceptar={(s) => { void pedirConfirmacion(s) }}
              onAviso={mostrarAviso}
            />
          )}

          {tab === 'resenas' && (
            <PanelResenas
              reviews={reviews}
              dashError={dashError}
              onReload={() => { void loadData(tech.id) }}
            />
          )}

          {tab === 'ingresos' && (
            <PanelIngresos tech={tech} leads={leads} />
          )}

          {tab === 'plan' && (
            <PanelBilletera
              tech={tech}
              tierInfo={tierInfo}
              pagos={pagos}
              dashError={dashError}
              authToken={authToken}
              onReload={() => { void loadData(tech.id) }}
              onComprarCoins={() => router.push('/comprar-coins')}
            />
          )}

          {tab === 'cotizaciones' && (
            <PanelCotizaciones
              tech={tech}
              leads={leads}
              cotizaciones={cotizaciones}
              dashError={dashError}
              authToken={authToken}
              onReload={() => { void loadData(tech.id) }}
              onCotizacionesChange={setCotizaciones}
              onAviso={mostrarAviso}
            />
          )}

          {tab === 'perfil' && (
            <PanelPerfil
              tech={tech}
              authToken={authToken}
              editing={editing}
              onEditingChange={setEditing}
              editDesc={editDesc}
              onEditDesc={setEditDesc}
              editPrecio={editPrecio}
              onEditPrecio={setEditPrecio}
              editDisponible={editDisponible}
              onEditDisponible={setEditDisponible}
              editOficios={editOficios}
              onEditOficios={setEditOficios}
              editZonas={editZonas}
              onEditZonas={setEditZonas}
              savingProfile={savingProfile}
              onGuardar={() => { void saveProfile() }}
              galleryImages={galleryImages}
              uploadingImage={uploadingImage}
              maxPhotos={getMaxPhotos()}
              uploadingDoc={uploadingDoc}
              onSubirFotoPerfil={() => { void pickAndUploadProfilePhoto() }}
              onSubirFotoGaleria={() => { void pickAndUploadImage() }}
              onEliminarFoto={(url) => { void deleteGalleryImage(url) }}
              onSubirDoc={(tipo) => { void pickAndUploadDoc(tipo) }}
              onTechChange={setTech}
              onCerrarSesion={cerrarSesion}
              onAviso={mostrarAviso}
            />
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
          token={authToken}
        />
      )}

      {/* Costo del trabajo antes de tomarlo, con salida a comprar coins si no
          le alcanza (el Alert nativo anterior dejaba "Recargar" sin destino). */}
      <ConfirmarCostoModal
        trabajo={solicitudConfirmar}
        precio={precioConfirmar}
        onCancelar={() => { confirmandoRef.current = null; setSolicitudConfirmar(null) }}
        onConfirmar={() => { if (solicitudConfirmar) void aceptarTrabajo(solicitudConfirmar) }}
        onComprarCoins={() => {
          confirmandoRef.current = null
          setSolicitudConfirmar(null)
          router.push('/comprar-coins')
        }}
      />

      {/* Modal "Nueva promoción" con input real (Android no tiene Alert.prompt) */}
      <Modal visible={promoModal} transparent animationType="fade" onRequestClose={() => setPromoModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: THEME.space.xl }}>
            <View accessibilityViewIsModal accessibilityLabel="Crear una promoción" style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xl, ...THEME.shadow.lg }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: THEME.color.ink, marginBottom: 6 }}>Nueva promoción</Text>
              <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, marginBottom: 14 }}>Describe tu descuento y se publicará a los clientes de tu zona.</Text>
              <TextInput
                value={promoTitulo}
                onChangeText={setPromoTitulo}
                placeholder="Ej: 20% en gasfitería esta semana"
                placeholderTextColor={THEME.color.inkMuted}
                maxLength={80}
                autoFocus
                editable={!promoEnviando}
                style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.lg, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, fontSize: 15, color: THEME.color.ink, borderWidth: 1, borderColor: THEME.color.line }}
              />
              <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.md, marginBottom: 6 }}>Descuento (%)</Text>
              <TextInput
                value={promoDescuento}
                onChangeText={setPromoDescuento}
                placeholder="20"
                placeholderTextColor={THEME.color.inkMuted}
                keyboardType="number-pad"
                maxLength={2}
                editable={!promoEnviando}
                style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.lg, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, fontSize: 15, color: THEME.color.ink, borderWidth: 1, borderColor: THEME.color.line }}
              />
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 4 }}>
                Entre 5% y 50%. Este número aparece junto a tu promoción.
              </Text>
              <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.lg }}>
                <TouchableOpacity
                  onPress={() => { if (!promoEnviando) setPromoModal(false) }}
                  accessibilityLabel="Cancelar"
                  style={{ flex: 1, minHeight: 44, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.color.inkSoft }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={promoEnviando || !promoTitulo.trim()}
                  onPress={async () => {
                    const titulo = promoTitulo.trim()
                    if (!titulo) return
                    const pct = parseInt(promoDescuento, 10)
                    if (!Number.isInteger(pct) || pct < 5 || pct > 50) {
                      mostrarAviso({ tipo: 'error', texto: 'Ingresa un porcentaje entre 5 y 50.' })
                      return
                    }
                    setPromoEnviando(true)
                    try {
                      // El insert anon fallaba doble: `promociones` está en deny-all
                      // para anon Y se mandaba `tecnico_nombre` (columna inexistente)
                      // omitiendo `titulo`, que es obligatoria. Va por el endpoint.
                      const res = await fetch(`${ENV.API_BASE_URL}/tecnico/promociones`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                        },
                        body: JSON.stringify({ titulo, descuento: pct }),
                      })
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}))
                        mostrarAviso({ tipo: 'error', texto: 'No se pudo crear: ' + (body?.error || 'Inténtalo de nuevo en un momento.') })
                        return
                      }
                      setPromoModal(false)
                      setPromoTitulo('')
                      setPromoDescuento('')
                      mostrarAviso({ tipo: 'ok', texto: 'Tu promoción ya está visible para los clientes' })
                    } catch {
                      mostrarAviso({ tipo: 'error', texto: 'No se pudo crear: revisa tu conexión e inténtalo de nuevo.' })
                    } finally {
                      setPromoEnviando(false)
                    }
                  }}
                  accessibilityLabel="Crear promoción"
                  style={{ flex: 1, minHeight: 44, borderRadius: THEME.radius.lg, backgroundColor: (promoEnviando || !promoTitulo.trim()) ? THEME.color.lineSoft : THEME.color.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  {promoEnviando && <ActivityIndicator size="small" color={THEME.color.white} />}
                  <Text style={{ fontSize: 14, fontWeight: '700', color: (promoEnviando || !promoTitulo.trim()) ? THEME.color.inkSoft : THEME.color.white }}>Crear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {/* Con el modal abierto el toast del hub queda detrás del Modal
              nativo: se duplica adentro para que el aviso sí se vea. */}
          <ToastAviso aviso={aviso} onOcultar={() => setAviso(null)} />
        </KeyboardAvoidingView>
      </Modal>

      <ToastAviso aviso={aviso} onOcultar={() => setAviso(null)} />
    </View>
  )
}

function StatCard({ value, label, highlight, onPress }: { value: string; label: string; highlight?: boolean; onPress?: () => void }) {
  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      accessibilityLabel={onPress ? `${label}: ${value}. Toca para ver tu billetera` : undefined}
      style={{
        flex: 1, borderRadius: THEME.radius.lg, padding: THEME.space.md, alignItems: 'center', borderWidth: 1,
        backgroundColor: highlight ? 'rgba(242,107,33,0.18)' : 'rgba(255,255,255,0.06)',
        borderColor: highlight ? 'rgba(242,107,33,0.45)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '900', color: THEME.color.white }}>{value}</Text>
      <Text style={{ fontSize: 10, color: highlight ? '#FDBA74' : 'rgba(255,255,255,0.4)', fontWeight: '700', marginTop: 3 }}>{label}</Text>
    </PressableScale>
  )
}
