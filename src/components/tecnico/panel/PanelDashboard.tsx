// Pestaña "Inicio" del panel del técnico: bandeja, resumen del mes, tier,
// logros, agenda, últimas solicitudes, promociones y tarjeta digital.

import { Image, Linking, Share, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { useRouter } from 'expo-router'
import { ACHIEVEMENTS } from '../../../lib/constants'
import type { Cliente, Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { FadeInUp, PressableScale } from '../../ui/Motion'
import { LeadRow } from './LeadRow'
import type { Aviso } from './ToastAviso'
import type { TierInfo } from './panel-utils'

export function PanelDashboard({
  tech,
  leads,
  chatsSinLeer,
  mensajesSinLeer,
  tierInfo,
  tierNext,
  tierProgress,
  router,
  onVerServicios,
  onNuevaPromo,
  onAviso,
}: {
  tech: Tecnico
  leads: Cliente[]
  chatsSinLeer: number
  mensajesSinLeer: number
  tierInfo: TierInfo
  tierNext: TierInfo | null
  tierProgress: number
  router: ReturnType<typeof useRouter>
  onVerServicios: () => void
  onNuevaPromo: () => void
  onAviso: (aviso: Aviso) => void
}) {
  const thisMonthLeads = leads.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const completedLeads = leads.filter(l => l.estado === 'Completado' || l.estado === 'Calificado').length
  const activeLeads = leads.filter(l => l.estado !== 'Completado' && l.estado !== 'Calificado' && l.estado !== 'Cancelado').length

  return (
    <>
      <View style={{ gap: THEME.space.md }}>
        {/* Bandeja de mensajes: el técnico vive en este panel, así que el
            acceso va acá arriba además de la pestaña del tab bar. */}
        <FadeInUp delay={0}>
        <PressableScale
          onPress={() => router.push('/(tabs)/mensajes')}
          accessibilityLabel={chatsSinLeer > 0
            ? `Ver mensajes de clientes, ${chatsSinLeer} sin leer`
            : 'Ver mensajes de clientes'}
          style={{ backgroundColor: THEME.color.navy, borderRadius: THEME.radius.lg, padding: THEME.space.lg, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.md }}
        >
          <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: 'rgba(242,107,33,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chatbubbles" size={22} color={THEME.color.brand} />
            {mensajesSinLeer > 0 && (
              <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: THEME.color.navy }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '900', color: THEME.color.white }}>
                  {mensajesSinLeer > 99 ? '99+' : mensajesSinLeer}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Mensajes de clientes</Text>
            {/* Acá solo sabemos quién escribió sin leer; la bandeja
                además sabe a quién nunca le respondiste, así que su
                número es mayor. Con la misma frase en las dos pantallas
                parecían dos cuentas distintas de lo mismo. */}
            <Text style={{ ...THEME.font.bodySm, color: chatsSinLeer > 0 ? THEME.color.brand : 'rgba(255,255,255,0.7)', fontWeight: chatsSinLeer > 0 ? '800' : '500', marginTop: 2 }}>
              {chatsSinLeer === 0
                ? 'Responde a quienes te contactaron'
                : chatsSinLeer === 1
                  ? '1 cliente te escribió'
                  : `${chatsSinLeer} clientes te escribieron`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </PressableScale>
        </FadeInUp>

        {/* Quick stats */}
        <FadeInUp delay={0}>
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: THEME.space.md }}>Resumen del mes</Text>
          <View style={{ flexDirection: 'row', gap: THEME.space.sm }}>
            <QuickStat icon="trending-up" color={THEME.color.info} value={String(thisMonthLeads)} label="Solicitudes" />
            <QuickStat icon="checkmark-circle" color={THEME.color.success} value={String(completedLeads)} label="Completados" />
            <QuickStat icon="time" color={THEME.color.brand} value={String(activeLeads)} label="Activos" />
          </View>
        </View>
        </FadeInUp>

        {/* Compartir perfil. Antes esta tarjeta mostraba "Vistas a tu
            perfil" desde la tabla profile_views, que no existe: siempre
            decía 0. Se quitó la métrica falsa y quedó el CTA real. */}
        <FadeInUp delay={60}>
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, ...THEME.shadow.sm }}>
          <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: THEME.color.infoBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="share-social-outline" size={22} color={THEME.color.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Comparte tu perfil</Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>Difúndelo para conseguir más clientes</Text>
          </View>
          <TouchableOpacity
            onPress={() => Share.share({ message: `Soy ${tech.nombre}, ${tech.oficio} verificado en SOLU. Mira mi perfil: https://www.solu.pe/tecnico/${tech.id}` })}
            accessibilityLabel="Compartir mi perfil"
            style={{ backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.info }}>Compartir</Text>
          </TouchableOpacity>
        </View>
        </FadeInUp>

        {/* Level progress — mismos umbrales que el badge y el server
            (10/50/200) para que el panel no se contradiga a sí mismo. */}
        <FadeInUp delay={120}>
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: THEME.space.md }}>
            <Text style={{ fontSize: 28 }}>{tierInfo.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: THEME.color.ink }}>{tierInfo.name}</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{tech.servicios_completados} servicios completados</Text>
            </View>
          </View>
          <View style={{ height: 8, backgroundColor: THEME.color.lineSoft, borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ height: '100%', backgroundColor: tierInfo.color, borderRadius: 4, width: `${Math.round(tierProgress * 100)}%` }} />
          </View>
          {tierNext ? (
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 6 }}>
              {Math.max(tierNext.min - tech.servicios_completados, 0)} servicios más para {tierNext.emoji} {tierNext.name}
            </Text>
          ) : (
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 6 }}>Nivel máximo alcanzado 🎉</Text>
          )}
        </View>
        </FadeInUp>

        {/* Achievements */}
        <FadeInUp delay={180}>
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: 4 }}>Logros</Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginBottom: THEME.space.md }}>
            {ACHIEVEMENTS.filter(a => a.check(tech)).length}/{ACHIEVEMENTS.length} desbloqueados
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: THEME.space.sm }}>
            {ACHIEVEMENTS.map((a) => {
              const unlocked = a.check(tech)
              return (
                <View key={a.id} style={{ width: '22%', alignItems: 'center', opacity: unlocked ? 1 : 0.3, padding: 4 }}>
                  <Text style={{ fontSize: 22 }}>{unlocked ? a.emoji : '🔒'}</Text>
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.ink, textAlign: 'center', marginTop: 2 }}>{a.name}</Text>
                </View>
              )
            })}
          </View>
        </View>
        </FadeInUp>

        {/* Today's calendar */}
        <FadeInUp delay={240}>
        <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
            <Ionicons name="calendar" size={18} color={THEME.color.info} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Agenda de hoy</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://www.solu.pe/api/calendar-sync?tecnicoId=${tech.id}`)}
              accessibilityLabel="Sincronizar mi agenda con mi calendario"
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="calendar-outline" size={14} color={THEME.color.info} />
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>Sincronizar</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const today = new Date().toISOString().split('T')[0]
            const todayLeads = leads.filter(l => {
              const d = l.created_at?.split('T')[0]
              return (l.estado === 'Asignado' || l.estado === 'En camino' || l.estado === 'En proceso') && d === today
            })
            if (todayLeads.length === 0) {
              return (
                <View style={{ alignItems: 'center', paddingVertical: THEME.space.lg }}>
                  <Ionicons name="checkmark-circle-outline" size={32} color={THEME.color.success} />
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '600', color: THEME.color.ink, marginTop: THEME.space.sm }}>Sin citas para hoy</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Tu agenda está libre</Text>
                </View>
              )
            }
            return todayLeads.map(l => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: THEME.space.md, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: l.estado === 'En proceso' ? THEME.color.brand : l.estado === 'En camino' ? THEME.color.platino : THEME.color.info }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>{l.nombre}</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{l.servicio} · {l.distrito}</Text>
                </View>
                <View style={{ backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>{l.estado}</Text>
                </View>
              </View>
            ))
          })()}
        </View>
        </FadeInUp>

        {/* Recent leads preview */}
        {leads.length > 0 && (
          <FadeInUp delay={300}>
          <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Últimas solicitudes</Text>
              <TouchableOpacity onPress={onVerServicios} accessibilityLabel="Ver todas mis solicitudes" hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '600', color: THEME.color.info }}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {leads.slice(0, 3).map((l) => (
              <LeadRow key={l.id} lead={l} tech={tech} router={router} onAviso={onAviso} />
            ))}
          </View>
          </FadeInUp>
        )}
      </View>

      {/* ═══ PROMOCIONES ═══ */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, marginTop: -4, ...THEME.shadow.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Mis promociones</Text>
          <TouchableOpacity
            // Antes usaba Alert.prompt, que en Android NO existe (es
            // iOS-only): el técnico caía en un Alert sin campo de texto y
            // se publicaba "Descuento especial de <nombre>" fijo, aunque
            // el copy decía "describe tu descuento". Ahora abre un modal
            // con TextInput real, igual en ambas plataformas.
            onPress={onNuevaPromo}
            accessibilityLabel="Crear una promoción nueva"
            style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.sm, paddingHorizontal: 14, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="add" size={16} color={THEME.color.white} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Nueva</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>
          Crea promociones para destacar en tu zona. Más visibilidad = más clientes.
        </Text>
      </View>

      {/* ═══ TARJETA DIGITAL ═══ */}
      <View style={{ backgroundColor: THEME.color.navy, borderRadius: THEME.radius.xl, padding: THEME.space.xl, overflow: 'hidden', ...THEME.shadow.md }}>
        <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(242,107,33,0.15)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.lg }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {tech.foto_url ? <Image source={{ uri: tech.foto_url }} style={{ width: 50, height: 50 }} /> : <Text style={{ fontSize: 24, fontWeight: '900', color: THEME.color.white }}>{tech.nombre?.[0]}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: THEME.color.white }}>{tech.nombre}</Text>
            <Text style={{ ...THEME.font.label, fontWeight: '500', color: 'rgba(255,255,255,0.5)' }}>{tech.oficio} · {tech.distrito}</Text>
          </View>
          {tech.verificado && <Ionicons name="checkmark-circle" size={20} color={THEME.color.success} />}
        </View>
        <View style={{ flexDirection: 'row', gap: THEME.space.md, marginBottom: THEME.space.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.4)' }}>WhatsApp</Text>
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.white }}>{tech.whatsapp}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.4)' }}>Precio desde</Text>
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.brand }}>S/{tech.precio_desde || '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.4)' }}>Rating</Text>
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.warning }}>★ {tech.calificacion?.toFixed(1) || '0.0'}</Text>
          </View>
        </View>
        <PressableScale
          onPress={() => Share.share({
            message: `🔧 ${tech.nombre}\n${tech.oficio} verificado en SOLU\n\n📍 ${tech.distrito}\n💰 Desde S/${tech.precio_desde || '—'}\n⭐ ${tech.calificacion?.toFixed(1) || '0.0'} estrellas\n📱 ${tech.whatsapp}\n\n👉 Ver perfil: https://www.solu.pe/tecnico/${tech.id}`,
          })}
          accessibilityLabel="Compartir mi tarjeta digital"
          style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.md, minHeight: 44, padding: THEME.space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, ...THEME.shadow.brand }}
        >
          <Ionicons name="share-social" size={16} color={THEME.color.white} />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.white }}>Compartir mi tarjeta digital</Text>
        </PressableScale>
      </View>
    </>
  )
}

function QuickStat({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color + '12', borderRadius: THEME.radius.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: color + '20' }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ fontSize: 20, fontWeight: '900', color: THEME.color.ink, marginTop: 6 }}>{value}</Text>
      <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}

export default PanelDashboard
