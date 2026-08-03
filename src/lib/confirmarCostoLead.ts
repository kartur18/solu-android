// Confirmación de costo antes de tomar un trabajo.
//
// Aceptar un lead descuenta entre 160 y 10.000 SoluCoins según categoría,
// distrito y urgencia. Hasta ahora el técnico apretaba "Aceptar trabajo" y
// se enteraba del monto DESPUÉS de que se lo descontaran — un cheque en
// blanco, y encima los términos de la app dicen que el precio se conoce de
// antemano.
//
// Si el precio no se puede consultar (red caída, endpoint viejo) se deja
// continuar: preferimos que el técnico pueda trabajar antes que bloquearlo
// por una consulta informativa.

import { Alert } from 'react-native'
import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

interface PrecioLead {
  costo_coins: number | null
  saldo_total: number
  ilimitado: boolean
  congelado: boolean
  alcanza: boolean
}

function formatCoins(n: number): string {
  return n.toLocaleString('es-PE')
}

/** Soles aproximados, para que el número tenga sentido real. 1 coin = S/0.005 */
function aSoles(coins: number): string {
  return (coins * 0.005).toFixed(2)
}

/**
 * Muestra el costo y espera la decisión del técnico.
 * `true` = seguir adelante con el cobro.
 */
export async function confirmarCostoLead(codigo: string, token: string | null): Promise<boolean> {
  let precio: PrecioLead | null = null
  try {
    const res = await fetchWithTimeout(
      `${ENV.API_BASE_URL}/tecnico/lead/precio?codigo=${encodeURIComponent(codigo)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    )
    if (res.ok) precio = (await res.json()) as PrecioLead
  } catch (err) {
    logger.warn('confirmarCostoLead: no se pudo consultar el precio', err)
  }

  // Sin dato de precio no bloqueamos: el cobro real lo valida el servidor.
  if (!precio || precio.costo_coins == null) return true

  if (precio.congelado) {
    Alert.alert(
      'Cuenta con saldo congelado',
      'Tu saldo está retenido temporalmente. Escríbenos por soporte para revisarlo.',
    )
    return false
  }

  if (!precio.alcanza) {
    return new Promise((resolve) => {
      Alert.alert(
        'Saldo insuficiente',
        `Este trabajo cuesta ${formatCoins(precio!.costo_coins!)} SoluCoins y tienes ${formatCoins(precio!.saldo_total)}. Recarga para poder tomarlo.`,
        [
          { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Recargar', onPress: () => resolve(false) },
        ],
      )
    })
  }

  const costo = precio.costo_coins
  const restante = precio.ilimitado ? null : precio.saldo_total - costo

  return new Promise((resolve) => {
    Alert.alert(
      'Confirmar trabajo',
      precio!.ilimitado
        ? 'Tomar este trabajo no consume saldo (tienes coins ilimitados). El cliente paga tu servicio directamente.'
        : `Tomar este trabajo cuesta ${formatCoins(costo)} SoluCoins (≈ S/${aSoles(costo)}).\n\n` +
          `Te quedarían ${formatCoins(restante!)} SoluCoins.\n\n` +
          'Lo que te pague el cliente por el servicio es tuyo: SOLU no cobra comisión.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Tomar trabajo', onPress: () => resolve(true) },
      ],
    )
  })
}
