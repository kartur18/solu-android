import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { logger } from '../../src/lib/logger'
import { useLocationDetection } from '../../src/lib/useLocation'
import type { Tecnico } from '../../src/lib/types'
import { supabase } from '../../src/lib/supabase'
import { TechCard } from '../../src/components/TechCard'
import { ChatBot } from '../../src/components/ChatBot'

const { width } = Dimensions.get('window')
const CARD_SIZE = (width - 60) / 4

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

const TRUST_STATS = [
  { label: 'Técnicos', value: '50+', icon: 'people' as const },
  { label: 'Servicios', value: '100+', icon: 'construct' as const },
  { label: 'Distritos', value: '95+', icon: 'location' as const },
]

export default function HomeScreen() {
  const router = useRouter()
  const [topTechs, setTopTechs] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)
  const location = useLocationDetection()

  // Detect location on mount
  useEffect(() => {
    location.detectLocation()
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
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {offline && (
        <View style={{ backgroundColor: '#FEE2E2', padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Ionicons name="cloud-offline-outline" size={14} color={COLORS.red} />
          <Text style={{ color: COLORS.red, fontSize: 11, fontWeight: '600' }}>Sin conexión - desliza para reintentar</Text>
        </View>
      )}
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
      >
        {/* Hero - Azul oscuro profesional */}
        <LinearGradient
          colors={['#1E3A5F', '#162D4A', '#0F2035']}
          style={{ padding: 24, paddingTop: 16, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.pri, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>S</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>SOLU</Text>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.green }} />
              <Text style={{ color: COLORS.green, fontSize: 10, fontWeight: '600' }}>En todo el Perú</Text>
            </View>
          </View>

          <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4, lineHeight: 30 }}>
            ¿Qué necesitas{'\n'}reparar hoy?
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
            Técnicos verificados con DNI · Contacto directo
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/buscar')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Buscar servicio o técnico...</Text>
          </TouchableOpacity>

          {/* Trust stats */}
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
            {TRUST_STATS.map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{stat.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '600', marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: -14 }}>
          <TouchableOpacity
            onPress={() => router.push('/solicitar')}
            style={{
              flex: 1,
              backgroundColor: COLORS.pri,
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: COLORS.pri,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Ionicons name="build" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Solicitar técnico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/registro')}
            style={{
              flex: 1,
              backgroundColor: '#fff',
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1.5,
              borderColor: '#E2E8F0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Ionicons name="person-add" size={18} color={COLORS.dark} />
            <Text style={{ color: COLORS.dark, fontWeight: '700', fontSize: 13 }}>Soy técnico</Text>
          </TouchableOpacity>
        </View>

        {/* Cerca de ti banner */}
        {location.distrito ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/buscar', params: { distrito: location.distrito! } })}
            style={{
              marginHorizontal: 20,
              marginTop: 14,
              backgroundColor: '#EFF6FF',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: '#BFDBFE',
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: COLORS.blue + '18',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="navigate" size={18} color={COLORS.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>
                {'\uD83D\uDCCD'} Técnicos cerca de {location.distrito}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 1 }}>
                Toca para ver técnicos en tu zona
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.blue} />
          </TouchableOpacity>
        ) : null}

        {/* Categories */}
        <View style={{ padding: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 14 }}>
            Servicios populares
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                onPress={() => router.push({ pathname: '/buscar', params: { servicio: cat.name } })}
                style={{
                  width: CARD_SIZE,
                  backgroundColor: '#fff',
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  marginBottom: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 14,
                  backgroundColor: cat.color + '12',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                }}>
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: '600', color: COLORS.dark, textAlign: 'center' }} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => router.push('/buscar')}
            style={{ alignItems: 'center', paddingVertical: 8 }}
          >
            <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 12 }}>Ver los 100+ servicios →</Text>
          </TouchableOpacity>
        </View>

        {/* Value props */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
          }}>
            {[
              { icon: 'shield-checkmark' as const, color: COLORS.green, title: 'Verificados con DNI', desc: 'Identidad confirmada de cada técnico' },
              { icon: 'logo-whatsapp' as const, color: '#25D366', title: 'Contacto directo', desc: 'Habla por WhatsApp sin intermediarios' },
              { icon: 'cash' as const, color: COLORS.pri, title: 'Paga como prefieras', desc: 'Yape, Plin, efectivo o transferencia' },
            ].map((item, i) => (
              <View key={i} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 12,
                borderBottomWidth: i < 2 ? 1 : 0,
                borderBottomColor: '#F1F5F9',
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.color + '12', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 1 }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Fidelidad banner */}
        <TouchableOpacity
          onPress={() => router.push('/fidelidad')}
          style={{
            marginHorizontal: 20, marginBottom: 16,
            borderRadius: 14, overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={['#1E3A5F', '#2563EB']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Text style={{ fontSize: 28 }}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Programa de Fidelidad</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Acumula puntos y obtén descuentos exclusivos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Top techs */}
        <View style={{ padding: 20, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>
              Mejor valorados
            </Text>
            <TouchableOpacity onPress={() => router.push('/buscar')}>
              <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 12 }}>Ver todos →</Text>
            </TouchableOpacity>
          </View>
          {topTechs.map((tech) => (
            <TechCard key={tech.id} tech={tech} />
          ))}
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.blue} style={{ marginVertical: 40 }} />
          ) : topTechs.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={40} color={COLORS.gray2} />
              <Text style={{ color: COLORS.gray2, marginTop: 8, fontSize: 13 }}>No hay técnicos disponibles</Text>
            </View>
          ) : null}
        </View>

        {/* CTA Técnico */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{
            backgroundColor: '#FFF7ED', borderRadius: 16, padding: 20, alignItems: 'center',
            borderWidth: 1, borderColor: '#FED7AA',
          }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🔧</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, textAlign: 'center' }}>
              ¿Eres técnico?
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 4, marginBottom: 14, lineHeight: 18 }}>
              Únete a SOLU y recibe clientes todos los días.{'\n'}Prueba gratis por 90 días.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/registro')}
              style={{
                backgroundColor: COLORS.pri,
                borderRadius: 12,
                paddingHorizontal: 28,
                paddingVertical: 12,
                shadowColor: COLORS.pri,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Registrarme gratis →</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <ChatBot />
    </View>
  )
}
