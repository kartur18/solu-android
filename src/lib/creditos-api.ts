// Consumo de /api/creditos/* (saldo, movimientos, paquetes) desde la app.
//
// Estado real de la auth (verificado en el repo web, ago-2026): los tres
// routes usan requireUserSession() — cookie web — y NO aceptan el Bearer de
// la app. El propio repo web lo documenta en src/lib/auth/tecnico-request.ts
// ("todo endpoint que use únicamente ese helper es INALCANZABLE desde la
// app"). Estos fetchers ya mandan el Bearer estándar: cuando el server migre
// esos routes a resolverTecnicoId(), las secciones nuevas aparecen solas sin
// release de la app. Mientras tanto devuelven motivo 'no_disponible' y la UI
// degrada al dato local sin inventar errores de conexión.

import { ENV, fetchWithTimeout } from './env'

// ─── Tipos espejo del server (src/types/creditos.ts del repo web) ───

export interface SaldoCoins {
  saldo_perpetuo: number
  saldo_suscripcion: number
  saldo_bonus_inicial: number
  saldo_total: number
  fecha_expiracion_bonus: string | null
  // -1 si ya expiró; null si no hay bono con vencimiento.
  dias_a_expirar_bonus: number | null
  ilimitado: boolean
  congelado: boolean
}

export type TipoMovimientoCoins =
  | 'bonus_inicial'
  | 'bonus_verificacion_dni'
  | 'bonus_retroactivo'
  | 'compra'
  | 'consumo'
  | 'comision_cobro'
  | 'asignacion_suscripcion'
  | 'expiracion_suscripcion'
  | 'expiracion_bonus'
  | 'reembolso_cancelacion'
  | 'reembolso_indecopi'
  | 'ajuste_admin'
  | 'gift'
  | 'cashback'
  | 'congelacion'
  | 'descongelacion'

export interface MovimientoCoins {
  id: number
  // `| string`: un tipo nuevo en el CHECK del server no debe romper la lista.
  tipo: TipoMovimientoCoins | string
  // Firmado tal como viene del ledger: + acreditación / − descuento.
  cantidad: number
  detalle: Record<string, unknown> | null
  created_at: string
}

export interface PaginaMovimientos {
  movimientos: MovimientoCoins[]
  page: number
  has_more: boolean
}

export interface PaqueteServer {
  slug: string
  nombre: string
  creditos: number
  precio_pen: number
  descuento_label: string | null
  orden_display: number
}

export interface CatalogoPaquetes {
  // Fracción 0–1 (0.15 = 15%), igual que el server (TIER_DESCUENTO_PAQUETES).
  descuento_pct: number
  nivel: string | null
  costo_lead_tipico: number | null
  paquetes: PaqueteServer[]
  compra_habilitada: boolean
}

// ─── Fetch autenticado ───

// 'no_disponible' = el server rechazó la credencial (hoy: routes cookie-only).
// NO dispara el flujo de sesión expirada a propósito: el mismo Bearer sigue
// sirviendo en /tecnico/me y /tecnico/dashboard, así que un 401 acá no prueba
// nada sobre la sesión — desloguear por esto echaría a un técnico logueado.
export type ResultadoCreditos<T> =
  | { ok: true; data: T }
  | { ok: false; motivo: 'no_disponible' | 'transitorio' }

const TIMEOUT_MS = 15000

async function getCreditos<T>(
  ruta: string,
  token: string | null | undefined,
): Promise<ResultadoCreditos<T>> {
  if (!token) return { ok: false, motivo: 'no_disponible' }
  let res: Response
  try {
    res = await fetchWithTimeout(`${ENV.API_BASE_URL}${ruta}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: TIMEOUT_MS,
    })
  } catch {
    // Sin conexión o timeout: reintentable, no dice nada de la credencial.
    return { ok: false, motivo: 'transitorio' }
  }
  if (res.status === 401 || res.status === 403) return { ok: false, motivo: 'no_disponible' }
  if (!res.ok) return { ok: false, motivo: 'transitorio' }
  try {
    return { ok: true, data: (await res.json()) as T }
  } catch {
    return { ok: false, motivo: 'transitorio' }
  }
}

export function fetchSaldoCoins(token: string | null | undefined): Promise<ResultadoCreditos<SaldoCoins>> {
  return getCreditos<SaldoCoins>('/creditos/saldo', token)
}

export function fetchMovimientosCoins(
  token: string | null | undefined,
  page = 1,
  perPage = 10,
): Promise<ResultadoCreditos<PaginaMovimientos>> {
  return getCreditos<PaginaMovimientos>(`/creditos/movimientos?page=${page}&per_page=${perPage}`, token)
}

export function fetchPaquetesCoins(token: string | null | undefined): Promise<ResultadoCreditos<CatalogoPaquetes>> {
  return getCreditos<CatalogoPaquetes>('/creditos/paquetes', token)
}

// Espejo de precioConDescuentoEntero (src/lib/money.ts del server): sol
// entero, floor a favor del técnico — el MISMO número que cobra Culqi.
// Divergir acá mostraría un precio y cobraría otro.
export function precioConDescuentoEntero(precioPen: number, descuentoPct: number): number {
  if (!Number.isFinite(descuentoPct) || descuentoPct <= 0) return Math.round(precioPen)
  return Math.max(1, Math.floor(precioPen * (1 - Math.min(descuentoPct, 1))))
}
