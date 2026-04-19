import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions, Animated, TextInput, Keyboard } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS, DISTRITOS } from '../../src/lib/constants'
import { logger } from '../../src/lib/logger'
import { useLocationDetection } from '../../src/lib/useLocation'
import type { Tecnico } from '../../src/lib/types'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'
import { HomeTechSkeleton } from '../../src/components/SkeletonLoader'
import { useFavorites } from '../../src/lib/useFavorites'
import { ChatBot } from '../../src/components/ChatBot'
import { track } from '../../src/lib/analytics'
import { useClientProfile } from '../../src/lib/useClientProfile'
import { suggestServicios, detectServicio, detectUrgencia } from '../../src/lib/smartIntent'
import { ENV } from '../../src/lib/env'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - 60) / 4

const CATEGORIES = [
  { name: 'Gasfitería',    icon: 'water'         as const, color: '#F26B21', bg: '#FFF3EC' },
  { name: 'Electricidad', icon: 'flash'          as const, color: '#D45A16', bg: '#FEF1E8' },
  { name: 'Pintura',      icon: 'color-palette'  as const, color: '#F26B21', bg: '#FFF3EC' },
  { name: 'Cerrajería',   icon: 'key'            as const, color: '#B84D12', bg: '#FEEDE3' },
  { name: 'Limpieza',     icon: 'sparkles'       as const, color: '#F26B21', bg: '#FFF3EC' },
  { name: 'Carpintería',  icon: 'hammer'         as const, color: '#D45A16', bg: '#FEF1E8' },
  { name: 'Maquillaje',   icon: 'color-wand'     as const, color: '#EC4899', bg: '#FDF2F8' },
  { name: 'Clases',       icon: 'book'           as const, color: '#8B5CF6', bg: '#F5F3FF' },
]

function PressableCard({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style?: any }) {
  const scaleAnim = useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const onPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const [topTechs, setTopTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [stats, setStats] = useState<{ techs: number; servs: number; distritos: number }>({
    techs: 0,
    servs: SERVICIOS.length,
    distritos: DISTRITOS.length,
  })
  const location = useLocationDetection()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const { toggleFavorite, isFavorite } = useFavorites()
  const { profile } = useClientProfile()
  const [pendingRating, setPendingRating] = useState<{ codigo: string; servicio: string } | null>(null)

  const suggestions = useMemo(() => suggestServicios(query, 6), [query])

  // Check for completed services waiting for rating
  useEffect(() => {
    if (!profile?.whatsapp) return
    ;(async () => {
      try {
        const { data: completed } = await supabase
          .from('clientes')
          .select('codigo, servicio')
          .eq('whatsapp', profile.whatsapp)
          .eq('estado', 'Completado')
          .order('created_at', { ascending: false })
          .limit(5)
        if (!completed || !completed.length) return

        const { data: rated } = await supabase
          .from('resenas')
          .select('codigo_servicio')
          .in('codigo_servicio', completed.map((c) => c.codigo))
        const ratedCodes = new Set((rated || []).map((r: { codigo_servicio: string }) => r.codigo_servicio))
        const next = completed.find((c) => !ratedCodes.has(c.codigo))
        if (next) setPendingRating({ codigo: next.codigo, servicio: next.servicio })
      } catch {}
    })()
  }, [profile?.whatsapp])

  async function handleSearchSubmit() {
    const text = query.trim()
    if (!text) {
      router.push('/solicitar')
      return
    }
    const detected = detectServicio(text)
    const urgencia = detectUrgencia(text)
    track('Smart Search Submitted', { query: text, detected, urgencia })

    if (detected) {
      router.push({
        pathname: '/solicitar',
        params: { servicio: detected, descripcion: text, urgencia },
      })
      setQuery(''); setShowSuggestions(false); Keyboard.dismiss()
      return
    }

    // Fallback AI para texto libre largo sin match local
    if (text.length > 20) {
      try {
        const res = await fetch(`${ENV.API_BASE_URL}/ai-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'recommend', messages: [{ role: 'user', content: text }] }),
        })
        if (res.ok) {
          const data = await res.json()
          const rec = data.recommendation
          if (rec?.service) {
            router.push({
              pathname: '/solicitar',
              params: { servicio: rec.service, descripcion: text, urgencia: rec.urgency || urgencia },
            })
            setQuery(''); setShowSuggestions(false); Keyboard.dismiss()
            return
          }
        }
      } catch {
        // AI falló → caer a búsqueda
      }
    }

    router.push({ pathname: '/buscar', params: { servicio: text } })
    setQuery(''); setShowSuggestions(false); Keyboard.dismiss()
  }

  function pickSuggestion(s: string) {
    setQuery('')
    setShowSuggestions(false)
    Keyboard.dismiss()
    track('Suggestion Picked', { servicio: s })
    router.push({ pathname: '/solicitar', params: { servicio: s } })
  }

  useEffect(() => {
    location.detectLocation()
    supabase
      .from('tecnicos')
      .select('id', { count: 'exact', head: true })
      .eq('disponible', true)
      .then(({ count }) => {
        setStats((prev) => ({ ...prev, techs: count || 0 }))
      })
  }, [])

  async function loadTopTechs() {
    try {
      const { data, error } = await supabase
        .from('tecnicos')
        .select('*')
        .eq('disponible', true)
        .order('calificacion', { ascending: false })
        .limit(5)
      if (error) throw error
      setTopTechs(data || [])
      if (offline) setOffline(false)
    } catch (err) {
      logger.error('Error loading techs:', err)
      if (!loading) setOffline(true)
    } finally {
      setLoading(false)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    }
  }

  useEffect(() => { loadTopTechs() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await loadTopTechs()
    setRefreshing(false)
  }

  const greeting = profile?.nombre ? `Hola ${profile.nombre.split(' ')[0]} 👋` : null

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {offline && (
        <TouchableOpacity
          onPress={onRefresh}
          style={{ backgroundColor: '#FEF3C7', padding: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
        >
          <Ionicons name="wifi-outline" size={14} color="#92400E" />
          <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>Verificando conexión - toca para reintentar</Text>
        </TouchableOpacity>
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.pri} colors={[COLORS.pri]} />}
      >
        {/* Hero Premium */}
        <LinearGradient
          colors={['#1A1A2E', '#16213E', '#0F172A']}
          style={{ padding: 24, paddingTop: 48, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center', shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>S</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>SOLU</Text>
            {location.distrito ? (
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(234,88,12,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Ionicons name="navigate" size={10} color="#F97316" />
                <Text style={{ color: '#F97316', fontSize: 10, fontWeight: '700' }}>{location.distrito}</Text>
              </View>
            ) : null}
          </View>

          {greeting ? (
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 4 }}>{greeting}</Text>
          ) : null}
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6, lineHeight: 34 }}>
            ¿Qué necesitas{'\n'}resolver hoy?
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 18, fontWeight: '600' }}>
            Escribe tu problema o elige un servicio
          </Text>

          {/* Smart search input */}
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
          }}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={(t) => { setQuery(t); setShowSuggestions(t.length > 0) }}
              onFocus={() => setShowSuggestions(query.length > 0)}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              placeholder="Ej: se me rompió el caño · 🎤 usa el mic del teclado"
              placeholderTextColor="#9CA3AF"
              style={{ flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.dark, paddingVertical: 12 }}
            />
            <TouchableOpacity
              onPress={handleSearchSubmit}
              style={{ backgroundColor: '#EA580C', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={{
              backgroundColor: '#fff', borderRadius: 14, marginTop: 8,
              paddingVertical: 4, maxHeight: 260,
              shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10,
            }}>
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => pickSuggestion(s)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="search" size={14} color="#9CA3AF" />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.dark }}>{s}</Text>
                  <Ionicons name="arrow-up-outline" size={14} color="#CBD5E1" style={{ transform: [{ rotate: '-45deg' }] }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Emergency link (discreet) */}
          <TouchableOpacity
            onPress={() => router.push('/urgencias')}
            activeOpacity={0.8}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}
          >
            <Ionicons name="flash" size={14} color="#FCA5A5" />
            <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>¿Emergencia? SOS 24/7 →</Text>
          </TouchableOpacity>

          {/* Trust stats (dynamic) */}
          <View style={{ flexDirection: 'row', marginTop: 18, gap: 8 }}>
            {[
              { label: 'Técnicos', value: stats.techs > 0 ? `${stats.techs}+` : '—' },
              { label: 'Servicios', value: `${stats.servs}+` },
              { label: 'Distritos', value: `${stats.distritos}+` },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>{stat.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Pending rating banner */}
        {pendingRating ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/calificar/[code]', params: { code: pendingRating.codigo } })}
            activeOpacity={0.85}
            style={{ marginHorizontal: 16, marginTop: -14, marginBottom: 8, backgroundColor: '#FEF3C7', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FDE68A' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="star" size={18} color="#92400E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>¿Cómo te fue con {pendingRating.servicio}?</Text>
              <Text style={{ fontSize: 11, color: '#78350F', marginTop: 1 }}>Toca para calificar · ayuda a otros vecinos</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#92400E" />
          </TouchableOpacity>
        ) : null}

        {/* Guarantee strip */}
        <View style={{ marginHorizontal: 16, marginTop: pendingRating ? 0 : -14, marginBottom: 12, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#A7F3D0' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#065F46' }}>Garantía SOLU</Text>
            <Text style={{ fontSize: 11, color: '#047857', marginTop: 1 }}>Si no queda bien, mandamos otro técnico sin costo en 48h</Text>
          </View>
        </View>

        {/* Categories */}
        <View style={{ padding: 16, paddingBottom: 4, paddingTop: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>
            Servicios populares
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {CATEGORIES.map((cat) => {
              const isLast = profile?.lastServicio === cat.name
              return (
                <PressableCard
                  key={cat.name}
                  onPress={() => {
                    track('Category Clicked', { category: cat.name })
                    router.push({ pathname: '/solicitar', params: { servicio: cat.name } })
                  }}
                  style={{
                    width: CARD_SIZE,
                    backgroundColor: '#fff', borderRadius: 16,
                    paddingVertical: 16, paddingHorizontal: 4,
                    alignItems: 'center', marginBottom: 10,
                    shadowColor: isLast ? cat.color : '#F26B21',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isLast ? 0.18 : 0.08,
                    shadowRadius: 6,
                    elevation: isLast ? 4 : 2,
                    borderWidth: isLast ? 2 : 1,
                    borderColor: isLast ? cat.color : '#FFF3EC',
                  }}
                >
                  {isLast ? (
                    <View style={{ position: 'absolute', top: -6, right: -4, backgroundColor: cat.color, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>ÚLTIMO</Text>
                    </View>
                  ) : null}
                  <View
                    style={{
                      width: 46, height: 46, borderRadius: 15,
                      backgroundColor: cat.bg,
                      alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                    }}
                  >
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, textAlign: 'center' }} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </PressableCard>
              )
            })}
          </View>
          <TouchableOpacity onPress={() => router.push('/buscar')} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: COLORS.pri, fontWeight: '700', fontSize: 11 }}>Ver todos los servicios →</Text>
          </TouchableOpacity>
        </View>

        {/* Value props */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
          }}>
            {[
              { icon: 'shield-checkmark' as const, color: COLORS.pri, title: 'Profesionales verificados', desc: 'DNI verificado con RENIEC · garantía total' },
              { icon: 'time' as const, color: '#1E3A5F', title: 'Respuesta inmediata', desc: 'Un técnico en tu puerta en minutos' },
              { icon: 'star' as const, color: COLORS.pri, title: 'Pagás al técnico directo', desc: 'Yape, Plin, efectivo · sin cobros extra' },
            ].map((item, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 12,
                borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#F1F5F9',
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.color + '12', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 1 }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Promo banner for techs (solo UNO, el del fondo se removió) */}
        <PressableCard
          onPress={() => router.push('/registro')}
          style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 14, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#1E3A5F', '#0F2035']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="gift" size={24} color="#FFD700" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>¿Eres técnico? Primer mes GRATIS</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Regístrate y empieza a recibir clientes hoy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </PressableCard>

        {/* Top techs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>Profesionales destacados</Text>
            <TouchableOpacity onPress={() => router.push('/buscar')} activeOpacity={0.7}>
              <Text style={{ color: COLORS.pri, fontWeight: '700', fontSize: 11 }}>Ver todos →</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <HomeTechSkeleton />
          ) : topTechs.length > 0 ? (
            <Animated.View style={{ opacity: fadeAnim }}>
              {topTechs.map((tech) => <TechCard key={tech.id} tech={tech} onToggleFavorite={toggleFavorite} isFavorite={isFavorite(tech.id)} />)}
            </Animated.View>
          ) : (
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 30, alignItems: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
            }}>
              <Ionicons name="people" size={36} color={COLORS.gray2} />
              <Text style={{ color: COLORS.dark, marginTop: 8, fontSize: 13, fontWeight: '700' }}>Registra técnicos para verlos aquí</Text>
              <Text style={{ color: COLORS.gray2, marginTop: 4, fontSize: 11, textAlign: 'center' }}>Los técnicos con mejor calificación{`\n`}aparecerán en esta sección</Text>
              <TouchableOpacity
                onPress={() => router.push('/buscar')}
                activeOpacity={0.8}
                style={{ marginTop: 12, backgroundColor: COLORS.pri, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Buscar técnicos →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', paddingVertical: 20, marginTop: 8 }}>
          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>SOLU v1.0 · CITYLAND GROUP E.I.R.L.</Text>
          <Text style={{ fontSize: 9, color: COLORS.gray2, marginTop: 2 }}>Profesionales verificados en todo el Perú</Text>
        </View>
      </ScrollView>
      <ChatBot />
    </View>
  )
}
