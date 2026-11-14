// Enlace ESTABLE de la foto de perfil de un técnico (13-nov-2026).
//
// `tecnicos.foto_url` guarda una URL firmada del bucket privado que VENCE a las 24 h. La web lo
// resolvió en agosto (su /api/foto sirve la foto con un enlace que no vence), pero la app seguía
// pintando la URL firmada tal cual: al día siguiente de subirse, la foto salía como un cuadro en
// blanco. En el iPhone de Carlo, 6 de 7 técnicos en Inicio y Buscar se veían así.
//
// /api/foto solo sirve `perfil/<uuid>.<ext>` y solo de técnicos reales (el bucket también guarda DNI),
// así que esta función solo reescribe lo que cumple esa forma; todo lo demás se devuelve igual.

const SITIO = 'https://www.solu.pe'

/** Mismo patrón que ARCHIVO_FOTO_PERFIL de la web: `<uuid>.<ext>`. */
const ARCHIVO_FOTO_PERFIL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp|gif)$/i

/**
 * URL absoluta y estable de la foto, o el valor guardado si no se puede servir por /api/foto
 * (Cloudinary viejo, otra carpeta, vacío). Nunca lanza.
 */
export function fotoEstable(stored: string | null | undefined): string {
  if (!stored) return ''
  if (!stored.includes('/storage/v1/object/')) return stored
  // …/storage/v1/object/sign/<bucket>/perfil/<uuid>.<ext>?token=…
  const m = stored.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\/([^?#]+)/)
  if (!m) return stored
  let ruta: string
  try {
    ruta = decodeURIComponent(m[1])
  } catch {
    return stored
  }
  const partes = ruta.split('/')
  if (partes.length !== 2 || partes[0] !== 'perfil' || !ARCHIVO_FOTO_PERFIL.test(partes[1])) return stored
  return `${SITIO}/api/foto/${ruta}`
}
