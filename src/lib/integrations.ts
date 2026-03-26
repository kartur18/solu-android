import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

/**
 * RENIEC - Verificar DNI del técnico
 * Usa la API de la web (solu.pe/api/auto-verify)
 */
export async function verifyDNI(dni: string): Promise<{ valid: boolean; nombre?: string }> {
  try {
    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/auto-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni }),
    })
    const data = await res.json()
    return { valid: data.valid || false, nombre: data.nombre }
  } catch (err) {
    logger.error('RENIEC verify error:', err)
    return { valid: false }
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
 * Track analytics event (Mixpanel via API)
 */
export async function trackEvent(event: string, properties?: Record<string, any>): Promise<void> {
  try {
    // Mixpanel is initialized in _layout.tsx, this is for server-side tracking
    const res = await fetchWithTimeout(`https://api.mixpanel.com/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        properties: {
          token: 'f066dc22ac56e6bea53703c76239504c',
          ...properties,
        },
      }),
    })
  } catch {}
}

/**
 * Verificar pago con Culqi (para renovaciones)
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
