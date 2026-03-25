import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Dimensions, Animated, TextInput } from 'react-native'
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
  { name: 'Gasfitería', icon: 'water' as const, color: '#3B82F6', gradientEnd: '#60A5FA' },
  { name: 'Electricidad', icon: 'flash' as const, color: '#F59E0B', gradientEnd: '#FBBF24' },
  { name: 'Pintura', icon: 'color-palette' as const, color: '#8B5CF6', gradientEnd: '#A78BFA' },
  { name: 'Cerrajería', icon: 'key' as const, color: '#EF4444', gradientEnd: '#F87171' },
  { name: 'Limpieza', icon: 'sparkles' as const, color: '#10B981', gradientEnd: '#34D399' },
  { name: 'Carpintería', icon: 'hammer' as const, color: '#F97316', gradientEnd: '#FB923C' },
  { name: 'Refrigeración', icon: 'snow' as const, color: '#06B6D4', gradientEnd: '#22D3EE' },
  { name: 'Albañilería', icon: 'construct' as const, color: '#78716C', gradientEnd: '#A8A29E' },
]

const TRUST_STATS = [
  { label: 'Técnicos', value: '50+', icon: 'people' as const },
  { label: 'Servicios', value: '100+', icon: 'construct' as const },
  { label: 'Distritos', value: '95+', icon: 'location' as const },
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
  const [heroSearch, setHeroSearch] = useState('')
  const location = useLocationDetection()
  const fadeAnim = useRef(new Animated.Value(0)).current

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
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.blue} />}
      >
        {/* Hero */}
        <LinearGradient
          colors={['#1E3A5F', '#162D4A', '#0F2035']}
          style={{ padding: 20, paddingTop: 16, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.pri, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>S</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>SOLU</Text>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.green }} />
              <Text style={{ color: COLORS.green, fontSize: 9, fontWeight: '600' }}>En todo el Perú</Text>
            </View>
          </View>

          <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4, lineHeight: 28 }}>
            ¿Qué necesitas{'\n'}reparar hoy?
          </Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            Técnicos verificados con DNI · Contacto directo
          </Text>

          <View style={{
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: 4,
            paddingLeft: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
            <TextInput
              placeholder="Buscar servicio o técnico..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={heroSearch}
              onChangeText={setHeroSearch}
              onSubmitEditing={() => {
                if (heroSearch.trim()) {
                  router.push({ pathname: '/buscar', params: { servicio: heroSearch.trim() } })
                  setHeroSearch('')
                } else {
                  router.push('/buscar')
                }
              }}
              returnKeyType="search"
              style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 10 }}
            />
            {heroSearch.trim() ? (
              <TouchableOpacity
                onPress={() => {
                  router.push({ pathname: '/buscar', params: { servicio: heroSearch.trim() } })
                  setHeroSearch('')
                }}
                style={{ backgroundColor: '#F26B21', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginRight: 2 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Buscar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Trust stats */}
          <View style={{ flexDirection: 'row', marginTop: 14, gap: 6 }}>
            {TRUST_STATS.map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{stat.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '600', marginTop: 1 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: -12 }}>
          <PressableCard
            onPress={() => router.push('/solicitar')}
            style={{
              flex: 1, backgroundColor: COLORS.pri, borderRadius: 14, padding: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              shadowColor: COLORS.pri,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Ionicons name="build" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Solicitar técnico</Text>
          </PressableCard>
          <PressableCard
            onPress={() => router.push('/registro')}
            style={{
              flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              borderWidth: 1.5, borderColor: '#E2E8F0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Ionicons name="person-add" size={16} color={COLORS.dark} />
            <Text style={{ color: COLORS.dark, fontWeight: '700', fontSize: 12 }}>Soy técnico</Text>
          </PressableCard>
        </View>

        {/* Cerca de ti banner */}
        {location.distrito ? (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/buscar', params: { distrito: location.distrito! } })}
            activeOpacity={0.8}
            style={{
              marginHorizontal: 16, marginTop: 12,
              backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderWidth: 1, borderColor: '#BFDBFE',
            }}
          >
            <Ionicons name="navigate" size={18} color={COLORS.blue} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark }}>
                Técnicos cerca de {location.distrito}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.gray }}>Toca para ver técnicos en tu zona</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={COLORS.blue} />
          </TouchableOpacity>
        ) : null}

        {/* Categories */}
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>
            Servicios populares
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {CATEGORIES.map((cat) => (
              <PressableCard
                key={cat.name}
                onPress={() => router.push({ pathname: '/buscar', params: { servicio: cat.name } })}
                style={{
                  width: CARD_SIZE,
                  backgroundColor: '#fff', borderRadius: 14,
                  paddingVertical: 14, paddingHorizontal: 4,
                  alignItems: 'center', marginBottom: 10,
                  shadowColor: cat.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <LinearGradient
                  colors={[cat.color + '18', cat.gradientEnd + '10']}
                  style={{
                    width: 44, height: 44, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                  }}
                >
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </LinearGradient>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, textAlign: 'center' }} numberOfLines={1}>
                  {cat.name}
                </Text>
              </PressableCard>
            ))}
          </View>
          <TouchableOpacity onPress={() => router.push('/buscar')} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 11 }}>Ver los 100+ servicios →</Text>
          </TouchableOpacity>
        </View>

        {/* Value props */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
          }}>
            {[
              { icon: 'shield-checkmark' as const, color: COLORS.green, title: 'Verificados con DNI', desc: 'Identidad confirmada de cada técnico' },
              { icon: 'logo-whatsapp' as const, color: '#25D366', title: 'Contacto directo', desc: 'Habla por WhatsApp sin intermediarios' },
              { icon: 'cash' as const, color: COLORS.pri, title: 'Paga como prefieras', desc: 'Yape, Plin, efectivo o transferencia' },
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

        {/* Urgencias 24/7 banner */}
        <PressableCard
          onPress={() => router.push('/urgencias')}
          style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 14, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={['#DC2626', '#991B1B']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>Urgencias 24/7</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Técnico de emergencia en tu zona ahora</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </PressableCard>

        {/* Top techs */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>Mejor valorados</Text>
            <TouchableOpacity onPress={() => router.push('/buscar')} activeOpacity={0.7}>
              <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 11 }}>Ver todos →</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.blue} style={{ marginVertical: 30 }} />
          ) : topTechs.length > 0 ? (
            <Animated.View style={{ opacity: fadeAnim }}>
              {topTechs.map((tech) => <TechCard key={tech.id} tech={tech} />)}
            </Animated.View>
          ) : (
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 30, alignItems: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
            }}>
              <Ionicons name="search" size={36} color={COLORS.gray2} />
              <Text style={{ color: COLORS.dark, marginTop: 8, fontSize: 13, fontWeight: '600' }}>Registra técnicos para verlos aquí</Text>
              <Text style={{ color: COLORS.gray2, marginTop: 4, fontSize: 11, textAlign: 'center' }}>Los técnicos con mejor calificación aparecerán en esta sección</Text>
              <TouchableOpacity
                onPress={() => router.push('/buscar')}
                activeOpacity={0.8}
                style={{ marginTop: 12, backgroundColor: COLORS.blue, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Buscar técnicos →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CTA Técnico */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <View style={{
            backgroundColor: '#FFF7ED', borderRadius: 16, padding: 24, alignItems: 'center',
            borderWidth: 1, borderColor: '#FED7AA',
          }}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>🔧</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, textAlign: 'center' }}>¿Eres técnico?</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 6, marginBottom: 14, lineHeight: 18 }}>
              Únete a SOLU y recibe clientes todos los días.{'\n'}Prueba gratis por 90 días.
            </Text>
            <PressableCard
              onPress={() => router.push('/registro')}
              style={{
                backgroundColor: COLORS.pri, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12,
                shadowColor: COLORS.pri, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Registrarme gratis →</Text>
            </PressableCard>
          </View>
        </View>
      </ScrollView>
      <ChatBot />
    </View>
  )
}
