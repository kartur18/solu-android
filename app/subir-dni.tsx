// Subir/resubir el DNI del técnico logueado.
//
// No existía: /api/tecnico/dni se creó para el técnico que terminó el registro
// sin fotos (o cuyo upload falló) y quedó invisible —`verificado` exige las dos
// caras—, pero solo lo usaba el portal web, que el técnico de app nunca visita.
// Dos pasos, igual que la web (DniUploaderPanel): /api/upload-file sube el
// archivo al bucket PRIVADO de Supabase con service_role y /api/tecnico/dni
// asienta esa URL en la columna. NO se usa /api/upload-doc (Cloudinary, URL
// pública): un DNI en una URL pública es peor que no tener uploader.

import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ENV, fetchWithTimeout } from '../src/lib/env'
import { getTechToken, getTechSessionMeta } from '../src/lib/tech-session'
import { fetchMyTechProfileResult } from '../src/lib/tech-profile'
import { compressDNIPhoto } from '../src/lib/imageCompress'
import { logger } from '../src/lib/logger'
import { THEME } from '../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../src/components/ui/Motion'

type Cara = 'frente' | 'posterior'

const CARA_LABEL: Record<Cara, string> = { frente: 'DNI Frente', posterior: 'DNI Posterior' }

export default function SubirDniScreen() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [sinSesion, setSinSesion] = useState(false)
  const [errorCarga, setErrorCarga] = useState(false)
  const [tecnicoId, setTecnicoId] = useState<number | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [verificado, setVerificado] = useState(false)
  const [subidas, setSubidas] = useState<Record<Cara, boolean>>({ frente: false, posterior: false })
  const [subiendo, setSubiendo] = useState<Cara | null>(null)

  async function cargar() {
    setCargando(true)
    setErrorCarga(false)
    try {
      const session = await getTechSessionMeta()
      const savedToken = await getTechToken()
      if (!session?.id || !savedToken) {
        setSinSesion(true)
        return
      }
      setTecnicoId(session.id)
      setToken(savedToken)
      const perfil = await fetchMyTechProfileResult(savedToken)
      if (!perfil.ok) {
        setErrorCarga(true)
        return
      }
      // /api/tecnico/me devuelve el row completo; estas columnas no están en el tipo compartido.
      const data = perfil.data as typeof perfil.data & {
        dni_frente_url?: string | null
        dni_posterior_url?: string | null
      }
      setVerificado(!!data.verificado)
      setSubidas({ frente: !!data.dni_frente_url, posterior: !!data.dni_posterior_url })
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  async function elegirYSubir(cara: Cara) {
    if (subiendo || !tecnicoId || !token) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir las fotos de tu DNI.')
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (result.canceled || !result.assets?.[0]) return

    setSubiendo(cara)
    try {
      const uri = await compressDNIPhoto(result.assets[0].uri)
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase()
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

      // Paso 1: el archivo al bucket privado (server-side, URL firmada).
      const form = new FormData()
      // En React Native el archivo va como { uri, name, type }: no hay Blob real.
      form.append('file', { uri, name: `dni_${cara}.${ext}`, type: mime } as unknown as Blob)
      form.append('folder', `dni/${tecnicoId}`)
      const up = await fetchWithTimeout(`${ENV.API_BASE_URL}/upload-file`, {
        method: 'POST',
        body: form,
        timeout: 30000,
      })
      const upData = (await up.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!up.ok || !upData.url) throw new Error(upData.error || 'upload_failed')

      // Paso 2: asentar la URL en la columna — esto es lo que destraba la verificación.
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/dni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tecnicoId, cara, url: upData.url, auth_token: token }),
      })
      const data = (await res.json().catch(() => ({}))) as { completo?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error || 'guardar_failed')

      haptics.success()
      setSubidas(prev => ({ ...prev, [cara]: true }))
      if (data.completo) {
        Alert.alert(
          '¡DNI completo! 🎉',
          'Ya tenemos las dos caras. Lo revisamos y te activamos para que aparezcas en las búsquedas.',
          [{ text: 'Entendido', onPress: () => router.back() }],
        )
      } else {
        Alert.alert('Foto guardada', 'Falta la otra cara de tu DNI para completar tu verificación.')
      }
    } catch (err) {
      logger.error('subir-dni: fallo', err)
      Alert.alert(
        'No pudimos guardar la foto',
        'Revisa tu conexión e inténtalo de nuevo. Sin tu DNI no apareces en las búsquedas.',
      )
    } finally {
      setSubiendo(null)
    }
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: THEME.space.md }}>
        <ActivityIndicator size="small" color={THEME.color.brand} />
        <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>Cargando tu verificación...</Text>
      </View>
    )
  }

  if (sinSesion) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: THEME.space.xxl, gap: THEME.space.lg }}>
        <Ionicons name="lock-closed-outline" size={40} color={THEME.color.inkMuted} />
        <Text style={{ ...THEME.font.h3, color: THEME.color.ink, textAlign: 'center' }}>Inicia sesión para subir tu DNI</Text>
        <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center' }}>
          Entra a tu cuenta de técnico y vuelve a esta pantalla desde tu panel.
        </Text>
        <PressableScale
          onPress={() => router.replace('/(tabs)/cuenta')}
          accessibilityLabel="Ir a iniciar sesión"
          style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', ...THEME.shadow.brand }}
        >
          <Text style={{ color: THEME.color.white, fontWeight: '800', fontSize: 15 }}>Ir a iniciar sesión</Text>
        </PressableScale>
      </View>
    )
  }

  if (errorCarga) {
    return (
      <View accessibilityRole="alert" style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', padding: THEME.space.xxl, gap: THEME.space.lg }}>
        <Ionicons name="cloud-offline-outline" size={40} color={THEME.color.inkMuted} />
        <Text style={{ ...THEME.font.h3, color: THEME.color.ink, textAlign: 'center' }}>No pudimos cargar tu verificación</Text>
        <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center' }}>
          Es un problema de conexión con SOLU. Revisa tu internet y vuelve a intentar.
        </Text>
        <PressableScale
          onPress={() => { void cargar() }}
          accessibilityLabel="Reintentar la carga"
          style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, minHeight: 48, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...THEME.shadow.brand }}
        >
          <Ionicons name="refresh" size={18} color={THEME.color.white} />
          <Text style={{ color: THEME.color.white, fontWeight: '800', fontSize: 15 }}>Reintentar</Text>
        </PressableScale>
      </View>
    )
  }

  const completo = subidas.frente && subidas.posterior

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      contentContainerStyle={{ padding: THEME.space.xl, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <FadeInUp delay={0}>
        <Text style={{ ...THEME.font.h1, color: THEME.color.ink, marginBottom: THEME.space.xs }}>Verificación de DNI</Text>
        <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginBottom: THEME.space.lg }}>
          Sube las dos caras de tu DNI para validar tu identidad
        </Text>

        {/* Por qué importa: sin las dos caras, verificado=false y el técnico es
            invisible en las búsquedas (y accept devuelve 404). */}
        {verificado ? (
          <View style={{ flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start', backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.xl }}>
            <Ionicons name="checkmark-circle" size={18} color={THEME.color.success} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#065F46', lineHeight: 19 }}>
              Ya estás verificado ✅. Solo sube fotos nuevas si necesitas actualizar tu documento.
            </Text>
          </View>
        ) : completo ? (
          <View style={{ flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start', backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.xl }}>
            <Ionicons name="time" size={18} color={THEME.color.warning} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#92400E', lineHeight: 19 }}>
              Ya tenemos las dos caras de tu DNI. Lo estamos revisando: te activamos apenas lo validemos.
            </Text>
          </View>
        ) : (
          <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start', backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.xl }}>
            <Ionicons name="alert-circle" size={18} color={THEME.color.danger} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#991B1B', lineHeight: 19 }}>
              Sin tu DNI no apareces en las búsquedas y no puedes recibir trabajos. Sube las dos caras y te activamos.
            </Text>
          </View>
        )}

        {/* Nota de confianza: mismo copy que el registro. */}
        <View style={{ flexDirection: 'row', gap: THEME.space.md, alignItems: 'flex-start', backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginBottom: THEME.space.xl }}>
          <Ionicons name="lock-closed" size={18} color={THEME.color.success} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, ...THEME.font.bodySm, color: '#065F46', lineHeight: 19 }}>
            Tus fotos solo se usan para verificar tu identidad y darte el badge ✅ Verificado. Los clientes nunca las ven.
          </Text>
        </View>
      </FadeInUp>

      {(['frente', 'posterior'] as const).map((cara, i) => {
        const listo = subidas[cara]
        const enCurso = subiendo === cara
        return (
          <FadeInUp key={cara} delay={120 + i * 60}>
            <PressableScale
              onPress={() => { void elegirYSubir(cara) }}
              disabled={subiendo !== null}
              accessibilityLabel={listo
                ? `Foto del ${CARA_LABEL[cara]} subida. Toca para cambiarla`
                : `Subir foto del ${CARA_LABEL[cara]}`}
              style={{
                backgroundColor: listo ? THEME.color.successBg : THEME.color.surface,
                borderRadius: THEME.radius.xl,
                paddingVertical: THEME.space.xxxl,
                paddingHorizontal: THEME.space.lg,
                marginBottom: THEME.space.md,
                borderWidth: 2,
                borderColor: listo ? THEME.color.success : THEME.color.line,
                borderStyle: listo ? 'solid' : 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: subiendo !== null && !enCurso ? 0.6 : 1,
              }}
            >
              {enCurso ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={THEME.color.brand} />
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: THEME.space.sm }}>Subiendo...</Text>
                </View>
              ) : listo ? (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 56, height: 56, borderRadius: THEME.radius.lg, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...THEME.shadow.sm }}>
                    <Ionicons name="checkmark-circle" size={34} color={THEME.color.success} />
                  </View>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.success, marginTop: THEME.space.sm }}>{CARA_LABEL[cara]} listo</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>Toca para cambiar</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 56, height: 56, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="camera-outline" size={28} color={THEME.color.brand} />
                  </View>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: THEME.space.sm }}>{CARA_LABEL[cara]}</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Toca para subir</Text>
                </View>
              )}
            </PressableScale>
          </FadeInUp>
        )
      })}

      <FadeInUp delay={260}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Volver a mi panel"
          style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: THEME.space.sm }}
        >
          <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.inkSoft }}>Volver a mi panel</Text>
        </TouchableOpacity>
      </FadeInUp>
    </ScrollView>
  )
}
