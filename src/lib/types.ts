export interface Tecnico {
  id: number
  nombre: string
  whatsapp: string
  email?: string
  dni: string
  oficio: string
  distrito: string
  plan: 'trial' | 'profesional' | 'premium' | 'elite' | 'pro'
  disponible: boolean
  verificado: boolean
  calificacion: number
  num_resenas: number
  servicios_completados: number
  precio_desde?: number
  experiencia?: string
  descripcion?: string
  foto_url?: string
  password_hash?: string
  push_token?: string
  fecha_vencimiento?: string
  lat?: number
  lng?: number
  galeria?: string[]
  zonas?: string[]
  created_at: string
}

export interface Cliente {
  id: number
  nombre: string
  whatsapp: string
  servicio: string
  distrito: string
  urgencia: string
  descripcion?: string
  codigo: string
  estado: string
  tecnico_asignado?: number
  created_at: string
}

export interface Resena {
  id: number
  tecnico_id: number
  nombre_cliente: string
  whatsapp_cliente: string
  calificacion: number
  comentario: string
  servicio: string
  codigo_servicio?: string
  created_at: string
}

export interface GrupoVecinos {
  id: number
  nombre: string
  direccion: string
  whatsapp_admin: string
  codigo: string
  miembros: number
  created_at: string
}

export interface Notificacion {
  id: number
  tecnico_id: number
  tipo: 'nueva_solicitud' | 'pago_recibido' | 'plan_vencimiento' | 'nueva_resena'
  titulo: string
  mensaje: string
  leido: boolean
  created_at: string
}

export interface Cotizacion {
  id: number
  cliente_id: number
  tecnico_id: number
  servicio: string
  descripcion: string
  monto: number
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  codigo_solicitud?: string
  cliente_nombre?: string
  cliente_whatsapp?: string
  created_at: string
}
