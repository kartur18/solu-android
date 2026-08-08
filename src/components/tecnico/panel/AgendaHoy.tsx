// "Agenda de hoy" del panel del técnico.
//
// Fuente principal: las citas reales que devuelve /api/tecnico/dashboard
// (campo `citas`/`agenda`, próximos 7 días). Los leads activos quedan como
// sección secundaria "Trabajos sin cita". Si el server aún no manda citas
// (deploy viejo), se cae al comportamiento anterior basado en leads.
//
// "Hoy" se calcula en hora de Lima: con toISOString() crudo, desde las ~7pm
// la agenda mostraba el día siguiente.

import { Linking, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fechaLima, hoyLima } from '../../../lib/fechas-lima'
import type { CitaAgenda } from '../../../lib/tech-profile'
import type { Cliente } from '../../../lib/types'
import { THEME } from '../../../lib/theme'

const ESTADOS_LEAD_ACTIVO = ['Asignado', 'En camino', 'En proceso']

// Postgres manda horas HH:MM:SS; al técnico le alcanza HH:MM.
function hora(h: string | null | undefined): string {
  return (h || '').slice(0, 5)
}

function colorLead(estado: string): string {
  if (estado === 'En proceso') return THEME.color.brand
  if (estado === 'En camino') return THEME.color.platino
  return THEME.color.info
}

export function AgendaHoy({
  citas,
  calendarUrl,
  leads,
}: {
  // null = el server todavía no manda el campo (no confundir con "sin citas")
  citas: CitaAgenda[] | null
  calendarUrl: string | null
  leads: Cliente[]
}) {
  const hoy = hoyLima()
  const conCitas = citas !== null
  const citasHoy = (citas ?? [])
    .filter((c) => c.fecha === hoy && c.estado !== 'cancelada')
    .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
  const leadsActivos = leads.filter((l) => ESTADOS_LEAD_ACTIVO.includes(l.estado))
  // Fallback server viejo: mismos leads de siempre, con "hoy" corregido a Lima.
  const leadsDeHoy = leadsActivos.filter((l) => fechaLima(l.created_at) === hoy)

  const vacia = conCitas ? citasHoy.length === 0 && leadsActivos.length === 0 : leadsDeHoy.length === 0

  return (
    <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
        <Ionicons name="calendar" size={18} color={THEME.color.info} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, flex: 1 }}>Agenda de hoy</Text>
        {/* Solo con la URL firmada del server: la vieja sin token daba 401
            (botón vivo de una feature muerta = desconfianza). */}
        {calendarUrl ? (
          <TouchableOpacity
            onPress={() => { void Linking.openURL(calendarUrl) }}
            accessibilityLabel="Sincronizar mi agenda con mi calendario"
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="calendar-outline" size={14} color={THEME.color.info} />
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>Sincronizar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {vacia && (
        <View style={{ alignItems: 'center', paddingVertical: THEME.space.lg }}>
          <Ionicons name="checkmark-circle-outline" size={32} color={THEME.color.success} />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '600', color: THEME.color.ink, marginTop: THEME.space.sm }}>Sin citas para hoy</Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Tu agenda está libre</Text>
        </View>
      )}

      {conCitas && citasHoy.map((c, i) => {
        const nombre = c.cliente_nombre || c.cliente || 'Cliente'
        const confirmada = c.estado === 'confirmada'
        return (
          <View
            key={c.id ?? `${c.fecha}-${c.hora_inicio}-${i}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: THEME.space.md, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: confirmada ? THEME.color.success : THEME.color.info }}
          >
            <View style={{ backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 6, minWidth: 52, alignItems: 'center' }}>
              <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.info }}>{hora(c.hora_inicio) || '—'}</Text>
              {hora(c.hora_fin) ? (
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>{hora(c.hora_fin)}</Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>{nombre}</Text>
              {c.servicio ? (
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{c.servicio}</Text>
              ) : null}
            </View>
            {c.estado ? (
              <View style={{ backgroundColor: confirmada ? THEME.color.successBg : THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '700', color: confirmada ? THEME.color.success : THEME.color.info }}>
                  {confirmada ? 'Confirmada' : c.estado}
                </Text>
              </View>
            ) : null}
          </View>
        )
      })}

      {/* Leads activos: con citas del server son la sección secundaria; sin
          ellas (server viejo) son la agenda de siempre filtrada al día Lima. */}
      {(conCitas ? leadsActivos : leadsDeHoy).length > 0 && (
        <>
          {conCitas && (
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkMuted, marginTop: citasHoy.length > 0 ? THEME.space.sm : 0, marginBottom: 6 }}>
              Trabajos sin cita
            </Text>
          )}
          {(conCitas ? leadsActivos : leadsDeHoy).map((l) => (
            <View
              key={l.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: THEME.space.md, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: colorLead(l.estado) }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>{l.nombre}</Text>
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{l.servicio} · {l.distrito}</Text>
              </View>
              <View style={{ backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>{l.estado}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  )
}

export default AgendaHoy
