// Tipos y helpers puros de la bandeja de leads del técnico.
//
// Viven fuera de la pantalla para que la bandeja (app/(tabs)/mensajes.tsx) y
// el panel (app/(tabs)/cuenta.tsx) hablen del mismo saldo, el mismo umbral y
// el mismo orden — antes cada pantalla tenía su propia idea de "saldo bajo".

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

// Espejo de /api/tecnico/lead/precio. `urgencia` y `distrito` los devuelve el
// endpoint desde siempre; la app los ignoraba y por eso el técnico no podía
// ver de un vistazo cuál lead era una emergencia.
export interface PrecioLead {
  costo_coins: number | null
  ya_pagado: boolean
  saldo_total: number
  ilimitado: boolean
  congelado: boolean
  alcanza: boolean
  urgencia?: string | null
  distrito?: string | null
}

// 1 coin = S/0,005 (mismo ratio que pricing-creditos.ts en la web). Mostrar
// soles evita que "1.200 coins" suene a nada.
export const COIN_EN_SOLES = 0.005

// Espejo de LEAD_COINS_HOGAR (web): el contacto del oficio core, urgencia
// normal, distrito sin recargo. Sirve para decirle al técnico cuántos
// contactos más le entran en el saldo, que es lo único que le importa.
export const COINS_POR_CONTACTO = 1_000

// Espejo de SALDO_BAJO_COINS de la web (= 3 × LEAD_COINS_HOGAR). Tiene que
// ser el MISMO número: el cron `low-balance-notif` le manda "saldo bajo" al
// técnico con menos de 3.000, y si la app avisaba recién en 2.000, abría la
// notificación y encontraba una barra que decía que estaba todo bien.
export const UMBRAL_SALDO_BAJO = 3 * COINS_POR_CONTACTO

/** Cuántos contactos le entran en el saldo, aprox. (zona premium cuesta más). */
export function contactosAproxRestantes(saldo: number): number {
  return Math.floor(saldo / COINS_POR_CONTACTO)
}

export function aSoles(coins: number): string {
  return (coins * COIN_EN_SOLES).toFixed(2)
}

export function formatCoins(n: number): string {
  return n.toLocaleString('es-PE')
}

export function capitalizar(texto: string): string {
  return texto
    .trim()
    .split(/\s+/)
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p))
    .join(' ')
}

export function nombreCliente(chat: ChatResumen): string {
  return chat.cliente_nombre ? capitalizar(chat.cliente_nombre) : 'Cliente'
}

export function hace(fecha: string | null): string {
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

// Cuánto lleva esperando el cliente, en formato corto para el chip de espera.
export function esperando(fecha: string | null): string {
  if (!fecha) return ''
  const ms = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${Math.max(min, 1)} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} h`
  return `${Math.floor(hrs / 24)} d`
}

export type EstadoSaldo = 'cargando' | 'congelado' | 'ilimitado' | 'sin-saldo' | 'bajo' | 'ok'

export function estadoSaldo(
  saldo: number | null,
  ilimitado?: boolean,
  congelado?: boolean,
): EstadoSaldo {
  // Congelado gana: hay saldo en pantalla pero no se puede gastar, y decir
  // "todo bien" sería mentirle al técnico que no logra responder.
  if (congelado) return 'congelado'
  if (ilimitado) return 'ilimitado'
  if (saldo == null) return 'cargando'
  if (saldo <= 0) return 'sin-saldo'
  if (saldo < UMBRAL_SALDO_BAJO) return 'bajo'
  return 'ok'
}

// `alcanza` viene del endpoint contra el saldo del momento en que se consultó
// el precio. Si el técnico compra coins y vuelve, ese flag queda viejo y lo
// seguiría mandando a recargar algo que ya recargó: por eso se recalcula
// contra el saldo vivo de la pantalla.
export function alcanzaSaldo(precio: PrecioLead | null | undefined, saldo: number | null): boolean {
  if (!precio) return true
  if (precio.congelado) return false
  if (precio.ilimitado || precio.ya_pagado) return true
  if (precio.costo_coins == null) return true
  const disponible = saldo ?? precio.saldo_total
  return disponible >= precio.costo_coins
}

// Un lead está pendiente si el cliente escribió y no se leyó, o si el técnico
// nunca respondió (`ya_pagado` se marca con su primer mensaje, sea cual sea
// su plan). Es la cuenta que contesta "¿cuántos leads me faltan atender?".
export function estaPendiente(chat: ChatResumen, precio: PrecioLead | null | undefined): boolean {
  if (chat.mensajes_nuevos > 0) return true
  return precio?.ya_pagado === false
}

export function contarPendientes(
  chats: ChatResumen[],
  precios: Record<string, PrecioLead | null | undefined>,
): number {
  return chats.filter((c) => estaPendiente(c, precios[c.codigo])).length
}

function actividad(chat: ChatResumen): number {
  const t = chat.ultimo_mensaje_at ?? chat.created_at
  const ms = new Date(t).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

// Primero los que tienen mensajes sin leer (ahí está el trabajo por ganar) y
// dentro de cada grupo, lo más reciente arriba. El criterio usa solo datos de
// /tecnico/chats —no los precios, que llegan de a lotes— para que la lista no
// se reordene sola mientras el técnico la está leyendo.
export function ordenarChats(chats: ChatResumen[]): ChatResumen[] {
  const conNuevos = chats.filter((c) => c.mensajes_nuevos > 0)
  const resto = chats.filter((c) => c.mensajes_nuevos === 0)
  const porActividad = (a: ChatResumen, b: ChatResumen) => actividad(b) - actividad(a)
  return [...conNuevos.sort(porActividad), ...resto.sort(porActividad)]
}

export type NivelUrgencia = 'emergencia' | 'urgente' | null

export function nivelUrgencia(urgencia: string | null | undefined): NivelUrgencia {
  const u = (urgencia ?? '').toLowerCase()
  if (u === 'emergencia') return 'emergencia'
  // 'si' es el valor del formulario viejo de clientes; el endpoint ya lo
  // normaliza, pero la app no debe romperse si llega crudo.
  if (u === 'urgente' || u === 'si') return 'urgente'
  return null
}
