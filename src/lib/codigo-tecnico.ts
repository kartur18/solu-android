// Código público del técnico (formato SOLU-XXXXX).
//
// PORTADO VERBATIM desde la web (solu-app-clone/src/lib/codigo-tecnico.ts):
// mismo alfabeto, mismas constantes (P, A) y mismo algoritmo, para que el
// código que ve el cliente coincida EXACTO entre web y app. Es aritmética
// entera pura (Math + strings), sin APIs de Node, así que corre igual en
// Hermes/JSC. NO cambiar P/A/alfabeto: rompería los códigos ya emitidos.
//
// El id de la tabla `tecnicos` es secuencial: mostrarlo tal cual filtra
// cuántos técnicos hay (id=812 ⇒ ~812 técnicos) y deja adivinar perfiles
// vecinos iterando. Por eso el código NO es el id: pasamos el id por un
// scramble multiplicativo modular —una biyección sobre [0, P)— antes de
// codificarlo. Mismo id ⇒ mismo código siempre, pero id=5 no es "SOLU-5" y
// dos ids consecutivos dan códigos sin relación visible.
//
// No hay columna nueva: el código se deriva del id y se invierte con
// `idDeCodigo`, así que /tecnico/123 y /tecnico/SOLU-XXXXX resuelven al mismo
// técnico sin tocar la BD.

// Alfabeto base-31 sin caracteres ambiguos (se quitan 0/O y 1/I/L): así nadie
// confunde el código al leerlo en voz alta o tipearlo desde una factura.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const BASE = ALFABETO.length // 31
const LARGO = 5 // 31^5 ≈ 28.6M: cubre de sobra el padrón de técnicos
const PREFIJO = 'SOLU-'

// P primo (el 1.000.000-ésimo primo) y A el multiplicador del scramble. Como
// P es primo, cualquier A en [1, P) es coprimo con P, así que la biyección y
// su inversa existen siempre. Los ids reales (< P) nunca colisionan.
const P = 15_485_863
const A = 9_576_890

// Inverso modular de A (A · A_INV ≡ 1 mod P) por Euclides extendido. Se calcula
// una vez al cargar el módulo para no hardcodear una constante que podría
// desincronizarse de A si algún día se cambia el multiplicador.
function inversoModular(a: number, m: number): number {
  let viejoR = a % m
  let r = m
  let viejoS = 1
  let s = 0
  while (r !== 0) {
    const q = Math.floor(viejoR / r)
    ;[viejoR, r] = [r, viejoR - q * r]
    ;[viejoS, s] = [s, viejoS - q * s]
  }
  // Normaliza el coeficiente a [0, m).
  return ((viejoS % m) + m) % m
}

const A_INV = inversoModular(A, P)

/**
 * Código público estable del técnico: "SOLU-" + 5 chars base-31.
 * Determinista (mismo id ⇒ mismo código) y no obviamente secuencial.
 */
export function codigoDeTecnico(id: number): string {
  // Defensivo: los ids reales son enteros positivos < P. El `mod P` mantiene la
  // función total sin romper la biyección dentro del rango real de ids.
  const idSeguro = ((Math.trunc(id) % P) + P) % P
  let n = (idSeguro * A) % P
  let cuerpo = ''
  for (let i = 0; i < LARGO; i++) {
    cuerpo = ALFABETO[n % BASE] + cuerpo
    n = Math.floor(n / BASE)
  }
  return PREFIJO + cuerpo
}

/**
 * Inversa de `codigoDeTecnico`. Devuelve el id numérico, o `null` si el string
 * no tiene formato de código válido (prefijo, largo, caracteres o rango). Un
 * string puramente numérico ("123") devuelve `null` a propósito: quien resuelve
 * la ruta cae entonces al parseo numérico de siempre.
 */
export function idDeCodigo(codigo: string): number | null {
  if (typeof codigo !== 'string') return null
  const limpio = codigo.trim().toUpperCase()
  if (!limpio.startsWith(PREFIJO)) return null
  const cuerpo = limpio.slice(PREFIJO.length)
  if (cuerpo.length !== LARGO) return null

  let n = 0
  for (const ch of cuerpo) {
    const idx = ALFABETO.indexOf(ch)
    if (idx === -1) return null // char fuera del alfabeto ⇒ no es un código
    n = n * BASE + idx
  }
  // n ≥ P no lo pudo producir ningún id real: el scramble vive en [0, P).
  if (n >= P) return null

  const id = (n * A_INV) % P
  // id 0 no es un técnico (los ids arrancan en 1); trátalo como no-código.
  return id > 0 ? id : null
}

/** True si el string tiene forma de código válido (no garantiza que el técnico exista). */
export function esCodigoTecnico(valor: string): boolean {
  return idDeCodigo(valor) !== null
}
