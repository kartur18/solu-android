import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS, DISTRITOS, expandSearchToOficios } from '../../src/lib/constants'
import { logger } from '../../src/lib/logger'
import { useLocationDetection } from '../../src/lib/useLocation'
import type { Tecnico } from '../../src/lib/types'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'
import { TechMapView } from '../../src/components/TechMapView'

export default function BuscarScreen() {
  const params = useLocalSearchParams<{ servicio?: string; distrito?: string }>()
  const [search, setSearch] = useState(params.servicio || '')
  const [distrito, setDistrito] = useState(params.distrito || '')
  const [techs, setTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [gpsActive, setGpsActive] = useState(false)

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
        query = query.ilike('distrito', `%${distrito}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setTechs(data || [])
    } catch (err) {
      logger.error('Error loading techs:', err)
      setTechs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTechs() }, [search, distrito])

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* Search bar */}
      <View style={{ padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.light,
            borderRadius: 12,
            paddingHorizontal: 12,
            gap: 8,
          }}>
            <Ionicons name="search" size={18} color={COLORS.gray2} />
            <TextInput
              placeholder="Buscar servicio..."
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: COLORS.dark }}
              placeholderTextColor={COLORS.gray2}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.gray2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* GPS location button */}
          <TouchableOpacity
            onPress={handleRedetectGPS}
            style={{
              backgroundColor: gpsActive ? '#EFF6FF' : COLORS.light,
              borderRadius: 12,
              width: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: gpsActive ? 1.5 : 0,
              borderColor: gpsActive ? COLORS.blue : 'transparent',
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
            style={{
              backgroundColor: showFilters ? COLORS.pri : COLORS.light,
              borderRadius: 12,
              width: 44,
              alignItems: 'center',
              justifyContent: 'center',
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
            marginTop: 8,
            backgroundColor: '#EFF6FF',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            alignSelf: 'flex-start',
          }}>
            <Text style={{ fontSize: 12 }}>{'\uD83D\uDCCD'}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.blue }}>
              Cerca de ti: {distrito}
            </Text>
            <TouchableOpacity onPress={() => { setDistrito(''); setGpsActive(false) }}>
              <Ionicons name="close-circle" size={16} color={COLORS.blue} />
            </TouchableOpacity>
          </View>
        ) : null}

        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => { setDistrito(''); setGpsActive(false) }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: !distrito ? COLORS.pri : COLORS.light,
                marginRight: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: !distrito ? COLORS.white : COLORS.gray }}>
                Todos
              </Text>
            </TouchableOpacity>
            {DISTRITOS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => { setDistrito(distrito === d ? '' : d); setGpsActive(false) }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: distrito === d ? COLORS.pri : COLORS.light,
                  marginRight: 6,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: distrito === d ? COLORS.white : COLORS.gray }}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Service chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {SERVICIOS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSearch(search === s ? '' : s)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: search === s ? COLORS.pri : COLORS.white,
                borderWidth: 1,
                borderColor: search === s ? COLORS.pri : COLORS.border,
                marginRight: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: search === s ? COLORS.white : COLORS.gray }}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* View toggle + Results */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: viewMode === 'list' ? COLORS.pri : COLORS.white, borderWidth: 1, borderColor: viewMode === 'list' ? COLORS.pri : COLORS.border }}
        >
          <Ionicons name="list" size={14} color={viewMode === 'list' ? COLORS.white : COLORS.gray} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: viewMode === 'list' ? COLORS.white : COLORS.gray }}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('map')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: viewMode === 'map' ? COLORS.pri : COLORS.white, borderWidth: 1, borderColor: viewMode === 'map' ? COLORS.pri : COLORS.border }}
        >
          <Ionicons name="map" size={14} color={viewMode === 'map' ? COLORS.white : COLORS.gray} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: viewMode === 'map' ? COLORS.white : COLORS.gray }}>Mapa</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, color: COLORS.gray, alignSelf: 'center' }}>
          {techs.length} resultado{techs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.pri} />
        </View>
      ) : viewMode === 'map' ? (
        <View style={{ padding: 16 }}>
          <TechMapView techs={techs} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {techs.map((tech) => (
            <TechCard key={tech.id} tech={tech} />
          ))}
          {techs.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={48} color={COLORS.gray2} />
              <Text style={{ color: COLORS.gray, marginTop: 12, fontSize: 14, fontWeight: '600' }}>
                No se encontraron técnicos
              </Text>
              <Text style={{ color: COLORS.gray2, marginTop: 4, fontSize: 12, textAlign: 'center' }}>
                Intenta con otro servicio o distrito
              </Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}
