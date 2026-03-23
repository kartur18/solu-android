import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS, DISTRITOS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'

export default function BuscarScreen() {
  const params = useLocalSearchParams<{ servicio?: string }>()
  const [search, setSearch] = useState(params.servicio || '')
  const [distrito, setDistrito] = useState('')
  const [techs, setTechs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  async function loadTechs() {
    setLoading(true)
    let query = supabase
      .from('tecnicos')
      .select('*')
      .eq('disponible', true)
      .order('plan', { ascending: false })
      .order('calificacion', { ascending: false })
      .limit(30)

    if (search) {
      query = query.or(`oficio.ilike.%${search}%,nombre.ilike.%${search}%`)
    }
    if (distrito) {
      query = query.eq('distrito', distrito)
    }

    const { data } = await query
    setTechs(data || [])
    setLoading(false)
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

        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => setDistrito('')}
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
            {DISTRITOS.slice(0, 15).map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDistrito(distrito === d ? '' : d)}
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
          {SERVICIOS.slice(0, 10).map((s) => (
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

      {/* Results */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.pri} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 13, color: COLORS.gray, marginBottom: 12 }}>
            {techs.length} técnico{techs.length !== 1 ? 's' : ''} encontrado{techs.length !== 1 ? 's' : ''}
          </Text>
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
