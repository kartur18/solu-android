import { useState, useCallback } from 'react'
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../lib/theme'
import { FadeInUp, PressableScale, Shimmer } from './ui/Motion'
import { EstadoVacio } from './tecnico/EstadoVacio'
import { fetchClienteServiciosResult } from '../lib/servicios'
import { hace } from './tecnico/lead-utils'
import { logger } from '../lib/logger'

// Bandeja de mensajes del CLIENTE (la pestaña Mensajes era solo de técnicos:
// a un cliente le decía "Inicia sesión como técnico" con sus chats vivos).
//
// Fusiona dos fuentes y dedupea por código:
//  1. GET /api/cliente/servicios (origen==='contacto') — sus leads CONT-.
//  2. Los chatToken:* locales — leads creados en este teléfono, que existen
//     aunque el server no responda o el contacto se creara con otro número.

interface FilaChatCliente {
  codigo: string
  servicio: string | null
  distrito: string | null
  estado: string | null
  fecha: string | null
}

// Shape mínimo que esta bandeja usa de /api/cliente/servicios.
interface ServicioApi {
  codigo?: unknown
  origen?: unknown
  servicio?: unknown
  distrito?: unknown
  estado?: unknown
  created_at?: unknown
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

async function codigosLocales(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    return keys.filter((k) => k.startsWith('chatToken:')).map((k) => k.slice('chatToken:'.length))
  } catch {
    return []
  }
}

export function BandejaClienteChats({ nombre, whatsapp }: { nombre?: string; whatsapp?: string }) {
  const router = useRouter()
  const [filas, setFilas] = useState<FilaChatCliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState(false)

  const cargar = useCallback(async (conSpinner: boolean) => {
    if (conSpinner) setCargando(true)
    try {
      const [res, locales] = await Promise.all([
        whatsapp ? fetchClienteServiciosResult(whatsapp) : Promise.resolve({ estado: 'ok' as const, servicios: [] }),
        codigosLocales(),
      ])

      const porCodigo = new Map<string, FilaChatCliente>()
      if (res.estado === 'ok') {
        for (const s of res.servicios as ServicioApi[]) {
          const codigo = str(s.codigo)
          if (!codigo) continue
          // Solo leads: los pedidos SOL- tienen su chat dentro del tracking.
          if (s.origen !== 'contacto' && !codigo.startsWith('CONT-')) continue
          porCodigo.set(codigo, {
            codigo,
            servicio: str(s.servicio),
            distrito: str(s.distrito),
            estado: str(s.estado),
            fecha: str(s.created_at),
          })
        }
      }
      for (const codigo of locales) {
        if (!porCodigo.has(codigo)) {
          porCodigo.set(codigo, { codigo, servicio: null, distrito: null, estado: null, fecha: null })
        }
      }

      // Más reciente arriba; los locales sin fecha (solo token) al final.
      const orden = [...porCodigo.values()].sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0
        if (!a.fecha) return 1
        if (!b.fecha) return -1
        return b.fecha.localeCompare(a.fecha)
      })
      setFilas(orden)
      // El fallo de red no se disfraza de bandeja vacía: si el server no
      // respondió, se avisa aunque haya chats locales para mostrar.
      setError(res.estado === 'error')
    } catch (err) {
      logger.warn('bandeja cliente: no se pudieron cargar las conversaciones', err)
      setError(true)
    } finally {
      if (conSpinner) setCargando(false)
    }
  }, [whatsapp])

  useFocusEffect(
    useCallback(() => {
      void cargar(true)
    }, [cargar]),
  )

  async function onRefresh() {
    setRefrescando(true)
    await cargar(false)
    setRefrescando(false)
  }

  function abrir(fila: FilaChatCliente) {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: fila.codigo,
        codigo: fila.codigo,
        senderType: 'cliente',
        clientName: nombre ?? 'Cliente',
        techName: 'Tecnico',
      },
    })
  }

  if (cargando && filas.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, padding: THEME.space.lg, gap: THEME.space.md }}>
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} style={{ height: 84, borderRadius: THEME.radius.lg }} />
        ))}
      </View>
    )
  }

  if (!cargando && filas.length === 0 && error) {
    return (
      <EstadoVacio
        icono="cloud-offline-outline"
        titulo="No pudimos cargar tus mensajes"
        detalle="Revisa tu conexión e intenta de nuevo."
        accion={{ texto: 'Reintentar', onPress: () => { void cargar(true) } }}
      />
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      {error && (
        <View style={{ margin: THEME.space.lg, marginBottom: 0, backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.md, padding: THEME.space.md }}>
          <Text style={{ ...THEME.font.bodySm, color: '#991B1B' }}>
            No pudimos actualizar tus conversaciones. Desliza para reintentar.
          </Text>
        </View>
      )}

      <FlatList
        data={filas}
        keyExtractor={(item) => item.codigo}
        contentContainerStyle={{ padding: THEME.space.lg, gap: THEME.space.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={THEME.color.brand} />
        }
        ListEmptyComponent={
          <EstadoVacio
            icono="chatbubbles-outline"
            titulo="Aún no tienes conversaciones"
            detalle="Cuando contactes a un especialista, tu chat con él aparece aquí para que retomes la conversación cuando quieras."
            accion={{ texto: 'Buscar un técnico', onPress: () => router.push('/(tabs)/buscar') }}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 6) * 40}>
            <PressableScale
              onPress={() => abrir(item)}
              accessibilityLabel={`Abrir chat de ${item.servicio ?? item.codigo}`}
              style={{
                backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg,
                padding: THEME.space.lg, flexDirection: 'row', alignItems: 'center',
                gap: THEME.space.md, minHeight: 44, ...THEME.shadow.sm,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chatbubble-ellipses" size={20} color={THEME.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }} numberOfLines={1}>
                  {item.servicio ?? 'Chat con especialista'}
                </Text>
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }} numberOfLines={1}>
                  {[
                    item.distrito,
                    item.estado === 'En espera' ? 'Esperando respuesta' : item.estado === 'En proceso' ? 'Te respondió' : null,
                  ].filter(Boolean).join(' · ') || item.codigo}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {item.fecha ? (
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>{hace(item.fecha)}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={THEME.color.inkMuted} />
              </View>
            </PressableScale>
          </FadeInUp>
        )}
      />
    </View>
  )
}

export default BandejaClienteChats
