// Bandeja de mensajes del técnico.
//
// Causa raíz #1 de que ningún técnico haya respondido nunca: la app no tenía
// dónde ver los contactos. El técnico 23 acumuló 14 leads y desde el celular
// no veía ninguno — solo el portal web los listaba, y el técnico vive en el
// celular. Sin bandeja no hay respuesta, y sin respuesta no se cobra el lead.
//
// Reusa los endpoints que ya consume MensajesTab de la web:
//   GET /api/tecnico/chats        → conversaciones + no leídos
//   GET /api/tecnico/lead/precio  → costo del lead, urgencia y saldo
//   GET /api/tecnico/me           → saldo de SoluCoins (para la barra de saldo)
// El chat en sí ya existe (app/chat/[id].tsx con senderType='tecnico').
//
// El cobro se dispara con el PRIMER mensaje del técnico, no al abrir: por eso
// el costo se muestra ANTES de entrar a escribir y leer nunca cuesta.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { View, Text, FlatList, RefreshControl } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { getTechToken, getTechSessionMeta } from '../../src/lib/tech-session'
import { useClientProfile } from '../../src/lib/useClientProfile'
import { BandejaClienteChats } from '../../src/components/BandejaClienteChats'
import { fetchMyTechProfile } from '../../src/lib/tech-profile'
import { logger } from '../../src/lib/logger'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, Shimmer } from '../../src/components/ui/Motion'
import { ChatLeadRow } from '../../src/components/tecnico/ChatLeadRow'
import { HojaCostoLead } from '../../src/components/tecnico/HojaCostoLead'
import { EstadoVacio } from '../../src/components/tecnico/EstadoVacio'
import { SaldoCoinsBar } from '../../src/components/tecnico/SaldoCoinsBar'
import { ResumenPendientes } from '../../src/components/tecnico/ResumenPendientes'
import { fetchChatsResumen, fetchPrecioLead } from '../../src/components/tecnico/lead-api'
import {
  contarPendientes, nombreCliente, ordenarChats,
  type ChatResumen, type PrecioLead,
} from '../../src/components/tecnico/lead-utils'

const REFRESCO_MS = 30_000
// Los precios se piden de a pocos: son una consulta por lead y el endpoint
// limita a 60/min. Se cachean por código, así el refresco no vuelve a pedirlos.
const LOTE_PRECIOS = 4

export default function MensajesScreen() {
  const router = useRouter()
  // Perfil de cliente guardado (solu_client_session): sin sesión de técnico,
  // la bandeja pasa a modo cliente en vez de decirle "Inicia sesión como
  // técnico" a alguien que tiene chats vivos con especialistas.
  const { profile: perfilCliente, loaded: perfilClienteListo } = useClientProfile()
  const [chats, setChats] = useState<ChatResumen[]>([])
  const [precios, setPrecios] = useState<Record<string, PrecioLead | null>>({})
  const [saldo, setSaldo] = useState<number | null>(null)
  // Ya se intentó leer el saldo: sin esto, un fallo del perfil dejaba el
  // skeleton girando para siempre en la cabecera.
  const [saldoConsultado, setSaldoConsultado] = useState(false)
  const [ilimitado, setIlimitado] = useState(false)
  const [congelado, setCongelado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinSesion, setSinSesion] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ChatResumen | null>(null)
  // Último lead abierto: al volver pudo quedar pagado, así que su precio
  // cacheado se invalida para no seguir mostrando "cuesta N coins".
  const ultimoAbiertoRef = useRef<string | null>(null)

  // El saldo se relee en cada foco: si el técnico vuelve de comprar coins o de
  // responder un chat, la barra y los chips tienen que reflejarlo al toque.
  const cargarSaldo = useCallback(async (token: string) => {
    const perfil = await fetchMyTechProfile(token)
    if (perfil && typeof perfil.coins_balance === 'number') setSaldo(perfil.coins_balance)
    setSaldoConsultado(true)
  }, [])

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
      // El saldo va en paralelo y nunca rechaza: que no se pueda leer el perfil
      // no debe dejar la bandeja sin chats.
      void cargarSaldo(token)
      setChats(await fetchChatsResumen(token))
      setError(null)
    } catch (err) {
      logger.warn('mensajes: no se pudieron cargar los chats', err)
      setError('No pudimos cargar tus mensajes. Desliza para reintentar.')
    } finally {
      if (conSpinner) setCargando(false)
    }
  }, [cargarSaldo])

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
      // El precio trae saldo/ilimitado/congelado del técnico: es el dato más
      // fresco que tenemos y evita una consulta extra de perfil.
      const ultimo = resultados.filter((r): r is PrecioLead => r != null).pop()
      if (ultimo) {
        setSaldo(ultimo.saldo_total)
        setIlimitado(ultimo.ilimitado)
        setCongelado(ultimo.congelado)
      }
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
    // Reintentar precios que no se pudieron consultar: si fue un bache de red,
    // el técnico no tiene que quedarse sin ver el costo hasta el próximo login.
    setPrecios((prev) => {
      const next: Record<string, PrecioLead | null> = {}
      for (const [codigo, precio] of Object.entries(prev)) {
        if (precio != null) next[codigo] = precio
      }
      return next
    })
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

  function irAComprar() {
    setSeleccionado(null)
    router.push('/comprar-coins')
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
      if (consultado) setSaldo(consultado.saldo_total)
      setPrecios((prev) => (chat.codigo in prev ? prev : { ...prev, [chat.codigo]: consultado }))
    }
  }

  const ordenados = useMemo(() => ordenarChats(chats), [chats])
  const pendientes = contarPendientes(chats, precios)
  const nuevos = chats.reduce((sum, c) => sum + c.mensajes_nuevos, 0)

  if (sinSesion) {
    // Evita el flash de "inicia sesión" mientras se lee el perfil guardado.
    if (!perfilClienteListo) {
      return <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} />
    }
    if (perfilCliente?.whatsapp || perfilCliente?.nombre) {
      return <BandejaClienteChats nombre={perfilCliente?.nombre} whatsapp={perfilCliente?.whatsapp} />
    }
    return (
      <EstadoVacio
        icono="log-in-outline"
        titulo="Inicia sesión para ver tus mensajes"
        detalle="Si eres técnico, ingresa a tu cuenta. Si buscas un servicio, contacta a un especialista y tu chat aparecerá aquí."
        accion={{ texto: 'Buscar un técnico', onPress: () => router.push('/(tabs)/buscar') }}
        accionSecundaria={{ texto: 'Soy técnico — ir a mi cuenta', onPress: () => router.push('/(tabs)/cuenta') }}
      />
    )
  }

  if (cargando && chats.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, padding: THEME.space.lg, gap: THEME.space.md }}>
        {/* 124 = alto real de ChatLeadRow (padding 32 + bloque de texto 57 +
            chip 24 + su margen 12). Con 92 la lista pegaba un salto de 30px
            por fila al llegar los chats. */}
        <Shimmer style={{ height: 64, borderRadius: THEME.radius.lg }} />
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} style={{ height: 124, borderRadius: THEME.radius.lg }} />
        ))}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}>
      {/* Saldo siempre a la vista: es lo que decide si puede responder. */}
      {(saldo !== null || !saldoConsultado) && (
        <View style={{ paddingHorizontal: THEME.space.lg, paddingTop: THEME.space.md }}>
          <SaldoCoinsBar saldo={saldo} ilimitado={ilimitado} congelado={congelado} onComprar={irAComprar} />
        </View>
      )}

      <ResumenPendientes pendientes={pendientes} sinLeer={nuevos} />

      {error && (
        <View style={{ margin: THEME.space.lg, marginBottom: 0, backgroundColor: THEME.color.dangerBg, borderRadius: THEME.radius.md, padding: THEME.space.md }}>
          <Text style={{ ...THEME.font.bodySm, color: '#991B1B' }}>{error}</Text>
        </View>
      )}

      <FlatList
        data={ordenados}
        keyExtractor={(item) => item.codigo}
        contentContainerStyle={{ padding: THEME.space.lg, gap: THEME.space.md, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={THEME.color.brand} />
        }
        ListEmptyComponent={
          <EstadoVacio
            icono="chatbubbles-outline"
            titulo="Todavía no tienes contactos"
            detalle="Solo te escriben clientes de los distritos y oficios que tienes configurados. Si te mudaste de zona o sumaste un oficio, actualízalo para que te lleguen más."
            accion={{
              texto: 'Revisar mi zona de trabajo',
              onPress: () => router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'servicios' } }),
            }}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 6) * 40}>
            <ChatLeadRow
              chat={item}
              precio={precios[item.codigo]}
              saldo={saldo}
              onPress={() => { void onTocarChat(item) }}
            />
          </FadeInUp>
        )}
      />

      <HojaCostoLead
        chat={seleccionado}
        precio={seleccionado ? precios[seleccionado.codigo] : null}
        saldo={saldo}
        onCerrar={() => setSeleccionado(null)}
        onAbrir={abrirChat}
        onComprarCoins={irAComprar}
      />
    </View>
  )
}
