// Subida de imágenes de la app.
//
// Antes cada pantalla subía a Supabase Storage con la key anon y armaba la
// URL con `getPublicUrl`. Pero el bucket `fotos` es PRIVADO: esas URLs
// devuelven error, así que ninguna foto cargaba nunca — y encima se
// persistían URLs muertas en `tecnicos.foto_url` y en las reseñas.
//
// Ahora va por /api/upload-image, que sube a Cloudinary con las credenciales
// del servidor y devuelve una URL pública permanente (sin firma que caduque).
// Es el mismo camino que usa la web.
//
// Los documentos de identidad NO pasan por acá: siguen yendo al bucket
// privado y se guarda el path, porque no deben ser públicos jamás.

import { ENV, fetchWithTimeout } from './env'
import { logger } from './logger'

export type CarpetaImagen = 'perfil' | 'galeria' | 'resenas' | 'solicitudes'

interface RespuestaUpload {
  secure_url?: string
  url?: string
  error?: string
}

/**
 * Sube una imagen local y devuelve su URL pública, o null si falla.
 * `token` es el Bearer del técnico; para clientes invitados va sin token y
 * el endpoint decide (hoy exige sesión, así que devuelve null y el caller
 * debe seguir sin foto en vez de romperse).
 */
export async function subirImagen(
  uriLocal: string,
  carpeta: CarpetaImagen,
  token?: string | null,
): Promise<string | null> {
  try {
    const nombre = uriLocal.split('/').pop() || `foto-${carpeta}.jpg`
    const ext = (nombre.split('.').pop() || 'jpg').toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

    const form = new FormData()
    // En React Native el archivo va como { uri, name, type }: no hay Blob real.
    form.append('file', { uri: uriLocal, name: nombre, type: mime } as unknown as Blob)
    form.append('folder', carpeta)

    const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/upload-image`, {
      method: 'POST',
      // Sin Content-Type a propósito: fetch pone el boundary del multipart.
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
      timeout: 30000,
    })

    const data = (await res.json().catch(() => ({}))) as RespuestaUpload
    if (!res.ok) {
      logger.warn('subirImagen: rechazado', data?.error ?? res.status)
      return null
    }
    return data.secure_url ?? data.url ?? null
  } catch (err) {
    logger.error('subirImagen: error', err)
    return null
  }
}
