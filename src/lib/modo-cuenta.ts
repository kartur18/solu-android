// Reglas del modo activo de Mi cuenta (cliente | técnico).
//
// Cliente y técnico son CUENTAS DISTINTAS con su propio acceso: la de técnico
// vive en SecureStore (token Bearer) y la de cliente en AsyncStorage. Cambiar
// de modo solo cambia cuál de las dos se muestra — ninguna se cierra.
//
// Este módulo es puro a propósito (sin AsyncStorage ni SecureStore ni red): la
// decisión de qué mostrar se puede leer y probar de un vistazo. El acceso al
// almacenamiento vive en modo-sesion.ts.

export type ModoCuenta = 'cliente' | 'tecnico'

// Qué cuentas hay guardadas EN ESTE DISPOSITIVO. Nunca se le pregunta al
// servidor si un número tiene cuenta del otro lado: eso permitiría enumerar
// usuarios ajenos. Solo se mira lo que esta persona ya tiene abierto acá.
export interface CuentasEnDispositivo {
  cliente: boolean
  tecnico: boolean
}

export function esModoCuenta(valor: string | null | undefined): valor is ModoCuenta {
  return valor === 'cliente' || valor === 'tecnico'
}

// Modo con el que abre Mi cuenta. Manda la última elección explícita, pero
// solo si esa cuenta sigue guardada: si cerró sesión de ese lado, respetarla
// lo dejaría en un login que no pidió. Sin elección válida gana técnico (su
// pantalla diaria); sin ninguna sesión, null = mostrar el selector.
export function modoInicial(guardado: ModoCuenta | null, cuentas: CuentasEnDispositivo): ModoCuenta | null {
  if (guardado && cuentas[guardado]) return guardado
  if (cuentas.tecnico) return 'tecnico'
  if (cuentas.cliente) return 'cliente'
  return null
}

// El otro lado, SOLO si esa cuenta ya existe en el dispositivo: ofrecer el
// cambio sin cuenta detrás sería un callejón (lo manda a un login que no pidió).
export function modoAlternativo(actual: ModoCuenta, cuentas: CuentasEnDispositivo): ModoCuenta | null {
  const otro: ModoCuenta = actual === 'cliente' ? 'tecnico' : 'cliente'
  return cuentas[otro] ? otro : null
}

// Copy único de las dos entradas: se cambia de modo, no se cierra sesión.
export function etiquetaCambioModo(destino: ModoCuenta): string {
  return destino === 'cliente' ? 'Cambiar a modo cliente' : 'Cambiar a modo especialista'
}

// Vale para los dos lados: lo importante es que son cuentas distintas y que
// nadie pierde la sesión de la que está usando.
export const DETALLE_CAMBIO_MODO = 'Es otra cuenta, con su propio acceso. Esta queda abierta.'

export function etiquetaAccesibleCambioModo(destino: ModoCuenta): string {
  return destino === 'cliente'
    ? 'Cambiar a modo cliente. Es otra cuenta y tu cuenta de técnico queda abierta'
    : 'Cambiar a modo especialista. Es otra cuenta y tu cuenta de cliente queda abierta'
}
