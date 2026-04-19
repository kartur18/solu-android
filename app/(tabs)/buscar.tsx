import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Animated, Keyboard, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS, DISTRITOS, expandSearchToOficios } from '../../src/lib/constants'
import { logger } from '../../src/lib/logger'
import { useLocationDetection } from '../../src/lib/useLocation'
import type { Tecnico } from '../../src/lib/types'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'
import { SearchSkeleton } from '../../src/components/SkeletonLoader'
import { TechMapView } from '../../src/components/TechMapView'
import { OfflineBanner } from '../../src/components/OfflineBanner'
import { useFavorites } from '../../src/lib/useFavorites'
import { cacheSearchResults, getCachedSearchResults } from '../../src/lib/offlineCache'

function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateAnim = useRef(new Animated.Value(12)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: translateAnim }] }}>
      {children}
    </Animated.View>
  )
}

export default function BuscarScreen() {
  const params = useLocalSearchParams<{ servicio?: string; distrito?: string }>()
  const [search, setSearch] = useState(params.servicio || '')
  const [distrito, setDistrito] = useState(params.distrito || '')
  const [techs, setTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
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
    if (search.trim()) saveToHistory(search.trim())
    try {
      let query = supabase
        .from('tecnicos')
        .select('*')
        .eq('disponible', true)
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
      setTechs(data || [])
      if (data && data.length > 0) cacheSearchResults(data)
      resultsKey.current += 1
    } catch (err) {
      logger.error('Error loading techs:', err)
      // Try loading from cache when offline
      const cached = await getCachedSearchResults()
      if (cached) setTechs(cached)
      else setTechs([])
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
    <View style={{ flex: 1, backgroundColor: COLORS.light }}>
      <OfflineBanner />
      {/* Search bar */}
      <View style={{
        padding: 16,
        paddingBottom: 12,
        backgroundColor: COLORS.white,
        shadowColor: '#1E3A5F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 6,
        zIndex: 10,
        borderBottomWidth: 0,
      }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F1F5F9',
            borderRadius: 14,
            paddingHorizontal: 14,
            gap: 10,
            height: 48,
            borderWidth: 1.5,
            borderColor: '#E2E8F0',
          }}>
            <Ionicons name="search" size={20} color={COLORS.gray2} />
            <TextInput
              placeholder="Buscar servicio o técnico..."
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, fontSize: 15, color: COLORS.dark, fontWeight: '500', paddingVertical: 12 }}
              placeholderTextColor={COLORS.gray2}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={COLORS.gray2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* GPS location button */}
          <TouchableOpacity
            onPress={handleRedetectGPS}
            activeOpacity={0.7}
            style={{
              backgroundColor: gpsActive ? '#EFF6FF' : '#F1F5F9',
              borderRadius: 14,
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: gpsActive ? 1.5 : 1.5,
              borderColor: gpsActive ? COLORS.blue : '#E2E8F0',
            }}
          >
            {location.loading ? (
              <ActivityIndicator size="small" color={COLORS.blue} />
            ) : (
              <Ionicons
                name={gpsActive ? 'navigate' : 'navigate-outline'}
                size={20}
                color={gpsActive ? COLORS.blue : COLORS.gray}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
            style={{
              backgroundColor: showFilters ? '#1E3A5F' : '#F1F5F9',
              borderRadius: 14,
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: showFilters ? 0 : 1.5,
              borderColor: '#E2E8F0',
            }}
          >
            <Ionicons name="options" size={20} color={showFilters ? COLORS.white : COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* GPS active badge */}
        {gpsActive && distrito ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            backgroundColor: '#EFF6FF',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: '#BFDBFE',
          }}>
            <Ionicons name="navigate" size={13} color={COLORS.blue} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.blue }}>
              Cerca de ti: {distrito}
            </Text>
            <TouchableOpacity onPress={() => { setDistrito(''); setGpsActive(false) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.blue} />
            </TouchableOpacity>
          </View>
        ) : null}

        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ paddingRight: 16 }}>
            <TouchableOpacity
              onPress={() => { setDistrito(''); setGpsActive(false) }}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: !distrito ? '#1E3A5F' : '#F1F5F9',
                marginRight: 8,
                borderWidth: distrito ? 1 : 0,
                borderColor: '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: !distrito ? COLORS.white : COLORS.gray }}>
                Todos
              </Text>
            </TouchableOpacity>
            {DISTRITOS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => { setDistrito(distrito === d ? '' : d); setGpsActive(false) }}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: distrito === d ? '#1E3A5F' : '#F1F5F9',
                  marginRight: 8,
                  borderWidth: distrito === d ? 0 : 1,
                  borderColor: '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: distrito === d ? COLORS.white : COLORS.dark }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Service chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ paddingRight: 16 }}>
          {SERVICIOS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSearch(search === s ? '' : s)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: search === s ? COLORS.pri : COLORS.white,
                borderWidth: 1.5,
                borderColor: search === s ? COLORS.pri : '#E2E8F0',
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: search === s ? COLORS.white : COLORS.dark }}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search suggestions dropdown */}
      {searchFocused && (
        <View style={{
          backgroundColor: COLORS.white,
          marginHorizontal: 16,
          marginTop: 4,
          borderRadius: 14,
          shadowColor: '#1E3A5F',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 6,
          zIndex: 20,
          maxHeight: 320,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#E2E8F0',
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
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <Ionicons name="search" size={16} color={COLORS.gray2} />
                    <Text style={{ fontSize: 14, color: COLORS.dark, fontWeight: '500' }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ padding: 16 }}>
              {/* Recent searches */}
              {searchHistory.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray2, marginBottom: 10 }}>
                    Recientes:
                  </Text>
                  {searchHistory.map((s) => (
                    <View
                      key={s}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F1F5F9',
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          setSearch(s)
                          setSearchFocused(false)
                          Keyboard.dismiss()
                        }}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                      >
                        <Ionicons name="time-outline" size={16} color={COLORS.gray2} />
                        <Text style={{ fontSize: 14, color: COLORS.dark, fontWeight: '500' }}>{s}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeFromHistory(s)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={16} color={COLORS.gray2} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={clearHistory} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.pri }}>Borrar historial</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Popular searches */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray2, marginBottom: 10 }}>
                Busquedas populares:
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
                    gap: 10,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                  }}
                >
                  <Ionicons name="trending-up" size={16} color={COLORS.pri} />
                  <Text style={{ fontSize: 14, color: COLORS.dark, fontWeight: '500' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* View toggle + Results */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
            backgroundColor: viewMode === 'list' ? '#1E3A5F' : COLORS.white,
            borderWidth: viewMode === 'list' ? 0 : 1.5,
            borderColor: '#E2E8F0',
          }}
        >
          <Ionicons name="list" size={14} color={viewMode === 'list' ? COLORS.white : COLORS.gray} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: viewMode === 'list' ? COLORS.white : COLORS.gray }}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('map')}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
            backgroundColor: viewMode === 'map' ? '#1E3A5F' : COLORS.white,
            borderWidth: viewMode === 'map' ? 0 : 1.5,
            borderColor: '#E2E8F0',
          }}
        >
          <Ionicons name="map" size={14} color={viewMode === 'map' ? COLORS.white : COLORS.gray} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: viewMode === 'map' ? COLORS.white : COLORS.gray }}>Mapa</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, color: COLORS.gray, fontWeight: '600' }}>
          {filteredTechs.length} resultado{filteredTechs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, paddingHorizontal: 16, marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {[
            { key: 'favorites', label: 'Favoritos', active: filterFavorites, onPress: () => setFilterFavorites(!filterFavorites), color: '#EF4444' },
            { key: 'rating', label: '★ 4.5+', active: filterRating, onPress: () => setFilterRating(!filterRating), color: '#1E3A5F' },
            { key: 'verified', label: 'Verificados', active: filterVerified, onPress: () => setFilterVerified(!filterVerified), color: '#1E3A5F' },
            { key: 'price', label: 'Menor precio', active: sortPrice, onPress: () => setSortPrice(!sortPrice), color: '#1E3A5F' },
            { key: 'available', label: 'Disponibles', active: filterAvailable, onPress: () => setFilterAvailable(!filterAvailable), color: '#16A34A' },
            { key: 'services', label: 'Más contratados', active: sortBy === 'services', onPress: () => setSortBy(sortBy === 'services' ? '' : 'services'), color: '#1E3A5F' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={f.onPress}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                backgroundColor: f.active ? f.color : '#fff',
                borderWidth: 1, borderColor: f.active ? f.color : '#E2E8F0',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: f.active ? '#fff' : COLORS.gray }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          {anyFilterActive && (
            <TouchableOpacity
              onPress={clearAllFilters}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                backgroundColor: '#FEF2F2',
                borderWidth: 1, borderColor: '#FECACA',
              }}
            >
              <Ionicons name="close-circle" size={14} color="#EF4444" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {loading ? (
        <SearchSkeleton />
      ) : viewMode === 'map' ? (
        <View style={{ padding: 16 }}>
          <TechMapView techs={filteredTechs} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          {filteredTechs.map((tech, index) => (
            <FadeInView key={`${tech.id}-${resultsKey.current}`} delay={index * 60}>
              <TechCard tech={tech} onToggleFavorite={toggleFavorite} isFavorite={isFavorite(tech.id)} />
            </FadeInView>
          ))}
          {filteredTechs.length === 0 && (
            <View style={{
              padding: 50, alignItems: 'center',
              backgroundColor: COLORS.white, borderRadius: 20, marginTop: 20,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
            }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Ionicons name="search-outline" size={40} color={COLORS.gray2} />
              </View>
              <Text style={{ color: COLORS.dark, fontSize: 16, fontWeight: '700' }}>
                Sin resultados
              </Text>
              <Text style={{ color: COLORS.gray2, marginTop: 6, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 }}>
                No encontramos técnicos para tu búsqueda.{'\n'}Prueba con otro servicio o distrito.
              </Text>
              <TouchableOpacity
                onPress={() => { setSearch(''); setDistrito('') }}
                activeOpacity={0.8}
                style={{
                  marginTop: 18,
                  backgroundColor: '#1E3A5F',
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>Limpiar filtros</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </View>
  )
}
