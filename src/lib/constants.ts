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
  // Gasfitería y plomería
  'Gasfitería', 'Plomería', 'Desatoros', 'Instalación de termas',
  'Reparación de fugas', 'Instalación de tanque de agua', 'Instalación de bomba de agua',
  'Cambio de griferías', 'Instalación de inodoro', 'Conexión de gas',
  // Electricidad
  'Electricidad', 'Tableros eléctricos', 'Cortocircuitos', 'Instalación de luminarias',
  'Cableado eléctrico', 'Pozo a tierra', 'Portero eléctrico',
  // Pintura
  'Pintura', 'Pintura interior', 'Pintura exterior', 'Pintura de fachada',
  'Empastado y lijado', 'Pintura automotriz',
  // Cerrajería
  'Cerrajería', 'Cambio de chapas', 'Apertura de puertas', 'Cerraduras de seguridad',
  // Refrigeración y AC
  'Refrigeración', 'Aire acondicionado', 'Instalación de AC', 'Mantenimiento AC',
  'Reparación de refrigeradoras', 'Cámaras frigoríficas',
  // Albañilería y construcción
  'Albañilería', 'Remodelación', 'Drywall', 'Cielo raso', 'Techado',
  'Enchapado', 'Pisos y enchapes', 'Pisos laminados', 'Impermeabilización',
  'Demolición', 'Acabados',
  // Carpintería
  'Carpintería', 'Muebles a medida', 'Closets y reposteros', 'Instalación de melamina',
  'Puertas y portones', 'Restauración de muebles', 'Ebanistería',
  // Limpieza
  'Limpieza', 'Limpieza profunda', 'Limpieza de oficinas', 'Limpieza post-obra',
  'Fumigación', 'Desinfección', 'Limpieza de tanque de agua', 'Limpieza de cisternas',
  // Electrodomésticos
  'Electrodomésticos', 'Reparación de lavadoras', 'Reparación de cocinas',
  'Reparación de microondas', 'Reparación de terma eléctrica', 'Reparación de secadoras',
  // Herrería y soldadura
  'Herrería', 'Soldadura', 'Rejas y barandas', 'Estructuras metálicas',
  'Puertas de fierro', 'Escaleras metálicas',
  // Vidriería
  'Vidriería', 'Ventanas de aluminio', 'Mamparas', 'Espejos',
  'Puertas de vidrio', 'Vitrinas',
  // Jardinería y exteriores
  'Jardinería', 'Poda de árboles', 'Instalación de grass', 'Paisajismo',
  'Riego tecnificado', 'Mantenimiento de jardines',
  // Tecnología
  'Redes y WiFi', 'Instalación de cámaras', 'Seguridad (cámaras)',
  'Técnico PC y laptops', 'Instalación de TV', 'Domótica',
  'Instalación de alarmas', 'Intercomunicadores',
  // Mudanzas
  'Mudanzas', 'Fletes', 'Montaje de muebles', 'Embalaje',
  // Instalaciones especializadas
  'Energía solar', 'Gas (instalación)', 'Ascensores', 'Piscinas',
  'Automatización', 'Cortinas y persianas',
  // Tapicería y textiles
  'Tapicería', 'Retapizado de muebles', 'Lavado de muebles', 'Lavado de alfombras',
  // Electrónica
  'Electrónica', 'Reparación de celulares', 'Reparación de tablets',
  // Otros
  'Mecánica automotriz', 'Electricidad automotriz', 'Planchado y pintura vehicular',
  'Confección y costura', 'Zapatería', 'Relojería',
]

// Mapeo de servicios a oficios para mejorar búsqueda (100+ oficios)
export const SERVICIO_TO_OFICIO: Record<string, string[]> = {
  'Gasfitería': ['Gasfitero', 'Plomero'],
  'Plomería': ['Plomero', 'Gasfitero'],
  'Desatoros': ['Desatorador', 'Gasfitero', 'Plomero'],
  'Instalación de termas': ['Gasfitero', 'Técnico en termas'],
  'Reparación de fugas': ['Gasfitero', 'Plomero'],
  'Instalación de tanque de agua': ['Gasfitero'],
  'Instalación de bomba de agua': ['Gasfitero', 'Electricista'],
  'Cambio de griferías': ['Gasfitero', 'Plomero'],
  'Instalación de inodoro': ['Gasfitero'],
  'Conexión de gas': ['Gasista certificado', 'Instalador de gas'],
  'Electricidad': ['Electricista'],
  'Tableros eléctricos': ['Electricista', 'Técnico electricista'],
  'Cortocircuitos': ['Electricista'],
  'Instalación de luminarias': ['Electricista'],
  'Cableado eléctrico': ['Electricista'],
  'Pozo a tierra': ['Electricista', 'Técnico en pozo a tierra'],
  'Portero eléctrico': ['Electricista', 'Técnico en intercomunicadores'],
  'Pintura': ['Pintor'],
  'Pintura interior': ['Pintor'],
  'Pintura exterior': ['Pintor'],
  'Pintura de fachada': ['Pintor', 'Pintor de fachadas'],
  'Empastado y lijado': ['Pintor', 'Empastador'],
  'Pintura automotriz': ['Pintor automotriz', 'Técnico en pintura vehicular'],
  'Cerrajería': ['Cerrajero'],
  'Cambio de chapas': ['Cerrajero'],
  'Apertura de puertas': ['Cerrajero'],
  'Cerraduras de seguridad': ['Cerrajero'],
  'Refrigeración': ['Técnico en refrigeración', 'Técnico AC / Refrigeración'],
  'Aire acondicionado': ['Técnico AC', 'Instalador de aire acondicionado'],
  'Instalación de AC': ['Técnico AC', 'Instalador de aire acondicionado'],
  'Mantenimiento AC': ['Técnico AC'],
  'Reparación de refrigeradoras': ['Técnico en refrigeración'],
  'Cámaras frigoríficas': ['Técnico en refrigeración industrial'],
  'Albañilería': ['Albañil', 'Maestro de obra'],
  'Remodelación': ['Albañil', 'Maestro de obra', 'Contratista'],
  'Drywall': ['Instalador de drywall', 'Drywallero'],
  'Cielo raso': ['Instalador de cielo raso'],
  'Techado': ['Techador', 'Albañil'],
  'Enchapado': ['Enchapador', 'Mayoliquero', 'Porcelanista'],
  'Pisos y enchapes': ['Enchapador', 'Instalador de pisos', 'Porcelanista'],
  'Pisos laminados': ['Instalador de pisos'],
  'Impermeabilización': ['Impermeabilizador'],
  'Demolición': ['Albañil', 'Maestro de obra'],
  'Acabados': ['Albañil', 'Pintor', 'Enchapador'],
  'Carpintería': ['Carpintero'],
  'Muebles a medida': ['Carpintero', 'Ebanista', 'Mueblero'],
  'Closets y reposteros': ['Carpintero', 'Melaminero'],
  'Instalación de melamina': ['Melaminero', 'Carpintero'],
  'Puertas y portones': ['Carpintero', 'Herrero', 'Instalador de puertas'],
  'Restauración de muebles': ['Restaurador', 'Carpintero'],
  'Ebanistería': ['Ebanista', 'Carpintero'],
  'Limpieza': ['Limpieza profesional', 'Personal de limpieza'],
  'Limpieza profunda': ['Limpieza profesional'],
  'Limpieza de oficinas': ['Limpieza profesional'],
  'Limpieza post-obra': ['Limpieza profesional'],
  'Fumigación': ['Fumigador', 'Fumigación / Desinfección'],
  'Desinfección': ['Fumigador', 'Desinfectador'],
  'Limpieza de tanque de agua': ['Técnico en limpieza de tanques'],
  'Limpieza de cisternas': ['Técnico en limpieza de cisternas'],
  'Electrodomésticos': ['Técnico en electrodomésticos'],
  'Reparación de lavadoras': ['Técnico en lavadoras'],
  'Reparación de cocinas': ['Técnico en cocinas/hornos'],
  'Reparación de microondas': ['Técnico en microondas'],
  'Reparación de terma eléctrica': ['Técnico en termas', 'Electricista'],
  'Reparación de secadoras': ['Técnico en secadoras'],
  'Herrería': ['Herrero', 'Fierrero'],
  'Soldadura': ['Soldador', 'Soldador / Fierrero'],
  'Rejas y barandas': ['Herrero', 'Soldador'],
  'Estructuras metálicas': ['Soldador', 'Fierrero'],
  'Puertas de fierro': ['Herrero'],
  'Escaleras metálicas': ['Herrero', 'Soldador'],
  'Vidriería': ['Vidriero'],
  'Ventanas de aluminio': ['Vidriero', 'Instalador de aluminio'],
  'Mamparas': ['Vidriero'],
  'Espejos': ['Vidriero'],
  'Puertas de vidrio': ['Vidriero'],
  'Vitrinas': ['Vidriero', 'Carpintero'],
  'Jardinería': ['Jardinero'],
  'Poda de árboles': ['Jardinero', 'Podador'],
  'Instalación de grass': ['Jardinero'],
  'Paisajismo': ['Paisajista', 'Jardinero'],
  'Riego tecnificado': ['Técnico en riego'],
  'Mantenimiento de jardines': ['Jardinero'],
  'Redes y WiFi': ['Técnico en redes', 'Técnico en redes / WiFi'],
  'Instalación de cámaras': ['Instalador de cámaras', 'Técnico en seguridad'],
  'Seguridad (cámaras)': ['Técnico en seguridad', 'Instalador de cámaras'],
  'Técnico PC y laptops': ['Técnico PC / Laptops', 'Técnico en computadoras'],
  'Instalación de TV': ['Técnico en TV', 'Instalador de TV'],
  'Domótica': ['Técnico en domótica', 'Instalador de automatización'],
  'Instalación de alarmas': ['Técnico en alarmas', 'Técnico en seguridad'],
  'Intercomunicadores': ['Técnico en intercomunicadores', 'Electricista'],
  'Mudanzas': ['Mudanzas', 'Mudanzas / Fletes'],
  'Fletes': ['Fletero', 'Transporte de carga'],
  'Montaje de muebles': ['Armador de muebles', 'Carpintero'],
  'Embalaje': ['Servicio de embalaje'],
  'Energía solar': ['Instalador de paneles solares', 'Técnico solar'],
  'Gas (instalación)': ['Instalador de gas', 'Gasista certificado'],
  'Ascensores': ['Técnico en ascensores'],
  'Piscinas': ['Técnico en piscinas', 'Mantenimiento de piscinas'],
  'Automatización': ['Técnico en domótica'],
  'Cortinas y persianas': ['Instalador de cortinas', 'Instalador de persianas'],
  'Tapicería': ['Tapicero', 'Retapizador'],
  'Retapizado de muebles': ['Tapicero', 'Retapizador'],
  'Lavado de muebles': ['Lavador de muebles', 'Limpieza profesional'],
  'Lavado de alfombras': ['Lavador de alfombras', 'Limpieza profesional'],
  'Electrónica': ['Técnico electrónico', 'Reparador de equipos'],
  'Reparación de celulares': ['Técnico en celulares'],
  'Reparación de tablets': ['Técnico en tablets', 'Técnico en celulares'],
  'Mecánica automotriz': ['Mecánico automotriz', 'Mecánico'],
  'Electricidad automotriz': ['Electricista automotriz'],
  'Planchado y pintura vehicular': ['Planchador', 'Pintor automotriz'],
  'Confección y costura': ['Costurera', 'Modista', 'Sastre'],
  'Zapatería': ['Zapatero'],
  'Relojería': ['Relojero'],
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
  'Jesús María', 'Lince', 'San Miguel',
  // Lima Centro
  'Lima Cercado', 'Breña', 'La Victoria', 'Rímac', 'El Agustino', 'San Luis',
  // Lima Norte
  'Los Olivos', 'San Martín de Porres', 'Comas', 'Independencia',
  'Carabayllo', 'Puente Piedra', 'Ancón', 'Santa Rosa',
  // Lima Este
  'San Juan de Lurigancho', 'Ate', 'Santa Anita', 'Chaclacayo',
  'Lurigancho-Chosica', 'Cieneguilla',
  // Lima Sur
  'San Juan de Miraflores', 'Villa El Salvador', 'Villa María del Triunfo',
  'Chorrillos', 'Lurín', 'Pachacámac', 'Punta Hermosa', 'Punta Negra',
  'San Bartolo', 'Santa María del Mar', 'Pucusana',
  // Callao
  'Callao', 'Bellavista', 'La Perla', 'Ventanilla',
  'Carmen de la Legua', 'La Punta', 'Mi Perú',
  // Provincias de Lima
  'Huaral', 'Cañete', 'Huarochirí', 'Barranca', 'Canta',
  'Cajatambo', 'Oyón', 'Yauyos',
  // Norte del Perú
  'Tumbes', 'Piura', 'Sullana', 'Talara', 'Paita',
  'Chiclayo', 'Lambayeque', 'Ferreñafe',
  'Trujillo', 'Chimbote', 'Huaraz',
  'Cajamarca', 'Jaén', 'Chachapoyas', 'Moyobamba', 'Tarapoto',
  // Centro del Perú
  'Huancayo', 'Huánuco', 'Cerro de Pasco', 'Tarma', 'La Oroya',
  'Huancavelica', 'Ayacucho',
  'Ica', 'Chincha', 'Pisco', 'Nazca',
  // Sur del Perú
  'Arequipa', 'Mollendo', 'Camaná', 'Tacna', 'Moquegua', 'Ilo',
  'Cusco', 'Juliaca', 'Puno', 'Abancay', 'Puerto Maldonado',
  // Selva del Perú
  'Iquitos', 'Pucallpa', 'Tingo María', 'Yurimaguas', 'Bagua',
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
