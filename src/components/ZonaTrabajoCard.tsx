// Zona de trabajo del técnico, editable desde el celular.
//
// Existía solo en la web: desde la app el técnico no podía decir dónde
// estaba trabajando hoy. Y el celular es justo donde lo necesita — el
// técnico que hoy trabaja en Comas y mañana en Miraflores no abre la
// laptop para avisarlo.
//
// Tres modos, los mismos que acepta /api/tecnicos/ubicacion:
//   - 'distrito'      → le llegan trabajos de su distrito y sus zonas.
//   - 'gps_actual'    → trabajos alrededor de dónde está AHORA. Es el modo
//                       del que se mueve; el GPS se refresca a mano con el
//                       botón, y el backend lo considera fresco 6 horas.
//   - 'gps_zona_fija' → radio alrededor de un punto elegido una vez.

import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import * as Location from 'expo-location'
import { COLORS } from '../lib/constants'
import { ENV, fetchWithTimeout } from '../lib/env'
import { logger } from '../lib/logger'

type Modo = 'distrito' | 'gps_actual' | 'gps_zona_fija'

interface UbicacionActual {
  lat: number | null
  lng: number | null
  ubicacion_modo: Modo | null
  radio_cobertura_km: number | null
  ubicacion_actualizada_at: string | null
  distrito: string | null
  zonas: string[] | null
}

const RADIOS = [3, 5, 10, 15, 25]

/** Coincide con GPS_FRESCO_HORAS del backend. */
const HORAS_FRESCO = 6

function textoFrescura(iso: string | null): { texto: string; vencido: boolean } {
  if (!iso) return { texto: 'Sin actualizar', vencido: true }
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return { texto: 'Sin actualizar', vencido: true }
  const horas = (Date.now() - t) / 3_600_000
  if (horas < 1) return { texto: 'Actualizada hace menos de 1 hora', vencido: false }
  if (horas < HORAS_FRESCO) return { texto: `Actualizada hace ${Math.floor(horas)} h`, vencido: false }
  return { texto: `Desactualizada (hace ${Math.floor(horas)} h)`, vencido: true }
}

export function ZonaTrabajoCard({ token }: { token: string | null }) {
  const [data, setData] = useState<UbicacionActual | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  const cargar = useCallback(async () => {
    if (!token) { setCargando(false); return }
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnicos/ubicacion`, { headers: headers() })
      if (!res.ok) return
      setData((await res.json()) as UbicacionActual)
    } catch (err) {
      logger.warn('ZonaTrabajo: no se pudo cargar', err)
    } finally {
      setCargando(false)
    }
  }, [token, headers])

  useEffect(() => { void cargar() }, [cargar])

  async function guardar(modo: Modo, radioKm?: number) {
    if (!token) return
    setGuardando(true)
    try {
      let lat: number | null = null
      let lng: number | null = null

      if (modo !== 'distrito') {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert(
            'Permiso de ubicación',
            'Para recibir trabajos cerca de donde estás, SOLU necesita acceso a tu ubicación. Puedes activarlo en los ajustes del teléfono.',
          )
          return
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      }

      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnicos/ubicacion`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          modo,
          lat,
          lng,
          radio_km: radioKm ?? data?.radio_cobertura_km ?? 5,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // El backend rechaza coords fuera de Lima/Arequipa: se lo decimos
        // con palabras en vez de dejar el switch a medias.
        const msg = body?.error === 'Ubicación fuera de cobertura'
          ? 'Por ahora SOLU opera en Lima y Arequipa. Puedes seguir recibiendo trabajos por distrito.'
          : 'No pudimos guardar tu zona. Intenta de nuevo.'
        Alert.alert('Zona de trabajo', msg)
        return
      }
      await cargar()
    } catch (err) {
      logger.warn('ZonaTrabajo: no se pudo guardar', err)
      Alert.alert('Zona de trabajo', 'No pudimos guardar tu zona. Revisa tu conexión.')
    } finally {
      setGuardando(false)
    }
  }

  async function refrescarGps() {
    if (!token) return
    setGuardando(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permiso de ubicación', 'Necesitamos tu ubicación para mostrarte los trabajos más cercanos.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnicos/ubicacion/actualizar-gps`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      })
      if (!res.ok) {
        Alert.alert('Ubicación', 'No pudimos actualizar tu ubicación. Intenta de nuevo.')
        return
      }
      await cargar()
    } catch (err) {
      logger.warn('ZonaTrabajo: no se pudo refrescar GPS', err)
      Alert.alert('Ubicación', 'No pudimos leer tu ubicación. Revisa que el GPS esté activo.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <View style={s.card}>
        <ActivityIndicator color={COLORS.pri} />
      </View>
    )
  }
  if (!data) return null

  const modo: Modo = data.ubicacion_modo ?? 'distrito'
  const esGps = modo === 'gps_actual'
  const frescura = textoFrescura(data.ubicacion_actualizada_at)

  return (
    <View style={s.card}>
      <Text style={s.titulo}>Mi zona de trabajo</Text>
      <Text style={s.sub}>Define dónde quieres recibir trabajos.</Text>

      <View style={s.opciones}>
        <Opcion
          activo={modo === 'distrito'}
          disabled={guardando}
          titulo="Por mi zona"
          detalle={
            data.zonas && data.zonas.length > 0
              ? data.zonas.join(', ')
              : data.distrito ?? 'Tu distrito'
          }
          onPress={() => guardar('distrito')}
        />
        <Opcion
          activo={esGps}
          disabled={guardando}
          titulo="Donde estoy ahora"
          detalle="Ideal si te mueves de distrito"
          onPress={() => guardar('gps_actual')}
        />
      </View>

      {esGps && (
        <View style={s.bloqueGps}>
          <View style={s.filaEstado}>
            <View style={[s.punto, { backgroundColor: frescura.vencido ? COLORS.yellow : COLORS.green }]} />
            <Text style={[s.estadoTexto, frescura.vencido && { color: COLORS.yellow }]}>{frescura.texto}</Text>
          </View>
          {frescura.vencido && (
            <Text style={s.aviso}>
              Mientras no la actualices, te seguimos mandando trabajos de tu zona registrada.
            </Text>
          )}

          <Text style={s.label}>Radio de búsqueda</Text>
          <View style={s.radios}>
            {RADIOS.map((r) => {
              const activo = (data.radio_cobertura_km ?? 5) === r
              return (
                <TouchableOpacity
                  key={r}
                  disabled={guardando}
                  onPress={() => guardar('gps_actual', r)}
                  style={[s.chip, activo && s.chipActivo]}
                  accessibilityRole="button"
                  accessibilityLabel={`Radio de ${r} kilómetros`}
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[s.chipTexto, activo && s.chipTextoActivo]}>{r} km</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={[s.btn, guardando && s.btnOff]}
            onPress={refrescarGps}
            disabled={guardando}
            accessibilityRole="button"
          >
            {guardando
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={s.btnTexto}>Actualizar mi ubicación</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function Opcion({
  activo, disabled, titulo, detalle, onPress,
}: {
  activo: boolean; disabled: boolean; titulo: string; detalle: string; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[s.opcion, activo && s.opcionActiva]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo }}
    >
      <Text style={[s.opcionTitulo, activo && s.opcionTituloActivo]}>{titulo}</Text>
      <Text style={s.opcionDetalle} numberOfLines={2}>{detalle}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  titulo: { fontSize: 16, fontWeight: '800', color: COLORS.dark },
  sub: { fontSize: 12, color: COLORS.gray, marginTop: 2, marginBottom: 12 },
  opciones: { flexDirection: 'row', gap: 10 },
  opcion: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 12,
    justifyContent: 'center',
  },
  opcionActiva: { borderColor: COLORS.pri, backgroundColor: COLORS.priLight },
  opcionTitulo: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  opcionTituloActivo: { color: COLORS.pri },
  opcionDetalle: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  bloqueGps: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  estadoTexto: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  aviso: { fontSize: 11, color: COLORS.gray, marginTop: 6, lineHeight: 15 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.dark, marginTop: 14, marginBottom: 8 },
  radios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    minWidth: 60,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActivo: { backgroundColor: COLORS.pri, borderColor: COLORS.pri },
  chipTexto: { fontSize: 13, fontWeight: '700', color: COLORS.gray },
  chipTextoActivo: { color: COLORS.white },
  btn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: COLORS.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOff: { opacity: 0.6 },
  btnTexto: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
})
