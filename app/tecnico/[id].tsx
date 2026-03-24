import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import type { Tecnico, Resena } from '../../src/lib/types'

export default function TecnicoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [reviews, setReviews] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [techRes, revRes] = await Promise.all([
        supabase.from('tecnicos').select('*').eq('id', id).single(),
        supabase.from('resenas').select('*').eq('tecnico_id', id).order('created_at', { ascending: false }).limit(20),
      ])
      setTech(techRes.data)
      setReviews(revRes.data || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.pri} /></View>
  if (!tech) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Técnico no encontrado</Text></View>

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.white, padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.[0]}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark }}>{tech.nombre}</Text>
          {tech.verificado && <Ionicons name="checkmark-circle" size={20} color={COLORS.acc} />}
        </View>
        <Text style={{ fontSize: 14, color: COLORS.gray, marginTop: 2 }}>{tech.oficio}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <Ionicons name="location-outline" size={14} color={COLORS.gray2} />
          <Text style={{ fontSize: 13, color: COLORS.gray2 }}>{tech.distrito}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 24, marginTop: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={18} color={COLORS.yellow} />
              <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
            </View>
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>{tech.num_resenas || 0} reseñas</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark }}>{tech.servicios_completados || 0}</Text>
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>servicios</Text>
          </View>
          {tech.precio_desde && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.pri }}>S/{tech.precio_desde}</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray2 }}>desde</Text>
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      {tech.descripcion && (
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Descripción</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, lineHeight: 20 }}>{tech.descripcion}</Text>
        </View>
      )}

      {/* Contact */}
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <TouchableOpacity
          onPress={() => Linking.openURL(waLink(tech.whatsapp, `Hola ${tech.nombre}, te encontré en SOLU y necesito un servicio de ${tech.oficio}.`))}
          style={{ backgroundColor: '#25D366', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="logo-whatsapp" size={22} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>Contactar por WhatsApp</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:${tech.whatsapp}`)}
            style={{ flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border }}
          >
            <Ionicons name="call" size={18} color={COLORS.pri} />
            <Text style={{ color: COLORS.pri, fontWeight: '700', fontSize: 13 }}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/agendar/${tech.id}`)}
            style={{ flex: 1, backgroundColor: COLORS.acc, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="calendar" size={18} color={COLORS.white} />
            <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>Agendar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reviews */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>Reseñas ({reviews.length})</Text>
        {reviews.map((r) => (
          <View key={r.id} style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
            <View style={{ flexDirection: 'row', gap: 3, marginBottom: 6 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons key={s} name="star" size={14} color={s <= r.calificacion ? COLORS.yellow : COLORS.border} />
              ))}
            </View>
            <Text style={{ fontSize: 13, color: COLORS.dark, lineHeight: 18 }}>{r.comentario}</Text>
            <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 6 }}>— {r.nombre_cliente} · {r.servicio}</Text>
          </View>
        ))}
        {reviews.length === 0 && (
          <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20, fontSize: 13 }}>Sin reseñas aún</Text>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}
