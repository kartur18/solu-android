// Bandeja de mensajes del técnico.
//
// Causa raíz #1 de que ningún técnico haya respondido nunca: la app no tenía
// dónde ver los contactos. El técnico 23 acumuló 14 leads y desde el celular
// no veía ninguno — solo el portal web los listaba, y el técnico vive en el
// celular. Sin bandeja no hay respuesta, y sin respuesta no se cobra el lead.
//
// Reusa los endpoints que ya consume MensajesTab de la web:
//   GET /api/tecnico/chats        → conversaciones + no leídos
//   GET /api/tecnico/lead/precio  → costo del lead y saldo
// El chat en sí ya existe (app/chat/[id].tsx con senderType='tecnico').
//
// El cobro se dispara con el PRIMER mensaje del técnico, no al abrir: por eso
// el costo se muestra ANTES de entrar a escribir y leer nunca cuesta.

import { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text, FlatList, Modal, RefreshControl, ScrollView } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ENV, fetchWithTimeout } from '../../src/lib/env'
import { getTechToken, getTechSessionMeta } from '../../src/lib/tech-session'
import { notifyIf401 } from '../../src/lib/session-expired'
import { logger } from '../../src/lib/logger'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer } from '../../src/components/ui/Motion'

// Espejo de `ChatResumen` de /api/tecnico/chats (web).
export interface ChatResumen {
  codigo: string
  cliente_nombre: string | null
  servicio_buscado: string | null
  distrito: string | null
  created_at: string
  ultimo_mensaje: string | null
  ultimo_mensaje_at: string | null
  mensajes_nuevos: number
}

interface PrecioLead {
  costo_coins: number | null
  ya_pagado: boolean
  saldo_total: number
  ilimitado: boolean
  congelado: boolean
  alcanza: boolean
}

const REFRESCO_MS = 30_000
// Los precios se piden de a pocos: son una consulta por lead y el endpoint
// limita a 60/min. Se cachean por código, así el refresco no vuelve a pedirlos.
const LOTE_PRECIOS = 4

// 1 coin = S/0,005. Mostrar soles evita que "1.200 coins" suene a nada.
function aSoles(coins: number): string {
  return (coins * 0.005).toFixed(2)
}

function formatCoins(n: number): string {
  return n.toLocaleString('es-PE')
}

function capitalizar(texto: string): string {
  return texto
    .trim()
    .split(/\s+/)
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p))
    .join(' ')
}

function nombreCliente(chat: ChatResumen): string {
  return chat.cliente_nombre ? capitalizar(chat.cliente_nombre) : 'Cliente'
}

function hace(fecha: string | null): string {
  if (!fecha) return ''
  const ms = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `hace ${dias} d`
}

/**
 * Conversaciones del técnico autenticado. Lanza si la respuesta no es OK para
 * que la UI distinga "sin mensajes" de "no se pudo cargar".
 * La exporta también el tab layout, para el badge de no leídos.
 */
export async function fetchChatsResumen(token: string): Promise<ChatResumen[]> {
  const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/chats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  notifyIf401(res)
  if (!res.ok) throw new Error(`tecnico_chats_${res.status}`)
  const data = (await res.json()) as { chats?: ChatResumen[] }
  return data?.chats ?? []
}

// Precio de un lead. Devuelve null si no se pudo consultar: es informativo, el
// cobro real lo valida el servidor al enviar el mensaje.
async function fetchPrecioLead(codigo: string, token: string): Promise<PrecioLead | null> {
  try {
    const res = await fetchWithTimeout(
      `${ENV.API_BASE_URL}/tecnico/lead/precio?codigo=${encodeURIComponent(codigo)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    notifyIf401(res)
    if (!res.ok) return null
    return (await res.json()) as PrecioLead
  } catch (err) {
    logger.warn('mensajes: no se pudo consultar el precio del lead', err)
    return null
  }
}

export default function MensajesScreen() {
  const router = useRouter()
  const [chats, setChats] = useState<ChatResumen[]>([])
  const [precios, setPrecios] = useState<Record<string, PrecioLead | null>>({})
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinSesion, setSinSesion] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ChatResumen | null>(null)
  // Último lead abierto: al volver pudo quedar pagado, así que su precio
  // cacheado se invalida para no seguir mostrando "cuesta N coins".
  const ultimoAbiertoRef = useRef<string | null>(null)

  const cargar = useCallback(async (conSpinner: boolean) => {
    if (conSpinner) setCargando(true)
    try {
      const sesion = await getTechSessionMeta()
      const token = await getTechToken()
      if (!sesion || !token) {
        setSinSesion(true)
        setChats([])
        return
      }
      setSinSesion(false)
      setChats(await fetchChatsResumen(token))
      setError(null)
    } catch (err) {
      logger.warn('mensajes: no se pudieron cargar los chats', err)
      setError('No pudimos cargar tus mensajes. Desliza para reintentar.')
    } finally {
      if (conSpinner) setCargando(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let activo = true
      const abierto = ultimoAbiertoRef.current
      if (abierto) {
        ultimoAbiertoRef.current = null
        setPrecios((prev) => {
          const next = { ...prev }
          delete next[abierto]
          return next
        })
      }
      cargar(true)
      const id = setInterval(() => {
        if (activo) cargar(false)
      }, REFRESCO_MS)
      return () => {
        activo = false
        clearInterval(id)
      }
    }, [cargar]),
  )

  // Precios de a lotes: cada corrida resuelve LOTE_PRECIOS pendientes y el
  // cambio de `precios` reprograma la siguiente hasta que no quede ninguno.
  useEffect(() => {
    const pendientes = chats
      .map((c) => c.codigo)
      .filter((codigo) => !(codigo in precios))
      .slice(0, LOTE_PRECIOS)
    if (pendientes.length === 0) return
    let activo = true
    void (async () => {
      const token = await getTechToken()
      if (!activo) return
      // Sin token igual se cachea null: deja el precio como "desconocido" en vez
      // de dejar el skeleton girando para siempre.
      const resultados = token
        ? await Promise.all(pendientes.map((c) => fetchPrecioLead(c, token)))
        : pendientes.map(() => null)
      if (!activo) return
      setPrecios((prev) => {
        const next = { ...prev }
        pendientes.forEach((codigo, i) => {
          next[codigo] = resultados[i]
        })
        return next
      })
    })()
    return () => {
      activo = false
    }
  }, [chats, precios])

  async function onRefresh() {
    setRefrescando(true)
    await cargar(false)
    setRefrescando(false)
  }

  function abrirChat(chat: ChatResumen) {
    ultimoAbiertoRef.current = chat.codigo
    setSeleccionado(null)
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: chat.codigo,
        codigo: chat.codigo,
        senderType: 'tecnico',
        clientName: nombreCliente(chat),
      },
    })
  }

  // Leer es gratis; escribir cobra. Solo se entra derecho al chat cuando
  // sabemos que no hay nada que avisar (lead ya pagado o coins ilimitados).
  // Con el precio todavía cargando o no consultable la hoja igual se abre: si
  // no, el técnico llegaba a escribir —y a que le cobraran— sin ver un número.
  async function onTocarChat(chat: ChatResumen) {
    const precio = precios[chat.codigo]
    if (precio && (precio.ya_pagado || precio.ilimitado)) {
      abrirChat(chat)
      return
    }
    setSeleccionado(chat)
    // El lote de precios puede tardar varias tandas en llegar a este lead:
    // al tocarlo lo pedimos ya, para que la hoja no quede en "consultando".
    if (precio === undefined) {
      const token = await getTechToken()
      const consultado = token ? await fetchPrecioLead(chat.codigo, token) : null
      setPrecios((prev) => (chat.codigo in prev ? prev : { ...prev, [chat.codigo]: consultado }))
    }
  }

  const totalNuevos = chats.reduce((sum, c) => sum + c.mensajes_nuevos, 0)

  if (sinSesion) {
    return (
      <Vacio
        icono="log-in-outline"
        titulo="Inicia sesión como técnico"
        detalle="Tus clientes te escriben acá. Ingresa a tu cuenta para ver sus mensajes y responderles."
        accion={{ texto: 'Ir a mi cuenta', onPress: () => router.push('/(tabs)/cuenta') }}
      />
    )
  }

  if (cargando && chats.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, padding: THEME.space.lg, gap: THEME.space.md }}>
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} style={{ height: 92, borderRadius: THEME.radius.lg }} />
        ))}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      {totalNuevos > 0 && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm,
          paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md,
          backgroundColor: THEME.color.brandLight,
        }}>
          <Ionicons name="mail-unread" size={16} color={THEME.color.brand} />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.brandDark }}>
            {totalNuevos === 1 ? 'Tienes 1 mensaje sin leer' : `Tienes ${totalNuevos} mensajes sin leer`}
          </Text>
        </View>
      )}

      {error && (
        <View style={{ margin: THEME.space.lg, marginBottom: 0, backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.md, padding: THEME.space.md }}>
          <Text style={{ ...THEME.font.bodySm, color: '#991B1B' }}>{error}</Text>
        </View>
      )}

      <FlatList
        data={chats}
        keyExtractor={(item) => item.codigo}
        contentContainerStyle={{ padding: THEME.space.lg, gap: THEME.space.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={THEME.color.brand} />
        }
        ListEmptyComponent={
          <Vacio
            icono="chatbubbles-outline"
            titulo="Todavía no tienes contactos"
            detalle="Cuando un cliente te contacte por SOLU, su mensaje aparece acá y le respondes desde el celular."
          />
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 6) * 40}>
            <FilaChat chat={item} precio={precios[item.codigo]} onPress={() => { void onTocarChat(item) }} />
          </FadeInUp>
        )}
      />

      <HojaCosto
        chat={seleccionado}
        precio={seleccionado ? precios[seleccionado.codigo] : null}
        onCerrar={() => setSeleccionado(null)}
        onAbrir={abrirChat}
        onComprarCoins={() => {
          setSeleccionado(null)
          router.push('/comprar-coins')
        }}
      />
    </View>
  )
}

// ── Fila de conversación ──────────────────────────────────────────────────
function FilaChat({
  chat,
  precio,
  onPress,
}: {
  chat: ChatResumen
  precio: PrecioLead | null | undefined
  onPress: () => void
}) {
  const nombre = nombreCliente(chat)
  const servicio = chat.servicio_buscado ? capitalizar(chat.servicio_buscado) : 'Servicio'
  const nuevos = chat.mensajes_nuevos > 0

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Abrir chat con ${nombre}`}
      style={{
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.lg,
        padding: THEME.space.lg,
        borderWidth: 1,
        borderColor: nuevos ? THEME.color.brandSoft : THEME.color.line,
        ...(nuevos ? THEME.shadow.md : THEME.shadow.sm),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
        <View style={{
          width: 44, height: 44, borderRadius: THEME.radius.full,
          backgroundColor: nuevos ? THEME.color.brand : THEME.color.surfaceSunken,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ ...THEME.font.h3, color: nuevos ? THEME.color.white : THEME.color.inkSoft }}>
            {nombre.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
            <Text numberOfLines={1} style={{ ...THEME.font.h3, color: THEME.color.ink, flexShrink: 1 }}>
              {nombre}
            </Text>
            {nuevos && (
              <View style={{
                backgroundColor: THEME.color.brand, borderRadius: THEME.radius.full,
                minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center',
              }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.white }}>
                  {chat.mensajes_nuevos}
                </Text>
              </View>
            )}
          </View>

          <Text numberOfLines={1} style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 1 }}>
            {servicio}
            {chat.distrito ? ` · ${capitalizar(chat.distrito)}` : ''}
          </Text>

          <Text numberOfLines={1} style={{ ...THEME.font.bodySm, color: THEME.color.inkMuted, marginTop: 3 }}>
            {chat.ultimo_mensaje ?? 'Sin mensajes aún'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: THEME.space.xs }}>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>
            {hace(chat.ultimo_mensaje_at ?? chat.created_at)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={THEME.color.inkMuted} />
        </View>
      </View>

      <ChipCosto precio={precio} />
    </PressableScale>
  )
}

// Costo visible en la lista: el técnico sabe cuánto vale responder antes de
// entrar, no después del descuento.
function ChipCosto({ precio }: { precio: PrecioLead | null | undefined }) {
  if (precio === undefined) {
    return <Shimmer style={{ height: 20, width: 150, borderRadius: THEME.radius.full, marginTop: THEME.space.md }} />
  }
  if (precio === null || precio.costo_coins == null) return null

  if (precio.ya_pagado) {
    return (
      <Etiqueta
        icono="checkmark-circle"
        color={THEME.color.success}
        fondo={THEME.color.successBg}
        texto="Lead pagado · responder no cuesta"
      />
    )
  }

  if (precio.ilimitado) {
    return (
      <Etiqueta
        icono="infinite"
        color={THEME.color.info}
        fondo={THEME.color.infoBg}
        texto="Responder no consume saldo"
      />
    )
  }

  const costo = precio.costo_coins
  if (!precio.alcanza) {
    return (
      <Etiqueta
        icono="alert-circle"
        color={THEME.color.danger}
        fondo={THEME.color.dangerBg}
        texto={`Responder cuesta ${formatCoins(costo)} coins · saldo insuficiente`}
      />
    )
  }

  return (
    <Etiqueta
      icono="chatbubble-ellipses"
      color={THEME.color.brandDark}
      fondo={THEME.color.brandLight}
      texto={`Responder cuesta ${formatCoins(costo)} coins ≈ S/${aSoles(costo)}`}
    />
  )
}

function Etiqueta({
  icono,
  color,
  fondo,
  texto,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name']
  color: string
  fondo: string
  texto: string
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs,
      alignSelf: 'flex-start', marginTop: THEME.space.md,
      backgroundColor: fondo, borderRadius: THEME.radius.full,
      paddingHorizontal: THEME.space.md, paddingVertical: 5,
    }}>
      <Ionicons name={icono} size={13} color={color} />
      <Text style={{ ...THEME.font.caption, fontWeight: '700', color }}>{texto}</Text>
    </View>
  )
}

// ── Hoja de costo previa al chat ──────────────────────────────────────────
function HojaCosto({
  chat,
  precio,
  onCerrar,
  onAbrir,
  onComprarCoins,
}: {
  chat: ChatResumen | null
  precio: PrecioLead | null | undefined
  onCerrar: () => void
  onAbrir: (chat: ChatResumen) => void
  onComprarCoins: () => void
}) {
  if (!chat) return null

  const consultando = precio === undefined
  // null = el endpoint no respondió. No bloqueamos (el cobro real lo valida el
  // servidor), pero lo decimos en vez de callar el monto.
  const costo = precio && precio.costo_coins != null ? precio.costo_coins : null
  const restante = precio ? precio.saldo_total - (costo ?? 0) : 0
  // Sin costo conocido no lo mandamos a recargar: no sabemos si le alcanza.
  const alcanza = costo == null ? true : precio?.alcanza === true && precio.congelado !== true

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: THEME.color.surface,
          borderTopLeftRadius: THEME.radius.xxl,
          borderTopRightRadius: THEME.radius.xxl,
          paddingHorizontal: THEME.space.xl,
          paddingTop: THEME.space.md,
          paddingBottom: THEME.space.xxxl,
          maxHeight: '90%',
        }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.color.line, marginBottom: THEME.space.lg }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ ...THEME.font.h2, color: THEME.color.ink }}>
              Responder a {nombreCliente(chat)}
            </Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs }}>
              {chat.servicio_buscado ? capitalizar(chat.servicio_buscado) : 'Servicio'}
              {chat.distrito ? ` · ${capitalizar(chat.distrito)}` : ''}
            </Text>

            <View style={{
              backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.lg,
              padding: THEME.space.lg, marginTop: THEME.space.lg,
            }}>
              {consultando ? (
                <>
                  <Shimmer style={{ height: 30, width: 170, borderRadius: THEME.radius.md }} />
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: THEME.space.sm }}>
                    Consultando cuánto cuesta responder…
                  </Text>
                </>
              ) : precio?.ilimitado ? (
                <Text style={{ ...THEME.font.h2, color: THEME.color.brandDark }}>
                  Sin costo (coins ilimitados)
                </Text>
              ) : costo == null ? (
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark }}>
                  No pudimos consultar el costo ahora. Se te descontará de tu saldo cuando envíes
                  tu primer mensaje; leer el chat sigue siendo gratis.
                </Text>
              ) : (
                <>
                  <Text style={{ ...THEME.font.display, color: THEME.color.brandDark }}>
                    {formatCoins(costo)} coins
                  </Text>
                  <Text style={{ ...THEME.font.bodySm, color: THEME.color.brandDark, marginTop: 2 }}>
                    ≈ S/{aSoles(costo)} · tu saldo: {formatCoins(precio?.saldo_total ?? 0)} coins
                    {alcanza ? ` (te quedarían ${formatCoins(restante)})` : ''}
                  </Text>
                </>
              )}
            </View>

            <Fila icono="lock-open-outline" texto="Leer el chat es gratis. Se te cobra recién cuando envías tu primer mensaje." />
            <Fila icono="cash-outline" texto="Lo que te pague el cliente por el trabajo es tuyo: SOLU no cobra comisión." />
            {/* El cobro se marca en `contactos.coins_cobrados`, o sea por
                contacto: si el mismo cliente te escribe por otro lead, vuelve
                a cobrarse. */}
            <Fila icono="repeat-outline" texto="Se cobra una sola vez por este contacto. Después conversas todo lo que necesites." />

            {precio?.congelado && (
              <View style={{ backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.md, padding: THEME.space.md, marginTop: THEME.space.md }}>
                <Text style={{ ...THEME.font.bodySm, color: '#92400E' }}>
                  Tu saldo está retenido temporalmente. Escríbenos por soporte para revisarlo.
                </Text>
              </View>
            )}

            {consultando ? (
              <>
                <PressableScale disabled accessibilityLabel="Consultando el costo" style={botonPrimario}>
                  <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Consultando el costo…</Text>
                </PressableScale>
                {/* Leer nunca se bloquea: es gratis y el server enmascara el
                    contacto del cliente hasta que el lead esté pagado. */}
                <PressableScale
                  onPress={() => onAbrir(chat)}
                  accessibilityLabel="Abrir el chat solo para leer"
                  style={botonSecundario}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.inkSoft }}>Solo leer el chat</Text>
                </PressableScale>
              </>
            ) : alcanza ? (
              <PressableScale
                onPress={() => onAbrir(chat)}
                accessibilityLabel="Abrir el chat y responder"
                style={botonPrimario}
              >
                <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Abrir chat y responder</Text>
              </PressableScale>
            ) : (
              <>
                <PressableScale
                  onPress={onComprarCoins}
                  accessibilityLabel="Comprar SoluCoins"
                  style={botonPrimario}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Comprar SoluCoins</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => onAbrir(chat)}
                  accessibilityLabel="Abrir el chat solo para leer"
                  style={botonSecundario}
                >
                  <Text style={{ ...THEME.font.h3, color: THEME.color.inkSoft }}>Solo leer el chat</Text>
                </PressableScale>
              </>
            )}

            <PressableScale onPress={onCerrar} accessibilityLabel="Cerrar" style={botonSecundario}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.inkMuted }}>Ahora no</Text>
            </PressableScale>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const botonPrimario = {
  backgroundColor: THEME.color.brand,
  borderRadius: THEME.radius.lg,
  minHeight: 52,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginTop: THEME.space.xl,
  ...THEME.shadow.brand,
}

const botonSecundario = {
  minHeight: 48,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginTop: THEME.space.sm,
}

function Fila({ icono, texto }: { icono: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: THEME.space.md, marginTop: THEME.space.lg, alignItems: 'flex-start' }}>
      <Ionicons name={icono} size={18} color={THEME.color.inkMuted} style={{ marginTop: 1 }} />
      <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, flex: 1, lineHeight: 19 }}>{texto}</Text>
    </View>
  )
}

// ── Estado vacío / sin sesión ─────────────────────────────────────────────
function Vacio({
  icono,
  titulo,
  detalle,
  accion,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name']
  titulo: string
  detalle: string
  accion?: { texto: string; onPress: () => void }
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: THEME.space.xxxl, backgroundColor: THEME.color.surfaceAlt }}>
      <View style={{
        width: 76, height: 76, borderRadius: THEME.radius.full,
        backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center',
        marginBottom: THEME.space.lg,
      }}>
        <Ionicons name={icono} size={36} color={THEME.color.brand} />
      </View>
      <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>{titulo}</Text>
      <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.sm, lineHeight: 20 }}>
        {detalle}
      </Text>
      {accion && (
        <PressableScale
          onPress={accion.onPress}
          accessibilityLabel={accion.texto}
          style={{
            backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg,
            minHeight: 48, paddingHorizontal: THEME.space.xxl,
            alignItems: 'center', justifyContent: 'center',
            marginTop: THEME.space.xl, ...THEME.shadow.brand,
          }}
        >
          <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>{accion.texto}</Text>
        </PressableScale>
      )}
    </View>
  )
}
