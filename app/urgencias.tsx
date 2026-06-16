import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, Linking, ActivityIndicator, StatusBar, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { waLink, ESTADOS } from '../src/lib/constants'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { getTechToken } from '../src/lib/chat-api'
import { useLocationDetection } from '../src/lib/useLocation'
// `supabase` (anon) removido: el insert a clientes ahora va por /api/cliente/crear-servicio.
import { useClientProfile } from '../src/lib/useClientProfile'
import { findBestTech, type MatchableTech } from '../src/lib/matching'
import { fetchTechWhatsapp } from '../src/lib/contacto'
import { registerForPushNotifications, upsertGuestClientPushToken } from '../src/lib/notifications'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, PulseDot, haptics } from '../src/components/ui/Motion'

const EMERGENCIAS = [
  { name: 'Fuga de agua', icon: 'water' as const, color: '#3B82F6', oficio: 'Gasfitero', desc: 'Tuberías, inundación' },
  { name: 'Corte de luz', icon: 'flash' as const, color: '#F59E0B', oficio: 'Electricista', desc: 'Sin energía, chispas' },
  { name: 'Cerrajería', icon: 'key' as const, color: '#EF4444', oficio: 'Cerrajero', desc: 'No puedo entrar' },
  { name: 'Fuga de gas', icon: 'flame' as const, color: '#DC2626', oficio: 'Gasfitero', desc: 'Olor a gas, peligro' },
  { name: 'Atoro de desagüe', icon: 'warning' as const, color: '#7C3AED', oficio: 'Desatorador', desc: 'Inodoro, cocina, lavadero' },
  { name: 'Otra emergencia', icon: 'help-circle' as const, color: '#6B7280', oficio: '', desc: 'Describe tu urgencia' },
]

// Ancho FIJO en píxeles para las cards de emergencia (2 por fila). Evita el
// width:'47%' que, según cómo se resuelva el padre, podía colapsar y partir
// el texto letra por letra ("Ce/rra/jerí/a"). Contenedor: padding xl (20) a
// cada lado + gap md (12) entre las 2 cards.
const CARD_W = (Dimensions.get('window').width - THEME.space.xl * 2 - THEME.space.md) / 2

export default function UrgenciasScreen() {
  const router = useRouter()
  const location = useLocationDetection()
  const { profile, save: saveProfile } = useClientProfile()
  const [selected, setSelected] = useState<typeof EMERGENCIAS[0] | null>(null)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [assignedTech, setAssignedTech] = useState<MatchableTech | null>(null)
  const [serviceCode, setServiceCode] = useState('')

  useEffect(() => { location.detectLocation() }, [])

  // Pre-fill from saved client profile
  useEffect(() => {
    if (profile?.nombre && !nombre) setNombre(profile.nombre)
    if (profile?.whatsapp && !whatsapp) setWhatsapp(profile.whatsapp)
  }, [profile])

  async function handleSearch() {
    setErrorMsg(null)
    if (!selected) return setErrorMsg('Selecciona el tipo de emergencia para continuar.')
    if (!nombre.trim() || !whatsapp.trim()) return setErrorMsg('Necesitamos tu nombre y WhatsApp para que el técnico te responda.')
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) return setErrorMsg('Ingresa un WhatsApp válido de 9 dígitos (empieza con 9).')

    setLoading(true)
    try {
      const distrito = location.distrito || 'Lima'

      // Smart matching: score por rating + experiencia + plan + distrito + GPS
      const bestTech = await findBestTech({
        servicio: selected.oficio || selected.name,
        distrito,
        clientCoords: location.coords,
      })

      if (!bestTech) {
        setErrorMsg('Por ahora no hay técnicos libres para esta emergencia. Intenta de nuevo en unos minutos o busca desde el inicio.')
        setLoading(false)
        return
      }

      // Crear la solicitud vía endpoint server-side (anon bloqueado por lockdown).
      const code = `URG-${Date.now().toString(36).toUpperCase()}`
      const techToken = await getTechToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (techToken) headers.Authorization = `Bearer ${techToken}`
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/cliente/crear-servicio`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nombre,
          whatsapp: waClean,
          servicio: `🚨 URGENCIA: ${selected.name}`,
          distrito,
          urgencia: 'emergencia',
          descripcion: `Emergencia urgente enviada desde la app.`,
          estado: ESTADOS.ASIGNADO,
          tecnico_asignado: bestTech.id,
          codigo: code,
          sos: true,
        }),
      })
      if (!res.ok) {
        setErrorMsg('Hubo un problema de conexión. Revisa tu internet e intenta de nuevo.')
        setLoading(false)
        return
      }

      // Save client profile for next time
      saveProfile({ nombre, whatsapp: waClean, distrito }).catch(() => {})
      // Register push token so cliente receives notifications on estado changes
      registerForPushNotifications().then((token) => {
        if (token) upsertGuestClientPushToken(waClean, token, nombre || 'Cliente').catch(() => {})
      }).catch(() => {})

      // Contacto IN-APP: NO se revela el WhatsApp del técnico. Revelarlo sin
      // crear el lead salteaba el cobro del coin (modelo SoluCoins por lead).
      // El cliente coordina por el chat interno desde /tracking/[code].
      setServiceCode(code)
      haptics.success()
      setAssignedTech({ ...bestTech })
    } catch (err) {
      setErrorMsg('Hubo un problema de conexión. Revisa tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // --- SUCCESS SCREEN (TECH FOUND) ---
  if (assignedTech) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, padding: THEME.space.xl, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.xl }}>
        <StatusBar barStyle="dark-content" />
        <FadeInUp>
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xxl, padding: THEME.space.xxl, alignItems: 'center', ...THEME.shadow.lg }}>
            <View style={{ width: 80, height: 80, borderRadius: THEME.radius.full, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
              <Ionicons name="checkmark-circle" size={44} color={THEME.color.success} />
            </View>
            <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center', marginBottom: THEME.space.xs }}>¡Técnico encontrado!</Text>
            <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginBottom: THEME.space.xl, lineHeight: 21 }}>Te asignamos al especialista disponible más cercano. Contáctalo ahora mismo.</Text>

            <View style={{ width: '100%', backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.xs }}>
                <PulseDot color={THEME.color.success} size={8} />
                <Text style={{ ...THEME.font.h3, color: '#065F46' }}>{assignedTech.nombre}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.xs }}>
                <Ionicons name="construct-outline" size={14} color="#047857" />
                <Text style={{ ...THEME.font.bodySm, color: '#065F46' }}>Especialidad: {assignedTech.oficio}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.xs }}>
                <Ionicons name="location-outline" size={14} color="#047857" />
                <Text style={{ ...THEME.font.bodySm, color: '#065F46' }}>Ubicación actual: {assignedTech.distrito}</Text>
              </View>
            </View>

            {/* Contacto IN-APP: se retiraron "Llamar" y "WhatsApp" directos (que
                revelaban el teléfono del técnico sin cobrar el coin — y eran un
                incentivo perverso para entrar por urgencias y saltar el cobro).
                El cliente coordina por el chat interno desde el seguimiento; el
                técnico ya recibió el push de la emergencia. */}
            <PressableScale
              onPress={() => router.push({ pathname: '/tracking/[code]', params: { code: serviceCode } })}
              accessibilityLabel="Ver seguimiento y chatear con el técnico"
              style={{ width: '100%', minHeight: 56, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm, ...THEME.shadow.brand }}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color={THEME.color.white} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Ver seguimiento y chatear</Text>
            </PressableScale>
          </View>
        </FadeInUp>

        <PressableScale onPress={() => router.replace('/')} haptic={false} accessibilityLabel="Volver al inicio" style={{ marginTop: THEME.space.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: THEME.space.md, minHeight: 44, flexDirection: 'row', gap: THEME.space.xs }}>
          <Ionicons name="arrow-back" size={16} color={THEME.color.brand} />
          <Text style={{ ...THEME.font.body, fontWeight: '700', color: THEME.color.brand }}>Volver al inicio</Text>
        </PressableScale>
      </View>
    )
  }

  // --- SEARCH SCREEN ---
  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ paddingBottom: THEME.space.xxxl + THEME.space.sm }} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" />
      {/* Header danger */}
      <View style={{ backgroundColor: '#7F1D1D', paddingHorizontal: THEME.space.xl, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.lg, paddingBottom: THEME.space.xxxl, borderBottomLeftRadius: THEME.radius.xxl, borderBottomRightRadius: THEME.radius.xxl, ...THEME.shadow.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.md }}>
          <PressableScale onPress={() => router.back()} haptic={false} accessibilityLabel="Volver" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={24} color={THEME.color.white} />
          </PressableScale>
          <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: THEME.color.danger, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.md }}>
            <Ionicons name="warning" size={24} color="#FDE68A" />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.white }}>SOS Automático</Text>
        </View>
        <Text style={{ ...THEME.font.body, color: 'rgba(255,255,255,0.9)', fontWeight: '600', lineHeight: 22 }}>
          Encuentra un técnico libre en segundos para emergencias críticas del hogar.
        </Text>
      </View>

      <View style={{ padding: THEME.space.xl }}>
        <FadeInUp delay={0}>
          <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.md }}>1. ¿Qué se rompió?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.md, marginBottom: THEME.space.xxl }}>
            {EMERGENCIAS.map((e) => {
              const active = selected?.name === e.name
              return (
                <PressableScale
                  key={e.name}
                  onPress={() => { setSelected(e); setErrorMsg(null) }}
                  accessibilityLabel={e.name}
                  style={{
                    width: CARD_W, backgroundColor: active ? e.color + '14' : THEME.color.surface,
                    borderRadius: THEME.radius.lg, padding: THEME.space.lg,
                    borderWidth: active ? 2 : 0,
                    borderColor: active ? e.color : 'transparent',
                    alignItems: 'center',
                    ...(active ? THEME.shadow.md : THEME.shadow.sm),
                  }}
                >
                  <View style={{ width: 52, height: 52, borderRadius: THEME.radius.md, backgroundColor: e.color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.sm }}>
                    <Ionicons name={e.icon} size={28} color={e.color} />
                  </View>
                  <Text style={{ ...THEME.font.h3, fontSize: 14, color: THEME.color.ink, textAlign: 'center' }}>{e.name}</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, textAlign: 'center', marginTop: 2 }}>{e.desc}</Text>
                </PressableScale>
              )
            })}
          </View>
        </FadeInUp>

        <FadeInUp delay={80}>
          <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.md }}>2. Datos rápidos de contacto</Text>
          <TextInput
            value={nombre} onChangeText={(t) => { setNombre(t); setErrorMsg(null) }}
            placeholder="Tu nombre"
            placeholderTextColor={THEME.color.inkMuted}
            style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.font.body, marginBottom: THEME.space.md, color: THEME.color.ink, ...THEME.shadow.sm }}
          />
          <TextInput
            value={whatsapp} onChangeText={(t) => { setWhatsapp(t); setErrorMsg(null) }}
            placeholder="Tu celular (WhatsApp)" keyboardType="phone-pad"
            placeholderTextColor={THEME.color.inkMuted}
            style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.font.body, marginBottom: THEME.space.xl, color: THEME.color.ink, ...THEME.shadow.sm }}
          />
        </FadeInUp>

        {errorMsg ? (
          <FadeInUp distance={8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.md, padding: THEME.space.md, marginBottom: THEME.space.md }}>
              <Ionicons name="alert-circle" size={18} color={THEME.color.danger} />
              <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#991B1B', fontWeight: '600' }}>{errorMsg}</Text>
            </View>
          </FadeInUp>
        ) : null}

        <PressableScale
          onPress={handleSearch}
          disabled={loading}
          accessibilityLabel="Buscar técnico ahora"
          style={{ backgroundColor: THEME.color.danger, borderRadius: THEME.radius.lg, minHeight: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm, opacity: loading ? 0.7 : 1, shadowColor: THEME.color.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6 }}
        >
          {loading ? (
            <>
              <ActivityIndicator color={THEME.color.white} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Buscando técnico...</Text>
            </>
          ) : (
            <>
              <Ionicons name="search" size={22} color={THEME.color.white} />
              <Text style={{ ...THEME.font.h3, color: THEME.color.white, letterSpacing: 0.3 }}>Buscar técnico ahora</Text>
            </>
          )}
        </PressableScale>
      </View>
    </ScrollView>
  )
}
