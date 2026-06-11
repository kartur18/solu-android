import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { COLORS } from '../src/lib/constants'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { compressImage } from '../src/lib/imageCompress'
import { useClientProfile } from '../src/lib/useClientProfile'
import { useLocationDetection } from '../src/lib/useLocation'
import { logger } from '../src/lib/logger'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

type Severidad = 'baja' | 'media' | 'alta' | 'emergencia'

type Analisis = {
  categoria: string
  severidad: Severidad
  servicio_recomendado: string
  descripcion: string
}

type Precio = {
  min: number
  max: number
  mediana?: number
  fuente: 'ai_image' | 'historico' | 'historico_ai'
  sample_size?: number
  ai_note?: string
}

type TecnicoSugerido = {
  id: number
  nombre: string
  oficio: string
  distrito: string
  calificacion: number | null
  num_resenas: number | null
  foto_url: string | null
  plan: string | null
  servicios_completados: number | null
  documentos_verificados: boolean | null
}

type QuoteResponse = {
  analisis: Analisis | null
  precio?: Precio
  tecnicos?: TecnicoSugerido[]
  mensaje: string
}

type Estado = 'idle' | 'analyzing' | 'result'

const SEVERIDAD_UI: Record<Severidad, { label: string; color: string; bg: string }> = {
  baja: { label: 'Leve', color: '#059669', bg: '#ECFDF5' },
  media: { label: 'Moderado', color: '#92400E', bg: '#FEF3C7' },
  alta: { label: 'Urgente', color: '#C2410C', bg: '#FFF3EC' },
  emergencia: { label: 'Emergencia', color: '#B91C1C', bg: '#FEE2E2' },
}

function fuenteLabel(p: Precio): string {
  if (p.fuente === 'historico') return p.sample_size ? `Basado en ${p.sample_size} trabajos reales en SOLU` : 'Basado en trabajos reales en SOLU'
  if (p.fuente === 'historico_ai') return 'IA + historial de trabajos similares en SOLU'
  return 'Estimado por IA según tu foto'
}

function TecnicoMiniCard({ tech }: { tech: TecnicoSugerido }) {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => router.push(`/tecnico/${tech.id}`)}
      activeOpacity={0.85}
      style={{
        backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: '#F1F5F9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
      }}
    >
      {tech.foto_url ? (
        <Image source={{ uri: tech.foto_url }} style={{ width: 48, height: 48, borderRadius: 14 }} />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.charAt(0) || 'T'}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }} numberOfLines={1}>{tech.nombre}</Text>
          {tech.documentos_verificados ? (
            <Ionicons name="checkmark-circle" size={14} color={COLORS.acc} />
          ) : null}
        </View>
        <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 1 }} numberOfLines={1}>{tech.oficio} · {tech.distrito}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
          <Text style={{ fontSize: 11, color: COLORS.gray2 }}>({tech.num_resenas || 0} reseñas)</Text>
          {(tech.servicios_completados || 0) > 0 ? (
            <Text style={{ fontSize: 11, color: COLORS.gray2 }}>· {tech.servicios_completados} trabajos</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.gray2} />
    </TouchableOpacity>
  )
}

export default function CotizarFotoScreen() {
  const router = useRouter()
  const { profile, loaded } = useClientProfile()
  const location = useLocationDetection()
  const [estado, setEstado] = useState<Estado>('idle')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [distrito, setDistrito] = useState('')
  const [data, setData] = useState<QuoteResponse | null>(null)

  // Distrito: primero el del perfil guardado, sino GPS
  useEffect(() => {
    if (!loaded) return
    if (profile?.distrito) {
      setDistrito(profile.distrito)
      return
    }
    location.detectLocation().then((d) => {
      if (d) setDistrito((prev) => prev || d)
    })
  }, [loaded])

  async function tomarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para tomarle una foto al problema')
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) await analizarFoto(result.assets[0])
  }

  async function elegirDeGaleria() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para elegir la foto')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) await analizarFoto(result.assets[0])
  }

  async function analizarFoto(asset: ImagePicker.ImagePickerAsset) {
    const base64 = asset.base64
    if (!base64 || base64.length < 100) {
      return Alert.alert('Error', 'No pudimos leer la foto. Intenta de nuevo.')
    }
    // Límite de Claude vision: 8 MB decodificados
    if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return Alert.alert('Foto muy pesada', 'La imagen supera los 8 MB. Toma la foto de nuevo o elige una más liviana.')
    }

    const compressed = await compressImage(asset.uri)
    setPreviewUri(compressed)
    setEstado('analyzing')

    const mimeType = /^image\/(jpeg|png|webp|gif)$/.test(asset.mimeType || '') ? asset.mimeType : 'image/jpeg'

    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/quote-from-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          ...(distrito ? { distrito: distrito.slice(0, 60) } : {}),
          ...(caption.trim() ? { caption: caption.trim().slice(0, 500) } : {}),
        }),
        timeout: 60000,
      })

      if (!res.ok) {
        let msg = 'Ocurrió un error. Intenta de nuevo en unos segundos.'
        if (res.status === 413) msg = 'La foto pesa demasiado (máx 8 MB). Prueba con otra foto.'
        else if (res.status === 429) msg = 'Hiciste varias cotizaciones seguidas. Espera un minuto e intenta de nuevo.'
        else if (res.status === 400) {
          try {
            const err = await res.json()
            if (err?.error) msg = err.error
          } catch {}
        }
        Alert.alert('No pudimos analizar tu foto', msg)
        setEstado('idle')
        return
      }

      const json: QuoteResponse = await res.json()
      setData(json)
      setEstado('result')
    } catch (err) {
      logger.error('Error cotizando por foto:', err)
      Alert.alert('Sin conexión', 'La conexión tardó demasiado o se cortó. Revisa tu internet e intenta de nuevo.')
      setEstado('idle')
    }
  }

  function solicitarServicio() {
    if (!data?.analisis) return
    const a = data.analisis
    const urgencia = a.severidad === 'emergencia' ? 'emergencia' : a.severidad === 'alta' ? 'urgente' : 'normal'
    router.push({
      pathname: '/solicitar',
      params: {
        servicio: a.servicio_recomendado,
        descripcion: caption.trim() ? `${a.descripcion}. ${caption.trim()}` : a.descripcion,
        urgencia,
      },
    })
  }

  function reiniciar() {
    setData(null)
    setPreviewUri(null)
    setEstado('idle')
  }

  // ── Estado: analizando ──
  if (estado === 'analyzing') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.light, padding: 20, justifyContent: 'center' }}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={{ width: '100%', height: 240, borderRadius: 16, marginBottom: 24 }} resizeMode="cover" />
        ) : null}
        <View style={{ alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.pri} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.dark, marginTop: 16 }}>Analizando tu foto… ⏳</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 6, textAlign: 'center' }}>
            La IA está identificando el problema{'\n'}y calculando un precio estimado
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Ionicons name="lock-closed" size={12} color="#059669" />
            <Text style={{ fontSize: 11, color: '#047857', fontWeight: '600' }}>Tu foto se elimina automático, no se guarda</Text>
          </View>
        </View>
      </View>
    )
  }

  // ── Estado: resultado ──
  if (estado === 'result' && data) {
    const analisis = data.analisis
    const sev = analisis ? SEVERIDAD_UI[analisis.severidad] || SEVERIDAD_UI.media : null
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={{ width: '100%', height: 160, borderRadius: 16, marginBottom: 14 }} resizeMode="cover" />
        ) : null}

        {analisis && sev ? (
          <>
            {/* Problema detectado */}
            <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="search" size={17} color={COLORS.pri} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, flex: 1 }}>Problema detectado</Text>
                <View style={{ backgroundColor: sev.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: sev.color }}>{sev.label.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: COLORS.gray2, fontWeight: '600' }}>{analisis.categoria}</Text>
              <Text style={{ fontSize: 17, fontWeight: '900', color: COLORS.dark, marginTop: 2 }}>{analisis.servicio_recomendado}</Text>
              <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 6, lineHeight: 19 }}>{analisis.descripcion}</Text>
            </View>

            {/* Precio estimado */}
            {data.precio ? (
              <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="cash-outline" size={17} color="#059669" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>Precio estimado</Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.pri }}>
                  S/ {data.precio.min} – S/ {data.precio.max}
                </Text>
                {data.precio.mediana ? (
                  <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>Precio típico: S/ {data.precio.mediana}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.gray2} />
                  <Text style={{ fontSize: 11, color: COLORS.gray2, flex: 1 }}>{fuenteLabel(data.precio)}</Text>
                </View>
                {data.precio.ai_note ? (
                  <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 4, fontStyle: 'italic' }}>{data.precio.ai_note}</Text>
                ) : null}
              </View>
            ) : null}

            {/* CTA principal */}
            <TouchableOpacity onPress={solicitarServicio} activeOpacity={0.85} style={{ marginBottom: 12 }}>
              <LinearGradient
                colors={[COLORS.pri, '#E55A10']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="flash" size={18} color={COLORS.white} />
                <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: '800' }}>Solicitar este servicio</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Técnicos sugeridos */}
            {data.tecnicos && data.tecnicos.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>
                  Técnicos disponibles para este trabajo
                </Text>
                {data.tecnicos.slice(0, 3).map((tech) => (
                  <TecnicoMiniCard key={tech.id} tech={tech} />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          // La IA no identificó el problema en la foto
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="help-circle-outline" size={28} color="#92400E" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, textAlign: 'center' }}>No pudimos identificar el problema</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{data.mensaje}</Text>
            <TouchableOpacity
              onPress={() => router.push('/solicitar')}
              activeOpacity={0.85}
              style={{ marginTop: 14, backgroundColor: COLORS.pri, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 13 }}>Describir mi problema en palabras</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tomar otra foto */}
        <TouchableOpacity
          onPress={reiniciar}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white }}
        >
          <Ionicons name="camera-outline" size={16} color={COLORS.dark} />
          <Text style={{ color: COLORS.dark, fontWeight: '700', fontSize: 13 }}>Tomar otra foto</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // ── Estado: inicial ──
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Ionicons name="camera" size={34} color={COLORS.pri} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark, textAlign: 'center' }}>Cotiza con una foto 📸</Text>
        <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
          Tómale una foto al problema y la IA te dice{'\n'}qué servicio necesitas y cuánto cuesta
        </Text>
      </View>

      {/* Pasos */}
      <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
        {[
          { icon: 'camera-outline' as const, text: 'Toma una foto del problema' },
          { icon: 'sparkles-outline' as const, text: 'La IA lo analiza en segundos' },
          { icon: 'cash-outline' as const, text: 'Recibes precio estimado y técnicos cerca' },
        ].map((paso, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={paso.icon} size={15} color={COLORS.pri} />
            </View>
            <Text style={{ fontSize: 13, color: COLORS.dark, fontWeight: '600', flex: 1 }}>{paso.text}</Text>
            <Text style={{ fontSize: 12, fontWeight: '900', color: COLORS.gray2 }}>{i + 1}</Text>
          </View>
        ))}
      </View>

      {/* Caption opcional */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>¿Algo más que debamos saber? (opcional)</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Ej: el caño gotea desde ayer"
        placeholderTextColor={COLORS.gray2}
        maxLength={500}
        style={{
          backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
          paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.dark, marginBottom: 12,
        }}
      />

      {/* Distrito detectado */}
      {distrito ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <Ionicons name="location" size={13} color={COLORS.pri} />
          <Text style={{ fontSize: 12, color: COLORS.gray, fontWeight: '600' }}>
            Cotizando para <Text style={{ color: COLORS.dark, fontWeight: '800' }}>{distrito}</Text>
          </Text>
        </View>
      ) : null}

      {/* Botón cámara */}
      <TouchableOpacity onPress={tomarFoto} activeOpacity={0.85} style={{ marginBottom: 10 }}>
        <LinearGradient
          colors={[COLORS.pri, '#E55A10']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="camera" size={20} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontSize: 15, fontWeight: '800' }}>Tomar foto</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Botón galería */}
      <TouchableOpacity
        onPress={elegirDeGaleria}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white }}
      >
        <Ionicons name="images-outline" size={18} color={COLORS.dark} />
        <Text style={{ color: COLORS.dark, fontWeight: '700', fontSize: 14 }}>Elegir de galería</Text>
      </TouchableOpacity>

      {/* Nota de privacidad */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
        <Ionicons name="lock-closed" size={12} color={COLORS.gray2} />
        <Text style={{ fontSize: 11, color: COLORS.gray2 }}>Tu foto se analiza al instante y se elimina automático</Text>
      </View>
    </ScrollView>
  )
}
