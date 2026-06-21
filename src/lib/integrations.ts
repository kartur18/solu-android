import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

/**
 * RENIEC - Verificar DNI contra api/verify-dni en la web (llama Decolecta)
 * Retorna nombre completo si el DNI existe en RENIEC.
 */
export async function verifyDNI(dni: string, nombreRegistrado?: string): Promise<{
  valid: boolean
  nombre?: string
  nombres?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  nameMatches?: boolean
  error?: string
}> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/verify-dni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, nombre: nombreRegistrado }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      return { valid: false, error: data.error }
    }
    return {
      valid: true,
      nombre: data.nombreCompleto,
      nombres: data.nombres,
      apellidoPaterno: data.apellidoPaterno,
      apellidoMaterno: data.apellidoMaterno,
      nameMatches: data.nameMatches,
    }
  } catch (err) {
    logger.error('RENIEC verify error:', err)
    return { valid: false, error: 'Error de conexión' }
  }
}

/**
 * Enviar push notification via backend. El backend resuelve el push_token
 * buscando en `tecnicos` o `clientes_users` según targetType. Para clientes,
 * targetId es el whatsapp normalizado (solo dígitos).
 */
export async function sendPush(
  targetType: 'tecnico' | 'cliente',
  targetId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, title, body, data }),
    })
    return res.ok
  } catch {
    return false
  }
}
