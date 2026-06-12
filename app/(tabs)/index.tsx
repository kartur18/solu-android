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
import { useClientProfile } from '../../src/lib/useClientProfile'
import { suggestServicios, detectServicio, detectUrgencia } from '../../src/lib/smartIntent'
import { ENV } from '../../src/lib/env'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, PulseDot } from '../../src/components/ui/Motion'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - THEME.space.lg * 2 - THEME.space.md * 3) / 4

const CATEGORIES = [
  { name: 'Gasfitería',    icon: 'water'         as const, color: '#F26B21', bg: '#FFF1E8' },
  { name: 'Electricidad', icon: 'flash'          as const, color: '#D9551A', bg: '#FEF1E8' },
  { name: 'Pintura',      icon: 'color-palette'  as const, color: '#F26B21', bg: '#FFF1E8' },
  { name: 'Cerrajería',   icon: 'key'            as const, color: '#B84D12', bg: '#FEEDE3' },
  { name: 'Limpieza',     icon: 'sparkles'       as const, color: '#0EA5E9', bg: '#E0F2FE' },
  { name: 'Carpintería',  icon: 'hammer'         as const, color: '#D9551A', bg: '#FEF1E8' },
  { name: 'Maquillaje',   icon: 'color-wand'     as const, color: '#EC4899', bg: '#FDF2F8' },
  { name: 'Clases',       icon: 'book'           as const, color: '#8B5CF6', bg: '#F5F3FF' },
]

export default function HomeScreen() {
  const router = useRouter()
  const [topTechs, setTopTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
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
      setOffline(true)
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

  const greeting = profile?.nombre ? `Hola ${profile.nombre.split(' ')[0]} 👋` : 'Hola 👋'

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      {offline && (
        <TouchableOpacity
          onPress={onRefresh}
          accessibilityRole="button"
          style={{ backgroundColor: THEME.color.warningBg, paddingVertical: THEME.space.md, paddingHorizontal: THEME.space.lg, minHeight: 44, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm }}
        >
          <Ionicons name="cloud-offline-outline" size={15} color={THEME.color.warning} />
          <Text style={{ color: '#92400E', ...THEME.font.label }}>Sin conexión · toca para reintentar</Text>
        </TouchableOpacity>
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.color.brand} colors={[THEME.color.brand]} />}
      >
        {/* ── Hero Premium ────────────────────────────────────────────── */}
        <LinearGradient
          colors={[THEME.color.navy, '#13233A', '#0B1626']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: THEME.space.xxl,
            paddingTop: 52,
            paddingBottom: THEME.space.xxxl,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
          }}
        >
          {/* Top bar: logo + ubicación */}
          <FadeInUp delay={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.xl }}>
              <View style={{
                width: 40, height: 40, borderRadius: THEME.radius.md,
                backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center',
                ...THEME.shadow.brand,
              }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 19 }}>S</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: 1 }}>SOLU</Text>
              {location.distrito ? (
                <View style={{
                  marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  paddingHorizontal: THEME.space.md, paddingVertical: 7, borderRadius: THEME.radius.full,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                }}>
                  <Ionicons name="location" size={12} color={THEME.color.brand} />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{location.distrito}</Text>
                </View>
              ) : null}
            </View>
          </FadeInUp>

          {/* Saludo + título grande */}
          <FadeInUp delay={60}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginBottom: THEME.space.sm }}>
              {greeting}
            </Text>
            <Text style={{ ...THEME.font.display, fontSize: 32, color: '#fff', lineHeight: 38 }}>
              ¿Qué necesitas{'\n'}resolver hoy?
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: THEME.space.sm, marginBottom: THEME.space.xl, fontWeight: '500' }}>
              Escribe tu problema o elige un servicio
            </Text>
          </FadeInUp>

          {/* Buscador prominente */}
          <FadeInUp delay={120}>
            <View style={{
              backgroundColor: THEME.color.surface,
              borderRadius: THEME.radius.lg,
              paddingLeft: THEME.space.lg,
              paddingRight: 5,
              flexDirection: 'row',
              alignItems: 'center',
              gap: THEME.space.sm,
              height: 58,
              borderWidth: searchFocused ? 2 : 0,
              borderColor: THEME.color.brand,
              ...THEME.shadow.lg,
            }}>
              <Ionicons name="search" size={21} color={searchFocused ? THEME.color.brand : THEME.color.inkMuted} />
              <TextInput
                value={query}
                onChangeText={(t) => { setQuery(t); setShowSuggestions(t.length > 0) }}
                onFocus={() => { setSearchFocused(true); setShowSuggestions(query.length > 0) }}
                onBlur={() => setSearchFocused(false)}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                placeholder="Ej: se me rompió el caño"
                placeholderTextColor={THEME.color.inkMuted}
                style={{ flex: 1, fontSize: 15, fontWeight: '600', color: THEME.color.ink, paddingVertical: 0 }}
              />
              <TouchableOpacity
                onPress={handleSearchSubmit}
                accessibilityLabel="Buscar técnico"
                accessibilityRole="button"
                style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.md, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </FadeInUp>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={{
              backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, marginTop: THEME.space.sm,
              paddingVertical: THEME.space.xs, maxHeight: 280,
              ...THEME.shadow.lg,
            }}>
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => pickSuggestion(s)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, paddingVertical: THEME.space.md, paddingHorizontal: THEME.space.lg }}
                  activeOpacity={0.6}
                >
                  <View style={{ width: 30, height: 30, borderRadius: THEME.radius.sm, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="search" size={14} color={THEME.color.brand} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: THEME.color.ink }}>{s}</Text>
                  <Ionicons name="arrow-forward" size={15} color={THEME.color.inkMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Banner cotizar por foto — glass, secundario al buscador */}
          <FadeInUp delay={180}>
            <PressableScale
              onPress={() => router.push('/cotizar-foto')}
              accessibilityLabel="Cotiza con una foto"
              style={{
                marginTop: THEME.space.md, borderRadius: THEME.radius.lg, padding: THEME.space.md,
                flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: THEME.radius.md, backgroundColor: 'rgba(242,107,33,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera" size={20} color={THEME.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Cotiza con una foto</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 }}>Precio estimado en segundos con IA</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.5)" />
            </PressableScale>
          </FadeInUp>

          {/* Emergency link (discreto) */}
          <FadeInUp delay={220}>
            <TouchableOpacity
              onPress={() => router.push('/urgencias')}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: THEME.space.lg, minHeight: 44 }}
            >
              <Ionicons name="flash" size={14} color="#FCA5A5" />
              <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>¿Emergencia? SOS 24/7 →</Text>
            </TouchableOpacity>
          </FadeInUp>

          {/* Stats — cards limpias */}
          <FadeInUp delay={260}>
            <View style={{ flexDirection: 'row', marginTop: THEME.space.sm, gap: THEME.space.sm }}>
              {[
                { label: 'Técnicos', value: stats.techs > 0 ? `${stats.techs}+` : '—' },
                { label: 'Servicios', value: `${stats.servs}+` },
                { label: 'Distritos', value: `${stats.distritos}+` },
              ].map((stat) => (
                <View key={stat.label} style={{
                  flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: THEME.radius.lg,
                  paddingVertical: THEME.space.md, alignItems: 'center',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                }}>
                  <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900' }}>{stat.value}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginTop: 3 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </FadeInUp>
        </LinearGradient>

        {/* ── Pending rating banner ───────────────────────────────────── */}
        {pendingRating ? (
          <FadeInUp delay={60}>
            <PressableScale
              onPress={() => router.push({ pathname: '/calificar/[code]', params: { code: pendingRating.codigo } })}
              accessibilityLabel={`Calificar tu servicio de ${pendingRating.servicio}`}
              style={{ marginHorizontal: THEME.space.lg, marginTop: -THEME.space.lg, marginBottom: THEME.space.sm, backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.lg, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.sm }}
            >
              <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="star" size={19} color="#92400E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#92400E' }}>¿Cómo te fue con {pendingRating.servicio}?</Text>
                <Text style={{ fontSize: 12, color: '#78350F', marginTop: 1 }}>Toca para calificar · ayuda a otros vecinos</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#92400E" />
            </PressableScale>
          </FadeInUp>
        ) : null}

        {/* ── Trust strip — verificación RENIEC (copy NO se toca) ──────── */}
        <FadeInUp delay={pendingRating ? 100 : 60}>
          <View style={{ marginHorizontal: THEME.space.lg, marginTop: pendingRating ? 0 : -THEME.space.lg, marginBottom: THEME.space.md, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={19} color={THEME.color.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#065F46' }}>Identidad verificada</Text>
              <Text style={{ fontSize: 12, color: '#047857', marginTop: 1 }}>Cada técnico valida su DNI con RENIEC antes de aparecer</Text>
            </View>
          </View>
        </FadeInUp>

        {/* ── Servicios populares ─────────────────────────────────────── */}
        <FadeInUp delay={120}>
          <View style={{ paddingHorizontal: THEME.space.lg, paddingTop: THEME.space.xs }}>
            <Text style={{ ...THEME.font.h2, color: THEME.color.ink, marginBottom: THEME.space.lg }}>
              Servicios populares
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {CATEGORIES.map((cat) => {
                const isLast = profile?.lastServicio === cat.name
                return (
                  <PressableScale
                    key={cat.name}
                    onPress={() => {
                      router.push({ pathname: '/solicitar', params: { servicio: cat.name } })
                    }}
                    accessibilityLabel={`Solicitar ${cat.name}`}
                    style={{
                      width: CARD_SIZE,
                      backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg,
                      paddingVertical: THEME.space.md, paddingHorizontal: THEME.space.xs,
                      alignItems: 'center', marginBottom: THEME.space.md,
                      ...(isLast
                        ? { borderWidth: 2, borderColor: cat.color, ...THEME.shadow.md }
                        : THEME.shadow.sm),
                    }}
                  >
                    {isLast ? (
                      <View style={{ position: 'absolute', top: -7, right: -4, backgroundColor: cat.color, borderRadius: THEME.radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>ÚLTIMO</Text>
                      </View>
                    ) : null}
                    <View
                      style={{
                        width: 48, height: 48, borderRadius: THEME.radius.md,
                        backgroundColor: cat.bg,
                        alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.sm,
                      }}
                    >
                      <Ionicons name={cat.icon} size={23} color={cat.color} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.color.inkSoft, textAlign: 'center' }} numberOfLines={1}>
                      {cat.name}
                    </Text>
                  </PressableScale>
                )
              })}
            </View>
            <TouchableOpacity onPress={() => router.push('/buscar')} activeOpacity={0.7} accessibilityRole="button" style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: THEME.space.md, minHeight: 44 }}>
              <Text style={{ color: THEME.color.brand, fontWeight: '700', fontSize: 13 }}>Ver todos los servicios →</Text>
            </TouchableOpacity>
          </View>
        </FadeInUp>

        {/* ── Value props ─────────────────────────────────────────────── */}
        <FadeInUp delay={180}>
          <View style={{ paddingHorizontal: THEME.space.lg, marginBottom: THEME.space.md }}>
            <View style={{
              backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg,
              ...THEME.shadow.md,
            }}>
              {[
                { icon: 'shield-checkmark' as const, color: THEME.color.brand, title: 'Profesionales verificados', desc: 'Identidad validada con DNI en RENIEC' },
                { icon: 'time' as const, color: THEME.color.info, title: 'Respuesta rápida', desc: 'Un técnico en tu puerta en minutos' },
                { icon: 'wallet' as const, color: THEME.color.success, title: 'Pagas al técnico directo', desc: 'Yape, Plin o efectivo · sin cobros extra' },
              ].map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
                  paddingVertical: THEME.space.md,
                  borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: THEME.color.lineSoft,
                }}>
                  <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.color.ink }}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: THEME.color.inkSoft, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </FadeInUp>

        {/* ── Banner técnico — 5,000 SoluCoins GRATIS (navy + gradiente) ── */}
        <FadeInUp delay={240}>
          <PressableScale
            onPress={() => router.push('/registro')}
            accessibilityLabel="Regístrate como técnico y recibe 5,000 SoluCoins gratis"
            style={{ marginHorizontal: THEME.space.lg, marginBottom: THEME.space.md, borderRadius: THEME.radius.xl, overflow: 'hidden', ...THEME.shadow.md }}
          >
            <LinearGradient
              colors={[THEME.color.navy700, THEME.color.navy]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ padding: THEME.space.lg, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}
            >
              <View style={{ width: 48, height: 48, borderRadius: THEME.radius.full, backgroundColor: 'rgba(255,215,0,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="gift" size={25} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>¿Eres técnico? 5,000 SoluCoins GRATIS</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>Regístrate con tu DNI y empieza a recibir clientes hoy</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </PressableScale>
        </FadeInUp>

        {/* ── Profesionales destacados ────────────────────────────────── */}
        <FadeInUp delay={300}>
          <View style={{ paddingHorizontal: THEME.space.lg, paddingTop: THEME.space.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.space.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>Profesionales destacados</Text>
                {topTechs.length > 0 ? <PulseDot color={THEME.color.success} size={7} /> : null}
              </View>
              <TouchableOpacity onPress={() => router.push('/buscar')} activeOpacity={0.7} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ paddingVertical: 6 }}>
                <Text style={{ color: THEME.color.brand, fontWeight: '700', fontSize: 13 }}>Ver todos →</Text>
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
                backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, paddingVertical: THEME.space.xxxl, paddingHorizontal: THEME.space.xl, alignItems: 'center',
                ...THEME.shadow.md,
              }}>
                <View style={{ width: 72, height: 72, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.md }}>
                  <Ionicons name="people" size={34} color={THEME.color.brand} />
                </View>
                <Text style={{ color: THEME.color.ink, fontSize: 16, fontWeight: '800' }}>Sé el primero en pedir</Text>
                <Text style={{ color: THEME.color.inkSoft, marginTop: THEME.space.sm, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>Pronto verás aquí a los profesionales{`\n`}mejor calificados de tu zona</Text>
                <PressableScale
                  onPress={() => router.push('/buscar')}
                  accessibilityLabel="Buscar técnicos"
                  style={{ marginTop: THEME.space.lg, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, paddingHorizontal: THEME.space.xxl, height: 52, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: THEME.space.sm, ...THEME.shadow.brand }}
                >
                  <Ionicons name="search" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Buscar técnicos</Text>
                </PressableScale>
              </View>
            )}
          </View>
        </FadeInUp>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', paddingVertical: THEME.space.xxl, marginTop: THEME.space.sm }}>
          <Text style={{ fontSize: 11, color: THEME.color.inkMuted, fontWeight: '600' }}>SOLU v2.2 · CITYLAND GROUP E.I.R.L.</Text>
          <Text style={{ fontSize: 10, color: THEME.color.inkMuted, marginTop: 3 }}>Profesionales verificados en todo el Perú</Text>
        </View>
      </ScrollView>
      <ChatBot />
    </View>
  )
}
