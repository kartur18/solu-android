// Card de un lead/servicio del técnico con sus acciones de estado.
// Se usa en las pestañas Inicio y Servicios del panel (cuenta.tsx).

import { useState } from 'react'
import { ActivityIndicator, Alert, Linking, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { useRouter } from 'expo-router'
import { ENV, fetchWithTimeout } from '../../../lib/env'
import { getTechToken } from '../../../lib/tech-session'
import { sendPush } from '../../../lib/integrations'
import type { Cliente, Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { PressableScale, haptics } from '../../ui/Motion'
import type { Aviso } from './ToastAviso'

export function LeadRow({
  lead,
  onStatusChange,
  tech,
  router,
  onAviso,
}: {
  lead: Cliente
  onStatusChange?: () => void
  tech?: Tecnico | null
  router?: ReturnType<typeof useRouter>
  onAviso?: (aviso: Aviso) => void
}) {
  const statusColors: Record<string, string> = {
    Nuevo: THEME.color.info, Asignado: THEME.color.warning, 'En camino': THEME.color.platino,
    'En proceso': THEME.color.brand, Completado: THEME.color.success, Calificado: THEME.color.success, Cancelado: THEME.color.danger,
  }
  const statusLabels: Record<string, string> = {
    Nuevo: 'Nuevo', Asignado: 'Asignado', 'En camino': 'En camino',
    'En proceso': 'En proceso', Completado: 'Completado', Calificado: 'Calificado', Cancelado: 'Cancelado',
  }
  const color = statusColors[lead.estado] || THEME.color.inkSoft
  const isActive = lead.estado !== 'Completado' && lead.estado !== 'Calificado' && lead.estado !== 'Cancelado'
  // In-flight: dos toques a "✓ COBRAR" disparaban dos POST y dos push al
  // cliente; también cubre Rechazar/Cancelar mientras el POST está en el aire.
  const [enviando, setEnviando] = useState(false)

  const NEXT_STATUS: Record<string, string> = {
    Asignado: 'En camino',
    'En camino': 'En proceso',
    'En proceso': 'Completado',
  }

  async function updateStatus(newStatus: string) {
    if (enviando) return
    setEnviando(true)
    try {
      // Bearer del técnico desde SecureStore (este componente no recibe authToken por props).
      const token = await getTechToken()
      let ok = false
      try {
        const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/lead/${lead.id}/estado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ estado: newStatus }),
        })
        ok = res.ok
      } catch {
        ok = false
      }
      if (!ok) {
        onAviso?.({ tipo: 'error', texto: 'No se pudo actualizar el estado. Revisa tu conexión e inténtalo de nuevo.' })
      } else {
        try {
          const msgs: Record<string, string> = { 'En camino': 'Tu técnico está en camino', 'En proceso': 'El técnico está trabajando', Completado: '¡Servicio completado!' }
          const waClean = (lead.whatsapp || '').replace(/\D/g, '')
          if (waClean) {
            sendPush('cliente', waClean, `Servicio ${newStatus}`, msgs[newStatus] || `Estado: ${newStatus}`).catch(() => {})
          }
        } catch {}
        // Live GPS streaming: on "En camino" start, on "En proceso"/"Completado" stop
        try {
          const { startLiveTracking, stopLiveTracking } = await import('../../../lib/liveTracking')
          if (newStatus === 'En camino') {
            await startLiveTracking(lead.id)
          } else if (newStatus === 'En proceso' || newStatus === 'Completado' || newStatus === 'Cancelado') {
            stopLiveTracking()
          }
        } catch {}
        onAviso?.({ tipo: 'ok', texto: `Estado cambiado a: ${newStatus}` })
        onStatusChange?.()
      }
    } finally {
      setEnviando(false)
    }
  }

  // POST real de la cancelación. Antes el fetch iba en un try/catch vacío sin
  // mirar res.ok y se refrescaba igual: el técnico creía que canceló, el lead
  // seguía asignado a él y el cliente esperaba a alguien que no iba a ir.
  async function ejecutarCancelacion() {
    if (enviando) return
    setEnviando(true)
    const token = await getTechToken()
    let ok = false
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/lead/${lead.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ estado: 'Cancelado' }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setEnviando(false)
    if (!ok) {
      // Con acción de reintento: sigue siendo Alert porque hay una decisión.
      Alert.alert('No se pudo cancelar', 'El servicio sigue asignado a ti. Revisa tu conexión e inténtalo de nuevo.', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Reintentar', onPress: () => { void ejecutarCancelacion() } },
      ])
      return
    }
    onStatusChange?.()
  }

  function cancelLead() {
    Alert.alert('Cancelar servicio', `¿Seguro que quieres cancelar el servicio de ${lead.nombre}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => { void ejecutarCancelacion() } },
    ])
  }

  // Devuelve el lead al pool (estado='Nuevo' + tecnico_asignado=null
  // server-side). Mismo patrón que ejecutarCancelacion: sin chequear res.ok un
  // rechazo fallido parecía exitoso y el cliente quedaba esperando.
  async function ejecutarRechazo() {
    if (enviando) return
    setEnviando(true)
    const token = await getTechToken()
    let ok = false
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/lead/${lead.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ estado: 'Nuevo', reasignar: true }),
      })
      ok = res.ok
    } catch {
      ok = false
    }
    setEnviando(false)
    if (!ok) {
      Alert.alert('No se pudo rechazar', 'El servicio sigue asignado a ti. Revisa tu conexión e inténtalo de nuevo.', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Reintentar', onPress: () => { void ejecutarRechazo() } },
      ])
      return
    }
    onStatusChange?.()
  }

  const nextStatus = NEXT_STATUS[lead.estado]

  return (
    <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.lg, marginBottom: THEME.space.md, ...THEME.shadow.md, borderLeftWidth: 4, borderLeftColor: color }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
        <View style={{ width: 48, height: 48, borderRadius: THEME.radius.lg, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="build" size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...THEME.font.body, fontWeight: '800', color: THEME.color.ink }}>{lead.nombre}</Text>
          <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, marginTop: 2 }}>{lead.servicio} · {lead.distrito}</Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 1 }}>{lead.codigo} · {new Date(lead.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={{ backgroundColor: color + '18', borderRadius: THEME.radius.md, paddingHorizontal: THEME.space.md, paddingVertical: 6 }}>
          <Text style={{ ...THEME.font.caption, fontWeight: '800', color }}>{statusLabels[lead.estado] || lead.estado}</Text>
        </View>
      </View>

      {lead.descripcion ? (
        <View style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: 10, marginTop: 10 }}>
          <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, fontStyle: 'italic' }} numberOfLines={2}>"{lead.descripcion}"</Text>
        </View>
      ) : null}

      {/* Action buttons Premium */}
      {isActive && (
        <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: 14 }}>
          {/* WhatsApp — solo si el lead ya está pagado: el backend manda
              whatsapp=null en los leads asignados que el técnico aún no pagó.
              Para contactarlos usa el Chat (que cobra el lead); al pagar, el
              número se desbloquea y este botón reaparece. */}
          {lead.whatsapp ? (
          <PressableScale
            onPress={() => {
              const msg = `Hola ${lead.nombre}, soy tu técnico de SOLU. Sobre tu solicitud de ${lead.servicio} (${lead.codigo}).`
              Linking.openURL(`https://wa.me/51${lead.whatsapp}?text=${encodeURIComponent(msg)}`)
            }}
            accessibilityLabel="Contactar por WhatsApp"
            // Verde de marca de WhatsApp: no existe en el THEME a propósito.
            style={{ flex: 1, minHeight: 44, backgroundColor: '#25D366', borderRadius: THEME.radius.lg, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          >
            <Ionicons name="logo-whatsapp" size={16} color={THEME.color.white} />
            <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.white }}>WhatsApp</Text>
          </PressableScale>
          ) : null}

          {/* Chat — vía in-app (cobra el lead al 1er mensaje). Cuando el número
              está bloqueado, este es el único camino de contacto. */}
          {router && tech && (
            <PressableScale
              onPress={() => router.push({
                pathname: '/chat/[id]',
                params: {
                  id: lead.id.toString(),
                  codigo: lead.codigo,
                  techName: tech.nombre,
                  clientName: lead.nombre,
                  senderType: 'tecnico',
                },
              })}
              accessibilityLabel="Abrir chat"
              style={{ flex: 1, minHeight: 44, backgroundColor: THEME.color.navy, borderRadius: THEME.radius.lg, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="chatbubbles" size={16} color={THEME.color.white} />
              <Text style={{ ...THEME.font.label, fontWeight: '800', color: THEME.color.white }}>Chat</Text>
            </PressableScale>
          )}

          {/* Next status - GRAN BOTÓN */}
          {nextStatus && (
            <PressableScale
              disabled={enviando}
              onPress={() => { if (nextStatus === 'Completado') haptics.success(); updateStatus(nextStatus) }}
              accessibilityLabel={nextStatus === 'Completado' ? 'Marcar como completado y cobrar' : `Cambiar a ${nextStatus}`}
              style={{ flex: 1.3, minHeight: 44, backgroundColor: nextStatus === 'Completado' ? THEME.color.success : THEME.color.brand, borderRadius: THEME.radius.lg, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: enviando ? 0.6 : 1, ...(nextStatus === 'Completado' ? { shadowColor: THEME.color.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 } : THEME.shadow.brand) }}
            >
              {enviando ? (
                <ActivityIndicator size="small" color={THEME.color.white} />
              ) : (
                <Ionicons name={nextStatus === 'Completado' ? 'checkmark-circle' : 'arrow-forward'} size={18} color={THEME.color.white} />
              )}
              <Text style={{ ...THEME.font.label, fontWeight: '900', color: THEME.color.white }}>{enviando ? 'Enviando...' : nextStatus === 'Completado' ? '✓ COBRAR' : nextStatus}</Text>
            </PressableScale>
          )}

          {/* Reject (only when Asignado - return to pool) */}
          {lead.estado === 'Asignado' && (
            <TouchableOpacity
              disabled={enviando}
              onPress={() => Alert.alert(
                'Rechazar solicitud',
                '¿No puedes atender este servicio? Se reasignará a otro técnico. Si pagaste coins por este lead, te los reembolsamos.',
                [
                  { text: 'No', style: 'cancel' },
                  { text: 'Rechazar', style: 'destructive', onPress: () => { void ejecutarRechazo() } },
                ])}
              accessibilityLabel="Rechazar esta solicitud"
              style={{ minWidth: 44, minHeight: 44, backgroundColor: THEME.color.dangerBg, borderRadius: 14, padding: THEME.space.md, alignItems: 'center', justifyContent: 'center', opacity: enviando ? 0.6 : 1 }}
            >
              <Ionicons name="close" size={16} color={THEME.color.danger} />
            </TouchableOpacity>
          )}

          {/* Cancel (for other statuses) */}
          {lead.estado !== 'Asignado' && (
            <TouchableOpacity
              disabled={enviando}
              onPress={cancelLead}
              accessibilityLabel="Cancelar este servicio"
              style={{ minWidth: 44, minHeight: 44, backgroundColor: THEME.color.dangerBg, borderRadius: 14, padding: THEME.space.md, alignItems: 'center', justifyContent: 'center', opacity: enviando ? 0.6 : 1 }}
            >
              <Ionicons name="close" size={16} color={THEME.color.danger} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

export default LeadRow
