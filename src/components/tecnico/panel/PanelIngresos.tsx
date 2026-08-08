// Pestaña "Ingresos" del panel del técnico: resumen, rendimiento y tendencia.
// SOLU no ve lo que el cliente le paga al técnico (sin escrow): cualquier
// cifra en soles es una estimación y se dice explícitamente.

import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Cliente, Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'

export function PanelIngresos({ tech, leads }: { tech: Tecnico; leads: Cliente[] }) {
  const completedLeads = leads.filter(l => l.estado === 'Completado' || l.estado === 'Calificado').length

  return (
    <View style={{ gap: THEME.space.md }}>
      {/* Summary cards */}
      <View style={{ flexDirection: 'row', gap: THEME.space.sm }}>
        <View style={{ flex: 1, backgroundColor: THEME.color.surface, borderRadius: 14, padding: THEME.space.lg, alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: THEME.color.ink }}>{completedLeads}</Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, fontWeight: '600' }}>Completados</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: THEME.color.surface, borderRadius: 14, padding: THEME.space.lg, alignItems: 'center' }}>
          {/* Sin precio configurado no se inventa un S/80 mágico. */}
          <Text style={{ fontSize: 28, fontWeight: '900', color: THEME.color.brand }}>
            {tech.precio_desde ? `S/${completedLeads * tech.precio_desde}` : '—'}
          </Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, fontWeight: '600' }}>Ingreso estimado*</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: THEME.color.surface, borderRadius: 14, padding: THEME.space.lg, alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: THEME.color.warning }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, fontWeight: '600' }}>Calificación</Text>
        </View>
      </View>

      {/* SOLU no ve lo que el cliente le paga al técnico (sin escrow):
          cualquier cifra en soles es una estimación, y decirlo evita
          que desconfíe de los números que sí son reales. */}
      <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, lineHeight: 15, paddingHorizontal: 2 }}>
        {tech.precio_desde
          ? `*Estimado según tu precio base de S/${tech.precio_desde} por trabajo. Lo que cobras real lo acuerdas tú con cada cliente.`
          : '*Configura tu precio base en Perfil para ver tu ingreso estimado.'}
      </Text>

      {/* Conversion rate & projections */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: THEME.space.md }}>Rendimiento</Text>
        <View style={{ flexDirection: 'row', gap: THEME.space.md }}>
          <View style={{ flex: 1, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.md, padding: THEME.space.md, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: THEME.color.success }}>{leads.length > 0 ? Math.round((completedLeads / leads.length) * 100) : 0}%</Text>
            <Text style={{ ...THEME.font.caption, color: '#065F46', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Tasa de conversión</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.md, padding: THEME.space.md, alignItems: 'center' }}>
            {/* Promedio real de completados por mes con actividad. La
                "Proyección mensual" anterior anualizaba (×12) un
                estimado en soles: cifra inventada e inflada 12x. */}
            <Text style={{ fontSize: 22, fontWeight: '900', color: THEME.color.info }}>{(() => {
              const meses = new Set(leads.map(l => { const d = new Date(l.created_at); return `${d.getFullYear()}-${d.getMonth()}` })).size
              return meses > 0 ? Math.round((completedLeads / meses) * 10) / 10 : 0
            })()}</Text>
            <Text style={{ ...THEME.font.caption, color: '#1E40AF', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Trabajos por mes</Text>
          </View>
          {/* Antes "Vistas esta semana" desde profile_views (tabla
              inexistente): siempre 0. Reemplazado por un dato real. */}
          <View style={{ flex: 1, backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.md, padding: THEME.space.md, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#92400E' }}>{tech.servicios_completados || 0}</Text>
            <Text style={{ ...THEME.font.caption, color: '#78350F', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>Servicios completados</Text>
          </View>
        </View>
      </View>

      {/* Monthly breakdown */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: THEME.space.md }}>Últimos 6 meses</Text>
        {(() => {
          const months: { label: string; count: number }[] = []
          for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const m = d.getMonth()
            const y = d.getFullYear()
            const count = leads.filter(l => {
              const ld = new Date(l.created_at)
              return ld.getMonth() === m && ld.getFullYear() === y && (l.estado === 'Completado' || l.estado === 'Calificado')
            }).length
            months.push({ label: d.toLocaleDateString('es-PE', { month: 'short' }), count })
          }
          const maxCount = Math.max(...months.map(m => m.count), 1)
          return months.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: THEME.space.sm }}>
              <Text style={{ width: 35, ...THEME.font.caption, fontWeight: '600', color: THEME.color.inkSoft, textTransform: 'capitalize' }}>{m.label}</Text>
              <View style={{ flex: 1, height: 24, backgroundColor: THEME.color.lineSoft, borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ width: `${(m.count / maxCount) * 100}%`, height: '100%', backgroundColor: THEME.color.brand, borderRadius: 6, minWidth: m.count > 0 ? 20 : 0, justifyContent: 'center', paddingLeft: 6 }}>
                  {m.count > 0 && <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.white }}>{m.count}</Text>}
                </View>
              </View>
            </View>
          ))
        })()}
      </View>

      {/* V3.1: tendencia mensual disponible para todos los técnicos
          verificados (sin gate por plan mensual). */}
      {tech.verificado && (
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: THEME.space.sm }}>Tendencia</Text>
          {(() => {
            const thisM = leads.filter(l => { const d = new Date(l.created_at); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length
            const lastM = leads.filter(l => { const d = new Date(l.created_at); const n = new Date(); n.setMonth(n.getMonth() - 1); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length
            const diff = thisM - lastM
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                <Ionicons name={diff >= 0 ? 'trending-up' : 'trending-down'} size={24} color={diff >= 0 ? THEME.color.success : THEME.color.danger} />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: diff >= 0 ? THEME.color.success : THEME.color.danger }}>
                    {diff >= 0 ? '+' : ''}{diff} solicitudes vs mes anterior
                  </Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>Este mes: {thisM} · Mes anterior: {lastM}</Text>
                </View>
              </View>
            )
          })()}
        </View>
      )}

      {/* V3.1: servicios más solicitados también disponible para todos. */}
      {tech.verificado && (
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: THEME.space.sm }}>Servicios más solicitados</Text>
          {(() => {
            const serviceCounts: Record<string, number> = {}
            leads.forEach(l => { serviceCounts[l.servicio] = (serviceCounts[l.servicio] || 0) + 1 })
            const top = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
            return top.length > 0 ? top.map(([svc, count], i) => (
              <View key={svc} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: THEME.space.sm, borderBottomWidth: i < top.length - 1 ? 1 : 0, borderBottomColor: THEME.color.lineSoft }}>
                <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>{svc}</Text>
                <View style={{ backgroundColor: THEME.color.brand + '15', borderRadius: 6, paddingHorizontal: THEME.space.sm, paddingVertical: 2 }}>
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.brand }}>{count}</Text>
                </View>
              </View>
            )) : <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted }}>Sin datos aún</Text>
          })()}
        </View>
      )}

      {/* Info */}
      <View style={{ backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.md, padding: 14 }}>
        <Text style={{ ...THEME.font.caption, color: '#1E40AF', lineHeight: 16 }}>
          Estadísticas completas: tendencia mensual, servicios más solicitados y desglose por categoría. Todo incluido sin suscripción.
        </Text>
      </View>
    </View>
  )
}

export default PanelIngresos
