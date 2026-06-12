import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer, haptics } from '../../src/components/ui/Motion'
import { supabase } from '../../src/lib/supabase'
import { fetchServicioByCodigo } from '../../src/lib/servicios'
import type { Cliente } from '../../src/lib/types'

const RATING_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', '¡Excelente!']

export default function CalificarScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const router = useRouter()
  const [service, setService] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])

  async function pickFoto() {
    if (fotos.length >= 2) return Alert.alert('Máximo 2 fotos', 'Ya agregaste 2 fotos. Elimina una si quieres cambiarla.')
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      setFotos(prev => [...prev, result.assets[0].uri])
    }
  }

  async function uploadFoto(uri: string): Promise<string | null> {
    try {
      const ext = uri.split('.').pop() || 'jpg'
      const fileName = `resenas/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('fotos').upload(fileName, blob, {
        contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from('fotos').getPublicUrl(fileName)
      return data.publicUrl
    } catch (err) {
      if (__DEV__) console.error('Error uploading foto:', err)
      return null
    }
  }

  useEffect(() => {
    async function load() {
      // Lectura de `clientes` migrada a endpoint server-side (anon cerrado por PII).
      const data = await fetchServicioByCodigo(code)
      setService(data)
      if (data?.estado === 'Calificado') setDone(true)
      setLoading(false)
    }
    load()
  }, [code])

  async function submit() {
    if (rating === 0) return Alert.alert('Falta tu calificación', 'Toca las estrellas para contarnos cómo fue el servicio.')
    if (submitting || !service) return
    setSubmitting(true)

    // Upload photos first
    const uploadedUrls: string[] = []
    for (const uri of fotos) {
      const url = await uploadFoto(uri)
      if (url) uploadedUrls.push(url)
    }

    const { error } = await supabase.from('resenas').insert({
      tecnico_id: service.tecnico_asignado,
      nombre_cliente: service.nombre,
      whatsapp_cliente: service.whatsapp,
      calificacion: rating,
      comentario: comment,
      servicio: service.servicio,
      codigo_servicio: service.codigo,
      fotos_url: uploadedUrls.length > 0 ? uploadedUrls : undefined,
    })

    if (!error) {
      await supabase.from('clientes').update({ estado: 'Calificado' }).eq('id', service.id)

      // Update tech rating
      if (service.tecnico_asignado) {
        const { data: allReviews } = await supabase.from('resenas').select('calificacion').eq('tecnico_id', service.tecnico_asignado)
        if (allReviews) {
          const avg = allReviews.reduce((s: number, r: { calificacion: number }) => s + r.calificacion, 0) / allReviews.length
          await supabase.from('tecnicos').update({ calificacion: Math.round(avg * 10) / 10, num_resenas: allReviews.length }).eq('id', service.tecnico_asignado)
        }
      }

      haptics.success()
      setDone(true)
    } else {
      Alert.alert('No se pudo enviar', 'Revisa tu conexión e intenta de nuevo. Tu calificación no se perdió.')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      <View style={{ padding: THEME.space.xl, gap: THEME.space.lg }}>
        <Shimmer style={{ height: 64, borderRadius: THEME.radius.lg }} />
        <Shimmer style={{ height: 24, width: '70%', borderRadius: THEME.radius.sm, alignSelf: 'center' }} />
        <Shimmer style={{ height: 52, width: '80%', borderRadius: THEME.radius.lg, alignSelf: 'center' }} />
        <Shimmer style={{ height: 100, borderRadius: THEME.radius.lg, marginTop: THEME.space.lg }} />
        <Shimmer style={{ height: 52, borderRadius: THEME.radius.lg }} />
      </View>
    </View>
  )
  if (!service) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxl, backgroundColor: THEME.color.surfaceAlt }}>
      <FadeInUp style={{ alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
          <Ionicons name="search-outline" size={40} color={THEME.color.inkMuted} />
        </View>
        <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>No encontramos ese servicio</Text>
        <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center' }}>Verifica que el código sea correcto e intenta de nuevo.</Text>
        <PressableScale
          onPress={() => router.replace('/')}
          accessibilityLabel="Volver al inicio"
          style={{ marginTop: THEME.space.xl, height: 52, paddingHorizontal: THEME.space.xxxl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Volver al inicio</Text>
        </PressableScale>
      </FadeInUp>
    </View>
  )

  if (done) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: THEME.space.xxl, backgroundColor: THEME.color.surfaceAlt }}>
        <FadeInUp style={{ alignItems: 'center' }}>
          <View style={{ width: 96, height: 96, borderRadius: THEME.radius.full, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
            <Ionicons name="checkmark-circle" size={64} color={THEME.color.success} />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center' }}>¡Gracias por calificar!</Text>
          <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.sm }}>Tu calificación ayuda a otros vecinos a elegir mejor</Text>
          <PressableScale
            onPress={() => router.replace('/')}
            accessibilityLabel="Volver al inicio"
            style={{ marginTop: THEME.space.xxl, height: 52, paddingHorizontal: THEME.space.xxxl, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
          >
            <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Volver al inicio</Text>
          </PressableScale>
        </FadeInUp>
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      <View style={{ padding: THEME.space.xl }}>
        <FadeInUp>
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.xl, ...THEME.shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
              <Ionicons name="construct-outline" size={16} color={THEME.color.brand} />
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>Servicio: <Text style={{ fontWeight: '700', color: THEME.color.ink }}>{service.servicio}</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.sm }}>
              <Ionicons name="pricetag-outline" size={16} color={THEME.color.brand} />
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>Código: <Text style={{ fontWeight: '700', color: THEME.color.ink }}>{service.codigo}</Text></Text>
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={60}>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center', marginBottom: THEME.space.lg }}>
            ¿Cómo fue tu experiencia?
          </Text>

          {/* Stars */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <PressableScale
                key={s}
                onPress={() => { haptics.light(); setRating(s) }}
                haptic={false}
                scaleTo={0.85}
                accessibilityLabel={`Calificar con ${s} ${s === 1 ? 'estrella' : 'estrellas'}`}
                style={{ padding: 4 }}
              >
                <Ionicons name={s <= rating ? 'star' : 'star-outline'} size={46} color={s <= rating ? THEME.color.warning : THEME.color.line} />
              </PressableScale>
            ))}
          </View>
          <Text style={{ ...THEME.font.h3, color: rating > 0 ? THEME.color.warning : THEME.color.inkMuted, textAlign: 'center', marginBottom: THEME.space.xxl, minHeight: 22 }}>
            {rating > 0 ? RATING_LABELS[rating] : 'Toca una estrella para calificar'}
          </Text>
        </FadeInUp>

        <FadeInUp delay={120}>
          <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft, marginBottom: THEME.space.sm }}>Comentario (opcional)</Text>
          <TextInput
            placeholder="Cuéntanos cómo fue el servicio..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: THEME.color.surface,
              borderRadius: THEME.radius.lg,
              padding: THEME.space.lg,
              ...THEME.font.body,
              color: THEME.color.ink,
              height: 110,
              textAlignVertical: 'top',
              marginBottom: THEME.space.xl,
              ...THEME.shadow.sm,
            }}
            placeholderTextColor={THEME.color.inkMuted}
          />
        </FadeInUp>

        {/* Photo section */}
        <FadeInUp delay={180}>
          <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft, marginBottom: THEME.space.sm }}>Fotos (opcional)</Text>
          <View style={{ flexDirection: 'row', gap: THEME.space.md, marginBottom: THEME.space.xl, flexWrap: 'wrap' }}>
            {fotos.map((uri, idx) => (
              <View key={idx} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: THEME.radius.md }} />
                <TouchableOpacity
                  onPress={() => setFotos(prev => prev.filter((_, i) => i !== idx))}
                  accessibilityLabel={`Eliminar foto ${idx + 1}`}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: THEME.color.danger,
                    borderRadius: THEME.radius.full,
                    width: 22,
                    height: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: THEME.color.surface,
                  }}
                >
                  <Ionicons name="close" size={12} color={THEME.color.white} />
                </TouchableOpacity>
              </View>
            ))}
            {fotos.length < 2 && (
              <TouchableOpacity
                onPress={pickFoto}
                accessibilityLabel="Agregar foto"
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: THEME.radius.md,
                  borderWidth: 1.5,
                  borderColor: THEME.color.line,
                  borderStyle: 'dashed',
                  backgroundColor: THEME.color.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera-outline" size={26} color={THEME.color.inkMuted} />
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 4 }}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeInUp>

        <FadeInUp delay={240}>
          <PressableScale
            onPress={submit}
            disabled={submitting}
            haptic={false}
            accessibilityLabel="Enviar calificación"
            style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, height: 52, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                <ActivityIndicator color={THEME.color.white} />
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Enviando...</Text>
              </View>
            ) : (
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Enviar calificación</Text>
            )}
          </PressableScale>
        </FadeInUp>
      </View>
    </ScrollView>
  )
}
