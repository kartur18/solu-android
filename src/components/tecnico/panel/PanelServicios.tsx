// Pestaña "Servicios" del panel del técnico: zona de trabajo, trabajos
// disponibles para aceptar, servicios activos e historial.

import { Share, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { useRouter } from 'expo-router'
import type { Cliente, Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { ZonaTrabajoCard } from '../../ZonaTrabajoCard'
import { ErrorDeCarga } from './ErrorDeCarga'
import { LeadRow } from './LeadRow'
import type { Aviso } from './ToastAviso'
import { timeAgo, type SolicitudAbierta } from './panel-utils'

export function PanelServicios({
  tech,
  leads,
  openRequests,
  dashError,
  acceptingId,
  authToken,
  router,
  onReload,
  onAceptar,
  onAviso,
}: {
  tech: Tecnico
  leads: Cliente[]
  openRequests: SolicitudAbierta[]
  dashError: boolean
  acceptingId: number | null
  authToken: string | null
  router: ReturnType<typeof useRouter>
  onReload: () => void
  onAceptar: (s: SolicitudAbierta) => void
  onAviso: (aviso: Aviso) => void
}) {
  const activos = leads.filter(l => l.estado !== 'Completado' && l.estado !== 'Calificado' && l.estado !== 'Cancelado')
  const completados = leads.filter(l => l.estado === 'Completado' || l.estado === 'Calificado')

  return (
    <View style={{ gap: THEME.space.md }}>
      {/* Zona de trabajo: define QUÉ trabajos ve abajo. Va primero
          porque si el técnico se movió de distrito, avisarlo es lo
          que tiene que hacer antes que nada. */}
      <ZonaTrabajoCard token={authToken} />

      {/* Trabajos disponibles — solicitudes abiertas para aceptar */}
      {openRequests.length > 0 && (
        <View style={{ backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, padding: THEME.space.lg, borderWidth: 2, borderColor: THEME.color.success }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: 4 }}>
            <Ionicons name="flash" size={16} color={THEME.color.success} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Trabajos disponibles</Text>
            <View style={{ backgroundColor: THEME.color.success, borderRadius: 10, paddingHorizontal: THEME.space.sm, paddingVertical: 2 }}>
              <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.white }}>{openRequests.length}</Text>
            </View>
          </View>
          <Text style={{ ...THEME.font.caption, color: '#065F46', marginBottom: THEME.space.md }}>Acepta rápido — el primero se lo queda</Text>
          {openRequests.map((s) => (
            <View key={s.id} style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.md, padding: 14, marginBottom: THEME.space.sm, borderWidth: 1, borderColor: '#D1FAE5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: THEME.space.sm, marginBottom: THEME.space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.success }}>{s.cliente_nombre?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...THEME.font.body, fontWeight: '800', color: THEME.color.ink }} numberOfLines={1}>{s.servicio}</Text>
                    <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, marginTop: 1 }} numberOfLines={1}>
                      📍 {s.distrito}{s.distancia_label ? ` · ${s.distancia_label}` : ''} · {timeAgo(s.created_at) === 'ahora' ? 'recién' : `hace ${timeAgo(s.created_at)}`}
                    </Text>
                  </View>
                </View>
                {/* Emergencia y urgente pagan distinto y se atienden
                    distinto: mostrarlos igual borraba la diferencia. */}
                {(s.urgencia === 'emergencia' || s.urgencia === 'urgente') && (
                  <View style={{
                    backgroundColor: s.urgencia === 'emergencia' ? THEME.color.dangerBg : THEME.color.warningBg,
                    borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4,
                  }}>
                    <Text style={{ ...THEME.font.caption, fontWeight: '800', color: s.urgencia === 'emergencia' ? THEME.color.danger : '#B45309' }}>
                      {s.urgencia === 'emergencia' ? 'EMERGENCIA' : 'URGENTE'}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                disabled={acceptingId === s.id}
                // Antes de cobrar, decirle cuánto cuesta: aceptar
                // descuenta entre 160 y 10.000 coins según categoría,
                // distrito y urgencia.
                onPress={() => onAceptar(s)}
                accessibilityLabel={`Aceptar el trabajo de ${s.servicio} en ${s.distrito}`}
                style={{ backgroundColor: THEME.color.success, borderRadius: THEME.radius.md, minHeight: 48, paddingHorizontal: THEME.space.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: acceptingId === s.id ? 0.5 : 1 }}
              >
                <Ionicons name="checkmark-circle" size={18} color={THEME.color.white} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.white }}>
                  {acceptingId === s.id ? 'Aceptando...' : 'Aceptar trabajo'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Empty state: sin trabajos disponibles (solo si el panel cargó) */}
      {openRequests.length === 0 && dashError && (
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.xl, borderWidth: 1, borderColor: THEME.color.line }}>
          <ErrorDeCarga titulo="No pudimos cargar los trabajos disponibles" onRetry={onReload} />
        </View>
      )}
      {openRequests.length === 0 && !dashError && (
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.xl, alignItems: 'center', borderWidth: 1, borderColor: THEME.color.line }}>
          <Text style={{ fontSize: 32 }}>🔎</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginTop: THEME.space.sm }}>No hay trabajos en tu zona ahora</Text>
          <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, textAlign: 'center', marginTop: 4, lineHeight: 17 }}>
            Te avisamos apenas entre una solicitud de tu oficio cerca de ti. Si te moviste de distrito, actualiza tu zona de trabajo aquí arriba.
          </Text>
          <TouchableOpacity
            onPress={() => Share.share({ message: `Soy ${tech.nombre}, ${tech.oficio} verificado en SOLU. Mira mi perfil: https://www.solu.pe/tecnico/${tech.id}` })}
            accessibilityLabel="Compartir mi perfil"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.md, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, minHeight: 44, marginTop: THEME.space.md }}
          >
            <Ionicons name="share-social-outline" size={16} color={THEME.color.info} />
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.info }}>Compartir mi perfil</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: 4 }}>Servicios activos</Text>
        <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginBottom: 10 }}>Solicitudes pendientes y en proceso</Text>
        {activos.length === 0 ? (
          dashError ? (
            <ErrorDeCarga titulo="No pudimos cargar tus servicios activos" onRetry={onReload} />
          ) : (
          <View style={{ alignItems: 'center', paddingVertical: THEME.space.xl }}>
            <Ionicons name="briefcase-outline" size={32} color={THEME.color.inkMuted} />
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.sm }}>No tienes servicios activos</Text>
            <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center' }}>Cuando aceptes un trabajo aparecerá aquí</Text>
          </View>
          )
        ) : (
          activos.map((l) => (
            <LeadRow key={l.id} lead={l} onStatusChange={onReload} tech={tech} router={router} onAviso={onAviso} />
          ))
        )}
      </View>

      {/* History */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: 4 }}>Historial</Text>
        <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginBottom: 10 }}>Servicios completados</Text>
        {completados.length === 0 ? (
          dashError ? (
            <ErrorDeCarga titulo="No pudimos cargar tu historial" onRetry={onReload} />
          ) : (
          <View style={{ alignItems: 'center', paddingVertical: THEME.space.xl }}>
            <Ionicons name="time-outline" size={32} color={THEME.color.inkMuted} />
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.sm }}>Sin historial aún</Text>
            <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center' }}>Tus trabajos completados aparecerán aquí</Text>
          </View>
          )
        ) : (
          completados.map((l) => (
            <LeadRow key={l.id} lead={l} tech={tech} router={router} onAviso={onAviso} />
          ))
        )}
      </View>
    </View>
  )
}

export default PanelServicios
