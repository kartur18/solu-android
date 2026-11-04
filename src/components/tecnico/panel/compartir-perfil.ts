// Textos de "Comparte tu perfil": solo dicen "verificado" si el técnico lo
// está. Antes lo afirmaban siempre, también de quien ni subió su DNI (4-nov).

import type { Tecnico } from '../../../lib/types'

type DatosCompartir = Pick<Tecnico, 'id' | 'nombre' | 'oficio' | 'verificado'>
type DatosTarjeta = DatosCompartir & Pick<Tecnico, 'distrito' | 'precio_desde' | 'calificacion' | 'whatsapp'>

function oficioConSello(t: DatosCompartir): string {
  return t.verificado === true ? `${t.oficio} verificado en SOLU` : `${t.oficio} en SOLU`
}

export function mensajeCompartirPerfil(t: DatosCompartir): string {
  return `Soy ${t.nombre}, ${oficioConSello(t)}. Mira mi perfil: https://www.solu.pe/tecnico/${t.id}`
}

export function mensajeTarjetaDigital(t: DatosTarjeta): string {
  return `🔧 ${t.nombre}\n${oficioConSello(t)}\n\n📍 ${t.distrito}\n💰 Desde S/${t.precio_desde || '—'}\n⭐ ${t.calificacion?.toFixed(1) || '0.0'} estrellas\n📱 ${t.whatsapp}\n\n👉 Ver perfil: https://www.solu.pe/tecnico/${t.id}`
}
