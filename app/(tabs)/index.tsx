import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'
import { ChatBot } from '../../src/components/ChatBot'

const CATEGORIES = [
  { name: 'Gasfitería', icon: 'water' as const, color: '#3B82F6' },
  { name: 'Electricidad', icon: 'flash' as const, color: '#F59E0B' },
  { name: 'Pintura', icon: 'color-palette' as const, color: '#8B5CF6' },
  { name: 'Cerrajería', icon: 'key' as const, color: '#EF4444' },
  { name: 'Limpieza', icon: 'sparkles' as const, color: '#10B981' },
  { name: 'Carpintería', icon: 'hammer' as const, color: '#F97316' },
  { name: 'Refrigeración', icon: 'snow' as const, color: '#06B6D4' },
  { name: 'Albañilería', icon: 'construct' as const, color: '#78716C' },
]

export default function HomeScreen() {
  const router = useRouter()
  const [topTechs, setTopTechs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadTopTechs() {
    try {
      const { data } = await supabase
        .from('tecnicos')
        .select('*')
        .eq('disponible', true)
        .order('calificacion', { ascending: false })
        .limit(5)
      setTopTechs(data || [])
    } catch (err) {
      console.error('Error loading techs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTopTechs() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await loadTopTechs()
    setRefreshing(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.light }}>
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.pri} />}
    >
      {/* Hero */}
      <View style={{ backgroundColor: COLORS.pri, padding: 24, paddingTop: 16, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.white, marginBottom: 4 }}>
          ¿Qué necesitas{'\n'}reparar hoy?
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>
          Técnicos verificados en Lima y todo el Perú
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/buscar')}
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 12,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="search" size={20} color={COLORS.gray2} />
          <Text style={{ color: COLORS.gray2, fontSize: 14 }}>Buscar servicio o técnico...</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 0 }}>
        <TouchableOpacity
          onPress={() => router.push('/solicitar')}
          style={{
            flex: 1,
            backgroundColor: COLORS.pri,
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
          }}
        >
          <Ionicons name="build" size={24} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12, marginTop: 6 }}>
            Solicitar técnico
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/registro')}
          style={{
            flex: 1,
            backgroundColor: COLORS.acc,
            borderRadius: 14,
            padding: 16,
            alignItems: 'center',
          }}
        >
          <Ionicons name="person-add" size={24} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 12, marginTop: 6 }}>
            Soy técnico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>
          Servicios
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.name}
              onPress={() => router.push({ pathname: '/buscar', params: { servicio: cat.name } })}
              style={{
                width: '23%',
                backgroundColor: COLORS.white,
                borderRadius: 14,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: cat.color + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Ionicons name={cat.icon} size={20} color={cat.color} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.dark, textAlign: 'center' }}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Top techs */}
      <View style={{ padding: 20, paddingTop: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark }}>
            Mejor valorados
          </Text>
          <TouchableOpacity onPress={() => router.push('/buscar')}>
            <Text style={{ color: COLORS.pri, fontWeight: '600', fontSize: 13 }}>Ver todos →</Text>
          </TouchableOpacity>
        </View>
        {topTechs.map((tech) => (
          <TechCard key={tech.id} tech={tech} />
        ))}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.pri} style={{ marginVertical: 40 }} />
        ) : topTechs.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={40} color={COLORS.gray2} />
            <Text style={{ color: COLORS.gray2, marginTop: 8, fontSize: 13 }}>No hay técnicos disponibles</Text>
          </View>
        ) : null}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
    <ChatBot />
    </View>
  )
}
