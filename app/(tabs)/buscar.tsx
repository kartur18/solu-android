import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SERVICIOS, DISTRITOS, expandSearchToOficios } from '../../src/lib/constants'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, Shimmer, PressableScale } from '../../src/components/ui/Motion'
import { logger } from '../../src/lib/logger'
import { useLocationDetection } from '../../src/lib/useLocation'
import type { Tecnico } from '../../src/lib/types'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'
import { TECNICO_PUBLIC_SELECT } from '../../src/lib/tecnico-columns'
import { TechMapView } from '../../src/components/TechMapView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useFavorites } from '../../src/lib/useFavorites'
import { cacheSearchResults, getCachedSearchResults } from '../../src/lib/offlineCache'

// Skeleton de una TechCard con la forma del contenido real (Shimmer).
function TechCardShimmer() {
  return (
    <View style={{
      backgroundColor: THEME.color.surface,
      borderRadius: THEME.radius.xl,
      padding: THEME.space.lg,
      marginBottom: THEME.space.md,
      ...THEME.shadow.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Shimmer style={{ width: 64, height: 64, borderRadius: THEME.radius.lg, marginRight: THEME.space.md }} />
        <View style={{ flex: 1, gap: THEME.space.sm }}>
          <Shimmer style={{ width: '55%', height: 16, borderRadius: 6 }} />
          <Shimmer style={{ width: '38%', height: 12, borderRadius: 6 }} />
          <Shimmer style={{ width: '48%', height: 12, borderRadius: 6 }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.md }}>
        <Shimmer style={{ width: 84, height: 22, borderRadius: THEME.radius.sm }} />
        <Shimmer style={{ width: 100, height: 22, borderRadius: THEME.radius.sm }} />
      </View>
      <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.lg }}>
        <Shimmer style={{ flex: 1, height: 48, borderRadius: THEME.radius.lg }} />
        <Shimmer style={{ width: 48, height: 48, borderRadius: THEME.radius.lg }} />
      </View>
    </View>
  )
}

function SearchShimmerList() {
  return (
    <View style={{ paddingHorizontal: THEME.space.lg, paddingTop: THEME.space.sm }}>
      {[0, 1, 2, 3].map((i) => (
        <FadeInUp key={i} delay={i * 80}>
          <TechCardShimmer />
        </FadeInUp>
      ))}
    </View>
  )
}

export default function BuscarScreen() {
  const params = useLocalSearchParams<{ servicio?: string; distrito?: string }>()
  const [search, setSearch] = useState(params.servicio || '')
  const [distrito, setDistrito] = useState(params.distrito || '')
  const [techs, setTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [gpsActive, setGpsActive] = useState(false)
  const { favorites, toggleFavorite, isFavorite } = useFavorites()
  const [filterFavorites, setFilterFavorites] = useState(false)
  const [filterRating, setFilterRating] = useState(false)
  const [filterVerified, setFilterVerified] = useState(false)
  const [sortPrice, setSortPrice] = useState(false)
  const [sortBy, setSortBy] = useState<'rating' | 'price' | 'services' | ''>('')
  const [filterAvailable, setFilterAvailable] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const resultsKey = useRef(0)

  const POPULAR_SEARCHES = SERVICIOS.slice(0, 5)
  const suggestions = searchFocused
    ? search.trim()
      ? SERVICIOS.filter(s => s.toLowerCase().includes(search.toLowerCase()))
      : []
    : []

  // Load search history from storage
  useEffect(() => {
    AsyncStorage.getItem('solu_search_history').then((stored) => {
      if (stored) try { setSearchHistory(JSON.parse(stored)) } catch {}
    })
  }, [])

  function saveToHistory(term: string) {
    const trimmed = term.trim()
    if (!trimmed) return
    setSearchHistory(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())
      const next = [trimmed, ...filtered].slice(0, 10)
      AsyncStorage.setItem('solu_search_history', JSON.stringify(next))
      return next
    })
  }

  function removeFromHistory(term: string) {
    setSearchHistory(prev => {
      const next = prev.filter(s => s !== term)
      AsyncStorage.setItem('solu_search_history', JSON.stringify(next))
      return next
    })
  }

  function clearHistory() {
    setSearchHistory([])
    AsyncStorage.removeItem('solu_search_history')
  }

  // Apply client-side filters
  const anyFilterActive = filterRating || filterVerified || sortPrice || filterAvailable || sortBy !== '' || filterFavorites
  const filteredTechs = techs.filter(t => {
    if (filterFavorites && !isFavorite(t.id)) return false
    if (filterRating && (t.calificacion || 0) < 4.5) return false
    if (filterVerified && !t.verificado) return false
    if (filterAvailable && !t.disponible) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'services') return (b.servicios_completados || 0) - (a.servicios_completados || 0)
    if (sortPrice) return (a.precio_desde || 999) - (b.precio_desde || 999)
    return 0
  })

  function clearAllFilters() {
    setFilterFavorites(false)
    setFilterRating(false)
    setFilterVerified(false)
    setSortPrice(false)
    setSortBy('')
    setFilterAvailable(false)
  }

  const location = useLocationDetection()

  // Auto-detect location on mount (only if no distrito param was passed)
  useEffect(() => {
    if (params.distrito) {
      setGpsActive(false)
      return
    }
    ;(async () => {
      const detected = await location.detectLocation()
      if (detected) {
        setDistrito(detected)
        setGpsActive(true)
        setShowFilters(true)
      }
    })()
  }, [])

  // If distrito param changes externally, update state
  useEffect(() => {
    if (params.distrito) {
      setDistrito(params.distrito)
      setGpsActive(false)
    }
  }, [params.distrito])

  async function handleRedetectGPS() {
    const detected = await location.detectLocation()
    if (detected) {
      setDistrito(detected)
      setGpsActive(true)
      setShowFilters(true)
    }
  }

  async function loadTechs() {
    setLoading(true)
    setLoadError(false)
    if (search.trim()) saveToHistory(search.trim())
    try {
      let query = supabase
        .from('tecnicos')
        .select(TECNICO_PUBLIC_SELECT)
        .eq('disponible', true)
        .eq('verificado', true)
        // Paridad con la web: no mostrar técnicos borrados (soft-delete) ni
        // cuentas de prueba e2e. Antes la app exponía técnicos que la web oculta.
        .is('deleted_at', null)
        .not('nombre', 'ilike', 'e2e-test%')
        .order('plan', { ascending: false })
        .order('calificacion', { ascending: false })
        .limit(30)

      if (search) {
        const safe = search.replace(/[,().%\\]/g, '')
        // Expandir busqueda: si busca "Gasfiteria", tambien busca "Gasfitero"
        const relatedOficios = expandSearchToOficios(safe)
        const filters = [`oficio.ilike.%${safe}%`, `nombre.ilike.%${safe}%`]
        for (const oficio of relatedOficios) {
          filters.push(`oficio.ilike.%${oficio}%`)
        }
        query = query.or(filters.join(','))
      }
      if (distrito) {
        query = query.or(`distrito.ilike.%${distrito}%`)
      }

      const { data, error } = await query
      if (error) throw error
      const techs = (data as unknown as Tecnico[]) || []
      setTechs(techs)
      if (techs.length > 0) cacheSearchResults(techs)
      resultsKey.current += 1
    } catch (err) {
      logger.error('Error loading techs:', err)
      // Try loading from cache when offline
      const cached = await getCachedSearchResults()
      if (cached) setTechs(cached)
      else { setTechs([]); setLoadError(true) }
    } finally {
      setLoading(false)
    }
  }

  // Debounce search to prevent double execution
  useEffect(() => {
    const timer = setTimeout(() => { loadTechs() }, 300)
    return () => clearTimeout(timer)
  }, [search, distrito])

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      <OfflineBanner />
      {/* Header: barra de búsqueda + acciones */}
      <View style={{
        paddingHorizontal: THEME.space.lg,
        paddingTop: THEME.space.lg,
        paddingBottom: THEME.space.md,
        backgroundColor: THEME.color.surface,
        borderBottomLeftRadius: THEME.radius.xxl,
        borderBottomRightRadius: THEME.radius.xxl,
        zIndex: 10,
        ...THEME.shadow.md,
      }}>
        <View style={{ flexDirection: 'row', gap: THEME.space.sm }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: THEME.color.surfaceAlt,
            borderRadius: THEME.radius.lg,
            paddingHorizontal: THEME.space.md,
            gap: THEME.space.sm,
            height: 52,
          }}>
            <Ionicons name="search" size={20} color={THEME.color.inkMuted} />
            <TextInput
              placeholder="Buscar servicio o técnico"
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, ...THEME.font.body, color: THEME.color.ink, paddingVertical: 12 }}
              placeholderTextColor={THEME.color.inkMuted}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Limpiar búsqueda">
                <Ionicons name="close-circle" size={20} color={THEME.color.inkMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Botón GPS */}
          <PressableScale
            onPress={handleRedetectGPS}
            accessibilityLabel="Detectar mi ubicación"
            style={{
              backgroundColor: gpsActive ? THEME.color.infoBg : THEME.color.surfaceAlt,
              borderRadius: THEME.radius.lg,
              width: 52,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {location.loading ? (
              <ActivityIndicator size="small" color={THEME.color.info} />
            ) : (
              <Ionicons
                name={gpsActive ? 'navigate' : 'navigate-outline'}
                size={20}
                color={gpsActive ? THEME.color.info : THEME.color.inkSoft}
              />
            )}
          </PressableScale>

          {/* Botón filtros */}
          <PressableScale
            onPress={() => setShowFilters(!showFilters)}
            accessibilityLabel="Filtrar por distrito"
            style={{
              backgroundColor: showFilters ? THEME.color.navy : THEME.color.surfaceAlt,
              borderRadius: THEME.radius.lg,
              width: 52,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="options" size={20} color={showFilters ? THEME.color.white : THEME.color.inkSoft} />
          </PressableScale>
        </View>

        {/* Badge GPS activo */}
        {gpsActive && distrito ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: THEME.space.md,
            backgroundColor: THEME.color.infoBg,
            paddingHorizontal: THEME.space.md,
            paddingVertical: THEME.space.sm,
            borderRadius: THEME.radius.full,
            alignSelf: 'flex-start',
          }}>
            <Ionicons name="navigate" size={13} color={THEME.color.info} />
            <Text style={{ ...THEME.font.label, color: THEME.color.info }}>
              Cerca de ti: {distrito}
            </Text>
            <TouchableOpacity onPress={() => { setDistrito(''); setGpsActive(false) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Quitar ubicación">
              <Ionicons name="close-circle" size={16} color={THEME.color.info} />
            </TouchableOpacity>
          </View>
        ) : null}

        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: THEME.space.md }} contentContainerStyle={{ paddingRight: THEME.space.lg, gap: THEME.space.sm }}>
            <TouchableOpacity
              onPress={() => { setDistrito(''); setGpsActive(false) }}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: THEME.space.lg,
                paddingVertical: THEME.space.sm,
                borderRadius: THEME.radius.full,
                backgroundColor: !distrito ? THEME.color.navy : THEME.color.surfaceAlt,
              }}
            >
              <Text style={{ ...THEME.font.label, color: !distrito ? THEME.color.white : THEME.color.inkSoft }}>
                Todos
              </Text>
            </TouchableOpacity>
            {DISTRITOS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => { setDistrito(distrito === d ? '' : d); setGpsActive(false) }}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: THEME.space.lg,
                  paddingVertical: THEME.space.sm,
                  borderRadius: THEME.radius.full,
                  backgroundColor: distrito === d ? THEME.color.navy : THEME.color.surfaceAlt,
                }}
              >
                <Text style={{ ...THEME.font.label, color: distrito === d ? THEME.color.white : THEME.color.ink }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Chips de servicio */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: THEME.space.md }} contentContainerStyle={{ paddingRight: THEME.space.lg, gap: THEME.space.sm }}>
          {SERVICIOS.map((s) => {
            const active = search === s
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setSearch(active ? '' : s)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: THEME.space.lg,
                  paddingVertical: THEME.space.sm,
                  borderRadius: THEME.radius.full,
                  backgroundColor: active ? THEME.color.brand : THEME.color.brandLight,
                }}
              >
                <Text style={{ ...THEME.font.label, color: active ? THEME.color.white : THEME.color.brandDark }}>
                  {s}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Dropdown de sugerencias */}
      {searchFocused && (
        <View style={{
          backgroundColor: THEME.color.surface,
          marginHorizontal: THEME.space.lg,
          marginTop: THEME.space.sm,
          borderRadius: THEME.radius.lg,
          ...THEME.shadow.lg,
          zIndex: 20,
          maxHeight: 320,
          overflow: 'hidden',
        }}>
          {search.trim() ? (
            suggestions.length > 0 ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => {
                      setSearch(s)
                      setSearchFocused(false)
                      Keyboard.dismiss()
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: THEME.space.sm,
                      paddingHorizontal: THEME.space.lg,
                      paddingVertical: THEME.space.md,
                      borderBottomWidth: 1,
                      borderBottomColor: THEME.color.lineSoft,
                    }}
                  >
                    <Ionicons name="search" size={16} color={THEME.color.inkMuted} />
                    <Text style={{ ...THEME.font.body, color: THEME.color.ink }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ padding: THEME.space.lg }}>
              {/* Búsquedas recientes */}
              {searchHistory.length > 0 && (
                <View style={{ marginBottom: THEME.space.lg }}>
                  <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted, marginBottom: THEME.space.sm }}>
                    Recientes
                  </Text>
                  {searchHistory.map((s) => (
                    <View
                      key={s}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: THEME.space.sm,
                        borderBottomWidth: 1,
                        borderBottomColor: THEME.color.lineSoft,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          setSearch(s)
                          setSearchFocused(false)
                          Keyboard.dismiss()
                        }}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}
                      >
                        <Ionicons name="time-outline" size={16} color={THEME.color.inkMuted} />
                        <Text style={{ ...THEME.font.body, color: THEME.color.ink }}>{s}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeFromHistory(s)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Quitar ${s} del historial`}
                      >
                        <Ionicons name="close" size={16} color={THEME.color.inkMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={clearHistory} style={{ marginTop: THEME.space.sm }}>
                    <Text style={{ ...THEME.font.label, color: THEME.color.brand }}>Borrar historial</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Búsquedas populares */}
              <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted, marginBottom: THEME.space.sm }}>
                Búsquedas populares
              </Text>
              {POPULAR_SEARCHES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => {
                    setSearch(s)
                    setSearchFocused(false)
                    Keyboard.dismiss()
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: THEME.space.sm,
                    paddingVertical: THEME.space.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: THEME.color.lineSoft,
                  }}
                >
                  <Ionicons name="trending-up" size={16} color={THEME.color.brand} />
                  <Text style={{ ...THEME.font.body, color: THEME.color.ink }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Toggle de vista + contador */}
      <View style={{ flexDirection: 'row', paddingHorizontal: THEME.space.lg, paddingTop: THEME.space.md, paddingBottom: THEME.space.xs, gap: THEME.space.xs, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', backgroundColor: THEME.color.surfaceSunken, borderRadius: THEME.radius.md, padding: 3 }}>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
            accessibilityLabel="Ver en lista"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: THEME.space.md, paddingVertical: 7, borderRadius: THEME.radius.sm,
              backgroundColor: viewMode === 'list' ? THEME.color.surface : 'transparent',
              ...(viewMode === 'list' ? THEME.shadow.sm : {}),
            }}
          >
            <Ionicons name="list" size={15} color={viewMode === 'list' ? THEME.color.navy : THEME.color.inkMuted} />
            <Text style={{ ...THEME.font.label, color: viewMode === 'list' ? THEME.color.navy : THEME.color.inkMuted }}>Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('map')}
            activeOpacity={0.8}
            accessibilityLabel="Ver en mapa"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: THEME.space.md, paddingVertical: 7, borderRadius: THEME.radius.sm,
              backgroundColor: viewMode === 'map' ? THEME.color.surface : 'transparent',
              ...(viewMode === 'map' ? THEME.shadow.sm : {}),
            }}
          >
            <Ionicons name="map" size={15} color={viewMode === 'map' ? THEME.color.navy : THEME.color.inkMuted} />
            <Text style={{ ...THEME.font.label, color: viewMode === 'map' ? THEME.color.navy : THEME.color.inkMuted }}>Mapa</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ flex: 1, textAlign: 'right', ...THEME.font.label, color: THEME.color.inkSoft }}>
          {filteredTechs.length} resultado{filteredTechs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Chips de filtro */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48, paddingHorizontal: THEME.space.lg, marginBottom: THEME.space.xs }} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: THEME.space.xs, alignItems: 'center' }}>
          {[
            { key: 'favorites', label: 'Favoritos', icon: 'heart' as const, active: filterFavorites, onPress: () => setFilterFavorites(!filterFavorites), color: THEME.color.danger },
            { key: 'rating', label: '4.5+', icon: 'star' as const, active: filterRating, onPress: () => setFilterRating(!filterRating), color: THEME.color.warning },
            { key: 'verified', label: 'Verificados', icon: 'checkmark-circle' as const, active: filterVerified, onPress: () => setFilterVerified(!filterVerified), color: THEME.color.success },
            { key: 'price', label: 'Menor precio', icon: 'pricetag' as const, active: sortPrice, onPress: () => setSortPrice(!sortPrice), color: THEME.color.navy },
            { key: 'available', label: 'Disponibles', icon: 'ellipse' as const, active: filterAvailable, onPress: () => setFilterAvailable(!filterAvailable), color: THEME.color.success },
            { key: 'services', label: 'Más contratados', icon: 'people' as const, active: sortBy === 'services', onPress: () => setSortBy(sortBy === 'services' ? '' : 'services'), color: THEME.color.navy },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={f.onPress}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm, borderRadius: THEME.radius.full,
                backgroundColor: f.active ? f.color : THEME.color.surface,
                ...(f.active ? {} : THEME.shadow.sm),
              }}
            >
              <Ionicons name={f.icon} size={13} color={f.active ? THEME.color.white : f.color} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: f.active ? THEME.color.white : THEME.color.inkSoft }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          {anyFilterActive && (
            <TouchableOpacity
              onPress={clearAllFilters}
              activeOpacity={0.8}
              accessibilityLabel="Limpiar todos los filtros"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm, borderRadius: THEME.radius.full,
                backgroundColor: THEME.color.dangerBg,
              }}
            >
              <Ionicons name="close-circle" size={14} color={THEME.color.danger} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.danger }}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {loading ? (
        <SearchShimmerList />
      ) : viewMode === 'map' ? (
        <View style={{ padding: THEME.space.lg }}>
          <TechMapView techs={filteredTechs} />
        </View>
      ) : loadError ? (
        // Estado de error: ícono + mensaje + Reintentar.
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: THEME.space.lg }} keyboardShouldPersistTaps="handled">
          <FadeInUp>
            <View style={{
              padding: THEME.space.xxxl, alignItems: 'center',
              backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xxl, marginTop: THEME.space.xl,
              ...THEME.shadow.md,
            }}>
              <View style={{
                width: 88, height: 88, borderRadius: THEME.radius.full,
                backgroundColor: THEME.color.dangerBg, alignItems: 'center', justifyContent: 'center',
                marginBottom: THEME.space.lg,
              }}>
                <Ionicons name="cloud-offline-outline" size={42} color={THEME.color.danger} />
              </View>
              <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>Algo salió mal</Text>
              <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center', lineHeight: 21 }}>
                No pudimos cargar los técnicos.{'\n'}Revisa tu conexión e inténtalo de nuevo.
              </Text>
              <PressableScale
                onPress={() => loadTechs()}
                accessibilityLabel="Reintentar búsqueda"
                style={{
                  marginTop: THEME.space.xl,
                  height: 52,
                  paddingHorizontal: THEME.space.xxl,
                  backgroundColor: THEME.color.brand,
                  borderRadius: THEME.radius.lg,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs,
                  ...THEME.shadow.brand,
                }}
              >
                <Ionicons name="refresh" size={18} color={THEME.color.white} />
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Reintentar</Text>
              </PressableScale>
            </View>
          </FadeInUp>
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: THEME.space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {filteredTechs.map((tech, index) => (
            <FadeInUp key={`${tech.id}-${resultsKey.current}`} delay={Math.min(index * 60, 360)}>
              <TechCard tech={tech} onToggleFavorite={toggleFavorite} isFavorite={isFavorite(tech.id)} />
            </FadeInUp>
          ))}
          {filteredTechs.length === 0 && (
            <FadeInUp>
              <View style={{
                padding: THEME.space.xxxl, alignItems: 'center',
                backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xxl, marginTop: THEME.space.xl,
                ...THEME.shadow.md,
              }}>
                <View style={{
                  width: 88, height: 88, borderRadius: THEME.radius.full,
                  backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center',
                  marginBottom: THEME.space.lg,
                }}>
                  <Ionicons name="search-outline" size={42} color={THEME.color.brand} />
                </View>
                <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>
                  No encontramos técnicos
                </Text>
                <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center', lineHeight: 21 }}>
                  Ajusta los filtros o prueba con otro{'\n'}servicio o distrito.
                </Text>
                <PressableScale
                  onPress={() => { setSearch(''); setDistrito(''); clearAllFilters() }}
                  accessibilityLabel="Limpiar filtros y búsqueda"
                  style={{
                    marginTop: THEME.space.xl,
                    height: 52,
                    paddingHorizontal: THEME.space.xxl,
                    backgroundColor: THEME.color.brand,
                    borderRadius: THEME.radius.lg,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs,
                    ...THEME.shadow.brand,
                  }}
                >
                  <Ionicons name="refresh" size={18} color={THEME.color.white} />
                  <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Limpiar filtros</Text>
                </PressableScale>
              </View>
            </FadeInUp>
          )}
        </ScrollView>
      )}
    </View>
  )
}
