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
 * Enviar email via API de la web (Resend)
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Notificar al técnico via API (push + email + WhatsApp)
 */
export async function notifyTech(tecnicoId: number, title: string, message: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/notify-tech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tecnicoId, title, message }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Generar factura/boleta via NubeFact
 */
export async function emitBoleta(data: {
  tecnicoId: number
  monto: number
  concepto: string
}): Promise<{ success: boolean; url?: string }> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/emit-boleta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    return { success: result.success || false, url: result.url }
  } catch {
    return { success: false }
  }
}

/**
 * Enviar mensaje WhatsApp via Cloud API
 */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'whatsapp', phone, message }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Procesar pago via Flow (para renovaciones)
 */
export async function processPayment(data: {
  tecnicoId: number
  plan: string
  amount: number
}): Promise<{ success: boolean }> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/process-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    return { success: result.success || false }
  } catch {
    return { success: false }
  }
}
