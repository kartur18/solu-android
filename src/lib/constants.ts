export const COLORS = {
  pri: '#F26B21',
  priLight: '#FFF3EC',
  acc: '#10B981',
  dark: '#1A1A2E',
  gray: '#6B7280',
  gray2: '#9CA3AF',
  border: '#E8E4DF',
  light: '#FAF8F5',
  white: '#FFFFFE',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
}

export const SERVICIOS = [
  'Gasfitería', 'Electricidad', 'Pintura', 'Cerrajería',
  'Refrigeración', 'Albañilería', 'Carpintería', 'Limpieza',
  'Fumigación', 'Instalaciones', 'Electrodomésticos', 'Techado',
  'Vidriería', 'Soldadura', 'Jardinería', 'Mudanzas',
  'Seguridad (cámaras)', 'Redes y WiFi',
]

// Mapeo de servicios a oficios para mejorar búsqueda
export const SERVICIO_TO_OFICIO: Record<string, string[]> = {
  'Gasfitería': ['Gasfitero'],
  'Electricidad': ['Electricista'],
  'Pintura': ['Pintor'],
  'Cerrajería': ['Cerrajero'],
  'Refrigeración': ['Técnico en refrigeración', 'Técnico AC / Refrigeración'],
  'Albañilería': ['Albañil', 'Maestro de obra'],
  'Carpintería': ['Carpintero'],
  'Limpieza': ['Limpieza profesional', 'Limpieza'],
  'Fumigación': ['Fumigador', 'Fumigación / Desinfección'],
  'Instalaciones': ['Instalador', 'Instalador de drywall', 'Instalador de pisos'],
  'Electrodomésticos': ['Técnico en electrodomésticos', 'Técnico en lavadoras', 'Técnico en cocinas/hornos'],
  'Techado': ['Techador'],
  'Vidriería': ['Vidriero'],
  'Soldadura': ['Soldador', 'Soldador / Fierrero'],
  'Jardinería': ['Jardinero'],
  'Mudanzas': ['Mudanzas', 'Mudanzas / Fletes'],
  'Seguridad (cámaras)': ['Técnico en seguridad', 'Instalador de cámaras'],
  'Redes y WiFi': ['Técnico en redes', 'Técnico en redes / WiFi', 'Técnico PC / Laptops'],
}

// Expandir búsqueda: dado un término, devuelve oficios relacionados
export function expandSearchToOficios(search: string): string[] {
  const lower = search.toLowerCase()
  const oficios: string[] = []
  for (const [servicio, related] of Object.entries(SERVICIO_TO_OFICIO)) {
    if (servicio.toLowerCase().includes(lower) || lower.includes(servicio.toLowerCase())) {
      oficios.push(...related)
    }
  }
  return oficios
}

export const DISTRITOS = [
  // Lima Moderna
  'Miraflores', 'San Isidro', 'Santiago de Surco', 'San Borja', 'La Molina',
  'Barranco', 'Surquillo', 'Magdalena del Mar', 'Pueblo Libre',
  // Lima Centro
  'Lima Cercado', 'Jesús María', 'Lince', 'San Miguel', 'Breña', 'La Victoria', 'Rímac',
  // Lima Norte
  'Los Olivos', 'San Martín de Porres', 'Comas', 'Independencia',
  'Carabayllo', 'Puente Piedra',
  // Lima Este
  'San Juan de Lurigancho', 'Ate', 'Santa Anita', 'El Agustino', 'Chaclacayo',
  // Lima Sur
  'San Juan de Miraflores', 'Villa El Salvador', 'Villa María del Triunfo',
  'Chorrillos', 'Lurín',
  // Callao
  'Callao', 'Bellavista', 'La Perla', 'Ventanilla',
  // Provincias
  'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco',
  'Huancayo', 'Iquitos', 'Tacna', 'Ica', 'Cajamarca',
]

export const URGENCIAS = [
  { value: 'normal', label: 'Normal', color: COLORS.green },
  { value: 'urgente', label: 'Urgente', color: COLORS.yellow },
  { value: 'emergencia', label: 'Emergencia', color: COLORS.red },
]

export const LEVELS = [
  { name: 'Bronce', emoji: '🥉', min: 0, color: '#CD7F32' },
  { name: 'Plata', emoji: '🥈', min: 10, color: '#C0C0C0' },
  { name: 'Oro', emoji: '🥇', min: 50, color: '#FFD700' },
  { name: 'Diamante', emoji: '💎', min: 100, color: '#6366F1' },
]

export function getTechLevel(servicios: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (servicios >= LEVELS[i].min) return LEVELS[i]
  }
  return LEVELS[0]
}

export function getTechLevelProgress(servicios: number) {
  const current = getTechLevel(servicios)
  const currentIdx = LEVELS.indexOf(current)
  if (currentIdx >= LEVELS.length - 1) return 1
  const next = LEVELS[currentIdx + 1]
  return (servicios - current.min) / (next.min - current.min)
}

export const ACHIEVEMENTS = [
  { id: 'first', emoji: '🎉', name: 'Primera chamba', desc: 'Completaste tu primer servicio', check: (t: any) => t.servicios_completados >= 1 },
  { id: 'streak', emoji: '🔥', name: 'En racha', desc: '5 servicios completados', check: (t: any) => t.servicios_completados >= 5 },
  { id: 'unstoppable', emoji: '⚡', name: 'Imparable', desc: '10 servicios completados', check: (t: any) => t.servicios_completados >= 10 },
  { id: 'master', emoji: '👑', name: 'Maestro', desc: '50 servicios completados', check: (t: any) => t.servicios_completados >= 50 },
  { id: 'verified', emoji: '✅', name: 'Verificado', desc: 'DNI verificado', check: (t: any) => t.verificado },
  { id: 'fivestar', emoji: '⭐', name: 'Cinco estrellas', desc: 'Calificación perfecta', check: (t: any) => t.calificacion >= 5.0 },
  { id: 'popular', emoji: '💬', name: 'Popular', desc: '10+ reseñas', check: (t: any) => t.num_resenas >= 10 },
  { id: 'pro', emoji: '🏆', name: 'Profesional', desc: 'Plan de pago activo', check: (t: any) => t.plan !== 'trial' },
]

export const PLAN_FEATURES = {
  trial: { name: 'Gratuito', price: 0, culqiLink: '', features: ['Perfil básico', '1 zona', '1 foto', 'WhatsApp'] },
  profesional: { name: 'Profesional', price: 49, culqiLink: 'https://express.culqi.com/pago/665378042F', features: ['Badge verificado', '3 zonas', '3 fotos', 'Estadísticas', 'Soporte WhatsApp'] },
  premium: { name: 'Premium', price: 79, culqiLink: 'https://express.culqi.com/pago/FFEC22C71A', features: ['Badge PRO', '5 zonas', '5 fotos + galería', 'Prioridad alta', 'Sección "Recomendados"', 'Soporte prioritario'] },
  elite: { name: 'Elite', price: 99, culqiLink: 'https://express.culqi.com/pago/80O22AAFF4', features: ['Badge ELITE', 'Zonas ilimitadas', '10 fotos + galería', 'Siempre top 5', 'Certificado digital', 'Promociones ilimitadas'] },
}

export function waLink(phone: string, msg: string): string {
  const clean = phone.replace(/\D/g, '')
  const full = clean.length === 9 ? '51' + clean : clean
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}
