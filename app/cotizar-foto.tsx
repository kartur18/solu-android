import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, Image, Alert, Linking, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer, haptics } from '../src/components/ui/Motion'
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
  baja: { label: 'Leve', color: THEME.color.success, bg: THEME.color.successBg },
  media: { label: 'Moderado', color: THEME.color.warning, bg: THEME.color.warningBg },
  alta: { label: 'Urgente', color: THEME.color.brandDark, bg: THEME.color.brandLight },
  emergencia: { label: 'Emergencia', color: THEME.color.danger, bg: THEME.color.dangerBg },
}

function fuenteLabel(p: Precio): string {
  if (p.fuente === 'historico') return p.sample_size ? `Basado en ${p.sample_size} trabajos reales en SOLU` : 'Basado en trabajos reales en SOLU'
  if (p.fuente === 'historico_ai') return 'IA + historial de trabajos similares en SOLU'
  return 'Estimado por IA según tu foto'
}

function TecnicoMiniCard({ tech }: { tech: TecnicoSugerido }) {
  const router = useRouter()
  return (
    <PressableScale
      onPress={() => router.push(`/tecnico/${tech.id}`)}
      style={{
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.lg,
        padding: THEME.space.md,
        marginBottom: THEME.space.sm + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: THEME.space.md,
        ...THEME.shadow.sm,
      }}
    >
      {tech.foto_url ? (
        <Image source={{ uri: tech.foto_url }} style={{ width: 52, height: 52, borderRadius: THEME.radius.md }} />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: THEME.color.brand }}>{tech.nombre?.charAt(0) || 'T'}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Text style={{ ...THEME.font.h3, color: THEME.color.ink }} numberOfLines={1}>{tech.nombre}</Text>
          {tech.documentos_verificados ? (
            <Ionicons name="checkmark-circle" size={14} color={THEME.color.info} />
          ) : null}
        </View>
        <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 1 }} numberOfLines={1}>{tech.oficio} · {tech.distrito}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs, marginTop: THEME.space.xs }}>
          <Ionicons name="star" size={12} color={THEME.color.oro} />
          <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>({tech.num_resenas || 0} reseñas)</Text>
          {(tech.servicios_completados || 0) > 0 ? (
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>· {tech.servicios_completados} trabajos</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={THEME.color.inkMuted} />
    </PressableScale>
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

  // Permiso denegado: ofrecer ir a Configuración (el sistema ya no vuelve a preguntar)
  function alertaPermiso(recurso: 'cámara' | 'galería') {
    Alert.alert(
      `Activa tu ${recurso}`,
      `Para cotizar con una foto necesitamos acceso a tu ${recurso}. Actívalo en la configuración de tu teléfono y vuelve a intentar.`,
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
      ],
    )
  }

  async function tomarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      return alertaPermiso('cámara')
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
      return alertaPermiso('galería')
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
      haptics.success()
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

  // ── Estado: analizando ── skeleton con forma del resultado real (no spinner pelado)
  if (estado === 'analyzing') {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={{ padding: THEME.space.lg, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.xl }}>
          {previewUri ? (
            <View style={{ marginBottom: THEME.space.lg }}>
              <Image source={{ uri: previewUri }} style={{ width: '100%', height: 200, borderRadius: THEME.radius.xl }} resizeMode="cover" />
              <View style={{ position: 'absolute', bottom: THEME.space.md, left: THEME.space.md, flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, backgroundColor: 'rgba(15,27,45,0.78)', borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm }}>
                <Ionicons name="sparkles" size={14} color={THEME.color.brand} />
                <Text style={{ ...THEME.font.label, color: THEME.color.white }}>Analizando con IA…</Text>
              </View>
            </View>
          ) : (
            <Shimmer style={{ width: '100%', height: 200, borderRadius: THEME.radius.xl, marginBottom: THEME.space.lg }} />
          )}

          {/* Skeleton: tarjeta problema */}
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.md }}>
              <Shimmer style={{ width: 36, height: 36, borderRadius: THEME.radius.md }} />
              <Shimmer style={{ width: 150, height: 16, borderRadius: THEME.radius.sm }} />
            </View>
            <Shimmer style={{ width: '60%', height: 12, borderRadius: THEME.radius.sm, marginBottom: THEME.space.sm }} />
            <Shimmer style={{ width: '90%', height: 12, borderRadius: THEME.radius.sm, marginBottom: THEME.space.xs }} />
            <Shimmer style={{ width: '80%', height: 12, borderRadius: THEME.radius.sm }} />
          </View>

          {/* Skeleton: tarjeta precio */}
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.md }}>
              <Shimmer style={{ width: 36, height: 36, borderRadius: THEME.radius.md }} />
              <Shimmer style={{ width: 120, height: 16, borderRadius: THEME.radius.sm }} />
            </View>
            <Shimmer style={{ width: '70%', height: 28, borderRadius: THEME.radius.sm }} />
          </View>

          <View style={{ alignItems: 'center', marginTop: THEME.space.sm }}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Analizando tu foto…</Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs, textAlign: 'center', lineHeight: 19 }}>
              La IA está identificando el problema{'\n'}y calculando un precio estimado
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.lg, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.sm }}>
              <Ionicons name="lock-closed" size={12} color={THEME.color.success} />
              <Text style={{ ...THEME.font.caption, color: THEME.color.success }}>Tu foto se elimina automático, no se guarda</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  // ── Estado: resultado ──
  if (estado === 'result' && data) {
    const analisis = data.analisis
    const sev = analisis ? SEVERIDAD_UI[analisis.severidad] || SEVERIDAD_UI.media : null
    return (
      <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ padding: THEME.space.lg, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.md, paddingBottom: THEME.space.xxxl + THEME.space.md }}>
        <StatusBar barStyle="dark-content" />
        {previewUri ? (
          <FadeInUp delay={0}>
            <Image source={{ uri: previewUri }} style={{ width: '100%', height: 170, borderRadius: THEME.radius.xl, marginBottom: THEME.space.lg }} resizeMode="cover" />
          </FadeInUp>
        ) : null}

        {analisis && sev ? (
          <>
            {/* Problema detectado */}
            <FadeInUp delay={60}>
              <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.md }}>
                  <View style={{ width: 38, height: 38, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="search" size={18} color={THEME.color.brand} />
                  </View>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink, flex: 1 }}>Problema detectado</Text>
                  <View style={{ backgroundColor: sev.bg, borderRadius: THEME.radius.full, paddingHorizontal: THEME.space.md, paddingVertical: THEME.space.xs + 1 }}>
                    <Text style={{ ...THEME.font.caption, fontWeight: '800', color: sev.color }}>{sev.label.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={{ ...THEME.font.label, color: THEME.color.inkMuted }}>{analisis.categoria}</Text>
                <Text style={{ ...THEME.font.h2, color: THEME.color.ink, marginTop: THEME.space.xs }}>{analisis.servicio_recomendado}</Text>
                <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, lineHeight: 21 }}>{analisis.descripcion}</Text>
              </View>
            </FadeInUp>

            {/* Precio estimado */}
            {data.precio ? (
              <FadeInUp delay={120}>
                <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.sm }}>
                    <View style={{ width: 38, height: 38, borderRadius: THEME.radius.md, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="cash-outline" size={18} color={THEME.color.success} />
                    </View>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Precio estimado</Text>
                  </View>
                  <Text style={{ ...THEME.font.display, color: THEME.color.brand }}>
                    S/ {data.precio.min} – {data.precio.max}
                  </Text>
                  {data.precio.mediana ? (
                    <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs }}>Precio típico: S/ {data.precio.mediana}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs + 1, marginTop: THEME.space.sm }}>
                    <Ionicons name="information-circle-outline" size={14} color={THEME.color.inkMuted} />
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, flex: 1 }}>{fuenteLabel(data.precio)}</Text>
                  </View>
                  {data.precio.ai_note ? (
                    <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.xs, fontStyle: 'italic' }}>{data.precio.ai_note}</Text>
                  ) : null}
                </View>
              </FadeInUp>
            ) : null}

            {/* CTA principal */}
            <FadeInUp delay={180}>
              <PressableScale
                onPress={solicitarServicio}
                accessibilityLabel="Solicitar este servicio"
                style={{
                  height: 54,
                  borderRadius: THEME.radius.lg,
                  backgroundColor: THEME.color.brand,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: THEME.space.sm,
                  marginBottom: THEME.space.md,
                  ...THEME.shadow.brand,
                }}
              >
                <Ionicons name="flash" size={19} color={THEME.color.white} />
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Solicitar este servicio</Text>
              </PressableScale>
            </FadeInUp>

            {/* Técnicos sugeridos */}
            {data.tecnicos && data.tecnicos.length > 0 ? (
              <FadeInUp delay={240}>
                <View style={{ marginBottom: THEME.space.sm }}>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.md }}>
                    Técnicos disponibles para este trabajo
                  </Text>
                  {data.tecnicos.slice(0, 3).map((tech) => (
                    <TecnicoMiniCard key={tech.id} tech={tech} />
                  ))}
                </View>
              </FadeInUp>
            ) : null}
          </>
        ) : (
          // La IA no identificó el problema en la foto
          <FadeInUp delay={60}>
            <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xl, marginBottom: THEME.space.md, alignItems: 'center', ...THEME.shadow.sm }}>
              <View style={{ width: 60, height: 60, borderRadius: THEME.radius.xl, backgroundColor: THEME.color.warningBg, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.md }}>
                <Ionicons name="help-circle-outline" size={30} color={THEME.color.warning} />
              </View>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink, textAlign: 'center' }}>No pudimos identificar el problema</Text>
              <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center', lineHeight: 21 }}>{data.mensaje}</Text>
              <PressableScale
                onPress={() => router.push('/solicitar')}
                style={{ marginTop: THEME.space.lg, backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, paddingHorizontal: THEME.space.xl, height: 50, justifyContent: 'center', ...THEME.shadow.brand }}
              >
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Describir mi problema en palabras</Text>
              </PressableScale>
            </View>
          </FadeInUp>
        )}

        {/* Tomar otra foto */}
        <FadeInUp delay={300}>
          <PressableScale
            onPress={reiniciar}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, height: 50, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.surface, ...THEME.shadow.sm }}
          >
            <Ionicons name="camera-outline" size={17} color={THEME.color.ink} />
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Tomar otra foto</Text>
          </PressableScale>
        </FadeInUp>
      </ScrollView>
    )
  }

  // ── Estado: inicial ──
  return (
    <ScrollView style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} contentContainerStyle={{ padding: THEME.space.xl, paddingTop: (StatusBar.currentHeight || 40) + THEME.space.xl, paddingBottom: THEME.space.xxxl + THEME.space.md }} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" />
      {/* Hero */}
      <FadeInUp delay={0}>
        <View style={{ alignItems: 'center', marginBottom: THEME.space.xxl }}>
          <View style={{ width: 80, height: 80, borderRadius: THEME.radius.xxl, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg }}>
            <Ionicons name="camera" size={38} color={THEME.color.brand} />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center' }}>Cotiza con una foto</Text>
          <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.sm, textAlign: 'center', lineHeight: 21 }}>
            Tómale una foto al problema y la IA te dice{'\n'}qué servicio necesitas y cuánto cuesta
          </Text>
        </View>
      </FadeInUp>

      {/* Pasos */}
      <FadeInUp delay={60}>
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.lg, ...THEME.shadow.sm }}>
          {[
            { icon: 'camera-outline' as const, text: 'Toma una foto del problema' },
            { icon: 'sparkles-outline' as const, text: 'La IA lo analiza en segundos' },
            { icon: 'cash-outline' as const, text: 'Recibes precio estimado y técnicos cerca' },
          ].map((paso, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, paddingVertical: THEME.space.sm }}>
              <View style={{ width: 34, height: 34, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={paso.icon} size={16} color={THEME.color.brand} />
              </View>
              <Text style={{ ...THEME.font.body, color: THEME.color.ink, flex: 1 }}>{paso.text}</Text>
              <View style={{ width: 24, height: 24, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft }}>{i + 1}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeInUp>

      {/* Caption opcional */}
      <FadeInUp delay={120}>
        <Text style={{ ...THEME.font.label, color: THEME.color.ink, marginBottom: THEME.space.sm }}>¿Algo más que debamos saber? (opcional)</Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Ej: el caño gotea desde ayer"
          placeholderTextColor={THEME.color.inkMuted}
          maxLength={500}
          style={{
            backgroundColor: THEME.color.surface,
            borderRadius: THEME.radius.lg,
            paddingHorizontal: THEME.space.lg,
            paddingVertical: THEME.space.md + 2,
            ...THEME.font.body,
            color: THEME.color.ink,
            marginBottom: THEME.space.md,
            ...THEME.shadow.sm,
          }}
        />
      </FadeInUp>

      {/* Distrito detectado */}
      {distrito ? (
        <FadeInUp delay={160}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.lg }}>
            <Ionicons name="location" size={14} color={THEME.color.brand} />
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>
              Cotizando para <Text style={{ color: THEME.color.ink, fontWeight: '800' }}>{distrito}</Text>
            </Text>
          </View>
        </FadeInUp>
      ) : null}

      {/* Botón cámara */}
      <FadeInUp delay={200}>
        <PressableScale
          onPress={tomarFoto}
          accessibilityLabel="Tomar foto"
          style={{
            height: 54,
            borderRadius: THEME.radius.lg,
            backgroundColor: THEME.color.brand,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: THEME.space.sm,
            marginBottom: THEME.space.md,
            ...THEME.shadow.brand,
          }}
        >
          <Ionicons name="camera" size={20} color={THEME.color.white} />
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Tomar foto</Text>
        </PressableScale>
      </FadeInUp>

      {/* Botón galería */}
      <FadeInUp delay={240}>
        <PressableScale
          onPress={elegirDeGaleria}
          accessibilityLabel="Elegir de galería"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, height: 52, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.surface, ...THEME.shadow.sm }}
        >
          <Ionicons name="images-outline" size={18} color={THEME.color.ink} />
          <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Elegir de galería</Text>
        </PressableScale>
      </FadeInUp>

      {/* Nota de privacidad */}
      <FadeInUp delay={280}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, marginTop: THEME.space.lg }}>
          <Ionicons name="lock-closed" size={12} color={THEME.color.inkMuted} />
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>Tu foto se analiza al instante y se elimina automático</Text>
        </View>
      </FadeInUp>
    </ScrollView>
  )
}
