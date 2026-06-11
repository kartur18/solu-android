import { SERVICIOS } from './constants'

export type Urgencia = 'normal' | 'urgente' | 'emergencia'

const EMERGENCY_WORDS = [
  'fuga', 'inunda', 'humo', 'chispa', 'gas', 'corto', 'incendio',
  'no puedo entrar', 'trabada', 'reventó', 'reventado', 'se rompió', 'rota',
  'ahora', 'urgente', 'auxilio', 'socorro', 'peligro', 'emergencia',
]

const URGENT_WORDS = [
  'hoy', 'pronto', 'rápido', 'lo antes', 'cuanto antes', 'no prende',
  'no funciona', 'no enciende', 'se apagó', 'no hay luz', 'no hay agua',
]

export function detectUrgencia(text: string): Urgencia {
  const lower = text.toLowerCase()
  if (EMERGENCY_WORDS.some((w) => lower.includes(w))) return 'emergencia'
  if (URGENT_WORDS.some((w) => lower.includes(w))) return 'urgente'
  return 'normal'
}

const KEYWORD_TO_SERVICIO: Array<{ words: string[]; servicio: string }> = [
  { words: ['caño', 'tubería', 'tuberia', 'fuga', 'agua', 'inodoro', 'baño', 'desagüe', 'desague', 'atoro'], servicio: 'Gasfitería' },
  { words: ['luz', 'corriente', 'electr', 'enchufe', 'tablero', 'cortocircuito', 'cable', 'chispa'], servicio: 'Electricidad' },
  { words: ['puerta', 'chapa', 'cerradura', 'llave', 'candado', 'trabada'], servicio: 'Cerrajería' },
  { words: ['gas', 'balón', 'balon'], servicio: 'Conexión de gas' },
  { words: ['pintar', 'pintura', 'pared'], servicio: 'Pintura' },
  { words: ['limpia', 'limpieza', 'sucio'], servicio: 'Limpieza' },
  { words: ['mueble', 'madera', 'closet', 'repostero'], servicio: 'Carpintería' },
  { words: ['aire', 'ac', 'frío', 'frio', 'calor', 'climatiza'], servicio: 'Aire acondicionado' },
  { words: ['lava', 'lavadora'], servicio: 'Reparación de lavadoras' },
  { words: ['refrigerad', 'nevera', 'congelador'], servicio: 'Reparación de refrigeradoras' },
  { words: ['terma', 'agua caliente'], servicio: 'Instalación de termas' },
  { words: ['wifi', 'internet', 'red'], servicio: 'Redes y WiFi' },
  { words: ['cámara', 'camara', 'seguridad'], servicio: 'Instalación de cámaras' },
  { words: ['pc', 'laptop', 'computadora'], servicio: 'Técnico PC y laptops' },
  { words: ['celular', 'teléfono', 'telefono'], servicio: 'Reparación de celulares' },
  { words: ['jardín', 'jardin', 'grass', 'árbol', 'arbol'], servicio: 'Jardinería' },
  { words: ['mudanza', 'flete'], servicio: 'Mudanzas' },
  { words: ['uña', 'uñas', 'manicure'], servicio: 'Manicure clásico' },
  { words: ['maquillaje'], servicio: 'Maquillaje profesional' },
  { words: ['corte', 'cabello', 'pelo'], servicio: 'Corte de cabello' },
  { words: ['mascota', 'perro', 'gato'], servicio: 'Baño y peluquería canina' },
]

export function detectServicio(text: string): string | null {
  const lower = text.toLowerCase()
  // 1) Exact match in SERVICIOS list
  for (const s of SERVICIOS) {
    if (lower.includes(s.toLowerCase())) return s
  }
  // 2) Keyword-based match
  for (const { words, servicio } of KEYWORD_TO_SERVICIO) {
    if (words.some((w) => lower.includes(w))) return servicio
  }
  return null
}

export function suggestServicios(text: string, limit = 6): string[] {
  if (!text.trim()) return []
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const s of SERVICIOS) {
    if (s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())) {
      hits.push(s)
      if (hits.length >= limit) break
    }
  }
  return hits
}

// Precios sugeridos en S/ por servicio. Sincronizado con PRICE_RANGES de la
// web (src/lib/constants/pricing.ts) — la web es la fuente de verdad y
// estos rangos se muestran al cliente como referencia, no como contrato.
export const PRECIOS_SUGERIDOS: Record<string, { min: number; max: number; unidad?: string }> = {
  'Gasfitería': { min: 60, max: 150 },
  'Plomería': { min: 60, max: 150 },
  'Desatoros': { min: 80, max: 200 },
  'Instalación de termas': { min: 150, max: 350 },
  'Reparación de fugas': { min: 60, max: 180 },
  'Cambio de griferías': { min: 40, max: 120 },
  'Instalación de inodoro': { min: 100, max: 250 },
  'Electricidad': { min: 60, max: 180 },
  'Tableros eléctricos': { min: 120, max: 300 },
  'Cortocircuitos': { min: 80, max: 200 },
  'Instalación de luminarias': { min: 30, max: 90, unidad: 'punto' },
  'Pintura': { min: 200, max: 600 },
  'Pintura interior': { min: 200, max: 600 },
  'Pintura exterior': { min: 300, max: 900 },
  'Cerrajería': { min: 40, max: 120 },
  'Cambio de chapas': { min: 60, max: 250 },
  'Apertura de puertas': { min: 80, max: 250 },
  'Aire acondicionado': { min: 80, max: 250 },
  'Mantenimiento AC': { min: 80, max: 180 },
  'Instalación de AC': { min: 250, max: 600 },
  'Limpieza': { min: 50, max: 120 },
  'Limpieza profunda': { min: 150, max: 400 },
  'Limpieza post-obra': { min: 200, max: 600 },
  'Fumigación': { min: 80, max: 200 },
  'Carpintería': { min: 80, max: 250 },
  'Muebles a medida': { min: 300, max: 2000 },
  'Reparación de lavadoras': { min: 50, max: 150 },
  'Reparación de cocinas': { min: 80, max: 250 },
  'Reparación de refrigeradoras': { min: 60, max: 180 },
  'Redes y WiFi': { min: 80, max: 250 },
  'Instalación de cámaras': { min: 120, max: 400, unidad: 'cámara' },
  'Técnico PC y laptops': { min: 60, max: 200 },
  'Reparación de celulares': { min: 40, max: 350 },
  'Mudanzas': { min: 150, max: 800 },
  'Manicure clásico': { min: 30, max: 50 },
  'Manicure en gel': { min: 50, max: 80 },
  'Maquillaje profesional': { min: 80, max: 200 },
  'Corte de cabello': { min: 20, max: 60 },
}

export function getPrecioSugerido(servicio: string): { min: number; max: number; unidad?: string } | null {
  return PRECIOS_SUGERIDOS[servicio] || null
}

export function formatPrecio(precio: { min: number; max: number; unidad?: string }): string {
  const base = `S/ ${precio.min}–${precio.max}`
  return precio.unidad ? `${base} / ${precio.unidad}` : base
}
