// Detección centralizada de "sesión de técnico expirada" (HTTP 401).
//
// Problema que resuelve: cuando el Bearer del técnico vence en mitad de sesión,
// los fetch autenticados devuelven 401 pero la app no lo detectaba: el chat se
// congelaba, el badge quedaba en 0 y el GPS dejaba de emitir, todo en silencio.
//
// Diseño: este módulo vive fuera de React para que cualquier helper de `lib`
// pueda reportar un 401 sin importar componentes. El layout raíz registra un
// handler (que limpia la sesión + navega al login + avisa). Los helpers de
// fetch autenticado llaman `notifyIf401(res)` y SOLO disparan el handler cuando
// la respuesta es EXACTAMENTE 401 (token inválido/vencido). 403/404/4xx de
// validación, 5xx, timeouts y errores de red NO desloguean: un fallo transitorio
// jamás saca al usuario.

type SessionExpiredHandler = () => void

// Varios suscriptores: el layout raíz (navega al login + avisa) y la pantalla
// de cuenta (baja su estado `loggedIn`) reaccionan al mismo 401.
const listeners = new Set<SessionExpiredHandler>()
// Evita ráfagas: si varias requests en paralelo devuelven 401 a la vez, el
// manejo se dispara una sola vez hasta que se rearma tras un re-login.
let yaDisparado = false

// Suscribe un handler de sesión expirada. Devuelve una función para
// desuscribir (cleanup del efecto).
export function registerSessionExpiredHandler(fn: SessionExpiredHandler): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// Rearma el disparo. Se llama tras un login exitoso para que un futuro 401
// vuelva a redirigir.
export function resetSessionExpired(): void {
  yaDisparado = false
}

// Dispara el manejo de sesión expirada (idempotente hasta el próximo reset).
export function triggerSessionExpired(): void {
  if (yaDisparado) return
  yaDisparado = true
  for (const fn of listeners) {
    try { fn() } catch {}
  }
}

// Inspecciona una respuesta de un fetch autenticado del técnico. Si es
// EXACTAMENTE 401, dispara el manejo de sesión expirada. Devuelve la misma
// respuesta para poder encadenar (`if (!res.ok) ...` sigue funcionando).
export function notifyIf401(res: Response): Response {
  if (res.status === 401) triggerSessionExpired()
  return res
}
