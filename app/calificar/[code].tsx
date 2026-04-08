import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import type { Cliente } from '../../src/lib/types'

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
    if (fotos.length >= 2) return Alert.alert('Límite', 'Máximo 2 fotos por reseña')
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
      console.error('Error uploading foto:', err)
      return null
    }
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('clientes').select('*').eq('codigo', code).single()
      setService(data)
      if (data?.estado === 'Calificado') setDone(true)
      setLoading(false)
    }
    load()
  }, [code])

  async function submit() {
    if (rating === 0) return Alert.alert('Error', 'Selecciona una calificación')
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

      setDone(true)
      Alert.alert('¡Gracias!', 'Tu calificación fue enviada exitosamente')
    } else {
      Alert.alert('Error', 'No se pudo enviar la calificación')
    }
    setSubmitting(false)
  }

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={COLORS.pri} /></View>
  if (!service) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.gray }}>Servicio no encontrado</Text></View>

  if (done) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="checkmark-circle" size={64} color={COLORS.acc} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, marginTop: 16 }}>¡Gracias!</Text>
        <Text style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', marginTop: 8 }}>Tu calificación ayuda a mejorar la comunidad SOLU</Text>
        <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 24, backgroundColor: COLORS.pri, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: COLORS.white, fontWeight: '700' }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      <View style={{ padding: 20 }}>
        <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: COLORS.gray }}>Servicio: {service.servicio}</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray }}>Código: {service.codigo}</Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark, textAlign: 'center', marginBottom: 16 }}>
          ¿Cómo fue tu experiencia?
        </Text>

        {/* Stars */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => setRating(s)}>
              <Ionicons name="star" size={44} color={s <= rating ? COLORS.yellow : COLORS.border} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Comentario (opcional)</Text>
        <TextInput
          placeholder="Cuéntanos cómo fue el servicio..."
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: COLORS.white,
            borderRadius: 12,
            padding: 14,
            fontSize: 14,
            height: 100,
            textAlignVertical: 'top',
            borderWidth: 1,
            borderColor: COLORS.border,
            marginBottom: 20,
          }}
          placeholderTextColor={COLORS.gray2}
        />

        {/* Photo section */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Fotos (opcional)</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {fotos.map((uri, idx) => (
            <View key={idx} style={{ position: 'relative' }}>
              <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
              <TouchableOpacity
                onPress={() => setFotos(prev => prev.filter((_, i) => i !== idx))}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  backgroundColor: '#EF4444',
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={12} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ))}
          {fotos.length < 2 && (
            <TouchableOpacity
              onPress={pickFoto}
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                borderWidth: 1.5,
                borderColor: COLORS.border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera-outline" size={24} color={COLORS.gray2} />
              <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 4 }}>Agregar foto</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting}
          style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center' }}
        >
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>
            {submitting ? 'Enviando...' : 'Enviar calificación'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
