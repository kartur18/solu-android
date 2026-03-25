import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS } from '../../src/lib/constants'
import { logger } from '../../src/lib/logger'
import type { Tecnico } from '../../src/lib/types'
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
  const [topTechs, setTopTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)

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
      setOffline(false)
    } catch (err) {
      logger.error('Error loading techs:', err)
      setOffline(true)
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
    {offline && (
      <View style={{ backgroundColor: COLORS.red, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Ionicons name="cloud-offline-outline" size={16} color={COLORS.white} />
        <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: '600' }}>Sin conexión - desliza para reintentar</Text>
      </View>
    )}
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.pri} />}
    >
      {/* Hero */}
      <LinearGradient colors={['#F26B21', '#E85D10', '#D14E00']} style={{ padding: 24, paddingTop: 20, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: COLORS.white, marginBottom: 6, lineHeight: 32 }}>
          ¿Qué necesitas{'\n'}reparar hoy?
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 18 }}>
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
      </LinearGradient>

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

      {/* Fidelidad banner */}
      <TouchableOpacity
        onPress={() => router.push('/fidelidad')}
        style={{
          marginHorizontal: 20, marginTop: 12,
          backgroundColor: '#FFF8E1', borderRadius: 14, padding: 14,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          borderWidth: 1, borderColor: '#FFD700',
        }}
      >
        <Text style={{ fontSize: 24 }}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.dark }}>Programa de Fidelidad</Text>
          <Text style={{ fontSize: 11, color: COLORS.gray }}>Acumula puntos y gana descuentos</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.gray2} />
      </TouchableOpacity>

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
                borderRadius: 16,
                padding: 12,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
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
