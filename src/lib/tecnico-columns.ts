// Columnas PÚBLICAS seguras de `tecnicos` que el cliente anon (la app)
// puede leer tras el lockdown de seguridad de la BD. Espeja la lista de la
// web (src/lib/tecnico-public-columns.ts) y el GRANT column-level de Supabase.
//
// NO incluye whatsapp / dni / email / lat / lng / push_token / ingresos:
// esas son sensibles y un anon ya NO puede leerlas en bloque (era la
// vulnerabilidad). El whatsapp se revela recién al contactar, vía el
// endpoint server-side /api/tecnico/[id]/contacto.
//
// Cualquier lectura de `tecnicos` desde la app DEBE usar este SELECT en vez
// de select('*') o el query falla con permission denied.
export const TECNICO_PUBLIC_COLUMNS = [
  'id',
  'nombre',
  'oficio',
  'oficios',
  'distrito',
  'zonas',
  'verificado',
  'foto_url',
  'galeria',
  'calificacion',
  'num_resenas',
  'servicios_completados',
  // 'tier' NO es columna de `tecnicos` (se calcula desde servicios_completados,
  // igual que la web). Seleccionarla rompía el query (column does not exist).
  'disponible',
  'estado_disponibilidad',
  'ocupado_hasta',
  'last_seen_at',
  'precio_desde',
  'descripcion',
  'experiencia',
  'plan',
  'plan_estado',
  'fecha_vencimiento',
  'created_at',
  'documentos_verificados',
] as const

export const TECNICO_PUBLIC_SELECT = TECNICO_PUBLIC_COLUMNS.join(', ')

export type TierTecnico = 'bronce' | 'plata' | 'oro' | 'platino'

// El tier de fidelidad NO es una columna de `tecnicos` (seleccionarla rompe el
// query): se DERIVA de servicios_completados, igual que la web. Umbrales de
// fidelidad: Plata 10+, Oro 50+, Platino 200+ (Bronce es la base, sin badge).
export function tierFromServicios(servicios?: number | null): TierTecnico {
  const n = servicios ?? 0
  if (n >= 200) return 'platino'
  if (n >= 50) return 'oro'
  if (n >= 10) return 'plata'
  return 'bronce'
}
