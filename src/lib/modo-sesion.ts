// Estado del modo activo de Mi cuenta y qué cuentas hay guardadas en este
// dispositivo. Las reglas puras están en modo-cuenta.ts; acá solo el
// almacenamiento y el pub/sub.
//
// SEGURIDAD: nada de esto pregunta al servidor. Saber si un WhatsApp tiene
// cuenta del otro lado se deduce ÚNICAMENTE de las sesiones guardadas en este
// teléfono; consultarlo por número sería enumeración de usuarios.

import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTechSessionMeta, onTechSessionChange } from './tech-session'
import {
  esModoCuenta,
  modoAlternativo,
  type CuentasEnDispositivo,
  type ModoCuenta,
} from './modo-cuenta'

const MODO_KEY = 'solu_modo_activo'
// Misma clave que useClientProfile y la pantalla de servicios: la sesión de
// cliente no se toca desde acá, solo se mira si existe.
const CLIENTE_SESSION_KEY = 'solu_client_session'

type ModoListener = (modo: ModoCuenta) => void
type CuentasListener = () => void

const modoListeners = new Set<ModoListener>()
const cuentasListeners = new Set<CuentasListener>()

// El panel del técnico y la pantalla de cliente cambian el modo desde su
// propio header; Mi cuenta escucha acá para reflejarlo sin remontar nada.
export function onModoChange(fn: ModoListener): () => void {
  modoListeners.add(fn)
  return () => { modoListeners.delete(fn) }
}

// Avisa que se creó o cerró una sesión (de cualquiera de los dos lados) para
// que las entradas de cambio de modo aparezcan o desaparezcan al instante.
export function onCuentasChange(fn: CuentasListener): () => void {
  cuentasListeners.add(fn)
  return () => { cuentasListeners.delete(fn) }
}

export function notificarCuentasCambiaron(): void {
  for (const fn of [...cuentasListeners]) {
    try { fn() } catch { /* un listener no puede tumbar a los demás */ }
  }
}

// Cambia el modo YA (emite primero) y persiste después: la persistencia es una
// comodidad, no puede demorar el toque. Ninguna sesión se cierra.
export function cambiarModo(destino: ModoCuenta): void {
  for (const fn of [...modoListeners]) {
    try { fn(destino) } catch { /* un listener no puede tumbar a los demás */ }
  }
  AsyncStorage.setItem(MODO_KEY, destino).catch(() => {})
}

// Vuelve al selector "¿Cómo quieres ingresar?": se olvida la última elección
// para que la próxima apertura no la reimponga.
export function olvidarModo(): void {
  AsyncStorage.removeItem(MODO_KEY).catch(() => {})
}

export async function leerModoActivo(): Promise<ModoCuenta | null> {
  try {
    const guardado = await AsyncStorage.getItem(MODO_KEY)
    return esModoCuenta(guardado) ? guardado : null
  } catch {
    return null
  }
}

export async function leerCuentasEnDispositivo(): Promise<CuentasEnDispositivo> {
  const [tecnico, cliente] = await Promise.all([
    getTechSessionMeta().catch(() => null),
    AsyncStorage.getItem(CLIENTE_SESSION_KEY).catch(() => null),
  ])
  return { tecnico: !!tecnico?.id, cliente: !!cliente }
}

// null = no hay cuenta del otro lado en este teléfono, así que no se ofrece
// cambiar (nada de callejones). Se recalcula cuando alguien entra o sale.
export function useOtroModoDisponible(actual: ModoCuenta): ModoCuenta | null {
  const [otro, setOtro] = useState<ModoCuenta | null>(null)

  useEffect(() => {
    let vivo = true
    const revisar = () => {
      void leerCuentasEnDispositivo().then((cuentas) => {
        if (vivo) setOtro(modoAlternativo(actual, cuentas))
      })
    }
    revisar()
    const dejarCuentas = onCuentasChange(revisar)
    const dejarTech = onTechSessionChange(revisar)
    return () => { vivo = false; dejarCuentas(); dejarTech() }
  }, [actual])

  return otro
}
