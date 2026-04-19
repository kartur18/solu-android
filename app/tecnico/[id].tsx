import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Image, Modal, FlatList, Dimensions, Share } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import type { Tecnico, Resena } from '../../src/lib/types'
import { ProfileSkeleton } from '../../src/components/SkeletonLoader'
import { RatingBreakdown } from '../../src/components/RatingBreakdown'
import { optimizeUrl } from '../../src/lib/cloudinary'

export default function TecnicoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [reviews, setReviews] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

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

  if (loading) return <ProfileSkeleton />
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
          <TouchableOpacity
            onPress={() => Share.share({
              message: `Mira a ${tech.nombre}, ${tech.oficio} verificado en SOLU. https://solu.pe/tecnico/${tech.id}`,
              title: `${tech.nombre} - SOLU`,
            })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-social" size={16} color={COLORS.pri} />
          </TouchableOpacity>
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
        </View>
      </View>

      {/* Description */}
      {tech.descripcion && (
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Descripción</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, lineHeight: 20 }}>{tech.descripcion}</Text>
        </View>
      )}

      {/* Galería de trabajos */}
      {tech.galeria && tech.galeria.length > 0 && (
        <View style={{ paddingVertical: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 12 }}>
            <Ionicons name="camera-outline" size={18} color={COLORS.dark} />
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>Galería de trabajos</Text>
          </View>
          <FlatList
            data={tech.galeria}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            keyExtractor={(item, index) => `gallery-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.85} onPress={() => setSelectedPhoto(item)}>
                <Image
                  source={{ uri: optimizeUrl(item, { width: 320, height: 240 }) }}
                  style={{ width: 160, height: 120, borderRadius: 12, backgroundColor: COLORS.border }}
                />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Contact */}
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/solicitar', params: { tecnicoId: String(tech.id), tecnicoNombre: tech.nombre, tecnicoOficio: tech.oficio } })}
          style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: COLORS.pri, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        >
          <Ionicons name="construct" size={22} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>Solicitar servicio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL(waLink(tech.whatsapp, `Hola ${tech.nombre}, te encontré en SOLU y necesito un servicio de ${tech.oficio}.`))}
          style={{ backgroundColor: '#25D366', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="logo-whatsapp" size={20} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>Contactar por WhatsApp</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => { const phone = tech.whatsapp?.length === 9 ? '+51' + tech.whatsapp : (tech.whatsapp || ''); Linking.openURL(`tel:${phone}`) }}
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
        <RatingBreakdown reviews={reviews} averageRating={tech.calificacion || 0} totalReviews={tech.num_resenas || 0} />
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

      {/* Full-screen photo modal */}
      <Modal visible={!!selectedPhoto} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setSelectedPhoto(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: optimizeUrl(selectedPhoto, { width: Dimensions.get('window').width * 2 }) }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.7 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  )
}
