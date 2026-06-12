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
