export const COLORS = {
  pri: '#F26B21',
  priLight: '#FFF3EC',
  acc: '#10B981',
  dark: '#1A1A2E',
  gray: '#6B7280',
  gray2: '#9CA3AF',
  border: '#E5E7EB',
  light: '#F9FAFB',
  white: '#FFFFFF',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  blue: '#3B82F6',
}

export const SERVICIOS = [
  'Gasfitería', 'Electricidad', 'Pintura', 'Cerrajería',
  'Refrigeración', 'Albañilería', 'Carpintería', 'Limpieza',
  'Fumigación', 'Instalaciones', 'Electrodomésticos', 'Techado',
  'Vidriería', 'Soldadura', 'Jardinería', 'Mudanzas',
  'Seguridad (cámaras)', 'Redes y WiFi',
]

export const DISTRITOS = [
  'Miraflores', 'San Isidro', 'Surco', 'San Borja', 'La Molina',
  'Jesús María', 'Lince', 'Pueblo Libre', 'Magdalena', 'San Miguel',
  'Breña', 'Cercado de Lima', 'Ate', 'Santa Anita', 'Los Olivos',
  'San Martín de Porres', 'Comas', 'Independencia', 'Chorrillos',
  'Barranco', 'Villa El Salvador', 'San Juan de Lurigancho',
  'Callao', 'Bellavista', 'La Perla',
  'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco',
]

export const URGENCIAS = [
  { value: 'normal', label: 'Normal', color: COLORS.green },
  { value: 'urgente', label: 'Urgente', color: COLORS.yellow },
  { value: 'emergencia', label: 'Emergencia', color: COLORS.red },
]

export function waLink(phone: string, msg: string): string {
  const clean = phone.replace(/\D/g, '')
  const full = clean.length === 9 ? '51' + clean : clean
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}
