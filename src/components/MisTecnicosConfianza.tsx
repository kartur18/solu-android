import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../lib/theme'
import { FadeInUp, PressableScale } from './ui/Motion'
import { fetchMisTecnicos, type TecnicoConfianza } from '../lib/servicios'
import { useContactLead } from '../lib/useContactLead'
import { ContactLeadModal } from './ContactLeadModal'

// "Tus técnicos de confianza" (historial del cliente): quiénes ya lo
// atendieron, vía GET /api/cliente/mis-tecnicos. "Volver a contactar" pasa
// por useContactLead → POST /api/contactos: el re-lead se cobra al técnico,
// que es el flujo que monetiza — nunca un atajo que revele el WhatsApp.

type Estado = 'cargando' | 'ok' | 'error'

export function MisTecnicosConfianza({ whatsapp }: { whatsapp: string }) {
  const [tecnicos, setTecnicos] = useState<TecnicoConfianza[]>([])
  const [estado, setEstado] = useState<Estado>('cargando')
  const lead = useContactLead()

  const cargar = useCallback(async () => {
    setEstado('cargando')
    const res = await fetchMisTecnicos(whatsapp)
    if (res.estado === 'error') { setEstado('error'); return }
    setTecnicos(res.tecnicos)
    setEstado('ok')
  }, [whatsapp])

  useEffect(() => { void cargar() }, [cargar])

  // Sin técnicos previos no hay nada que prometer: la sección no aparece.
  if (estado === 'cargando' || (estado === 'ok' && tecnicos.length === 0)) return null

  return (
    <FadeInUp>
      <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.md }}>
        Tus técnicos de confianza
      </Text>

      {estado === 'error' ? (
        // Error honesto: la red falló, no "no tienes técnicos".
        <PressableScale
          onPress={() => { void cargar() }}
          accessibilityLabel="Reintentar cargar tus técnicos de confianza"
          style={{
            backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg,
            padding: THEME.space.md, marginBottom: THEME.space.lg,
            flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
            minHeight: 44, ...THEME.shadow.sm,
          }}
        >
          <Ionicons name="cloud-offline-outline" size={20} color={THEME.color.inkMuted} />
          <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, flex: 1 }}>
            No pudimos cargar tus técnicos. Toca para reintentar.
          </Text>
          <Ionicons name="refresh" size={16} color={THEME.color.brand} />
        </PressableScale>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: THEME.space.sm, paddingBottom: THEME.space.xs }}
          style={{ marginBottom: THEME.space.lg }}
        >
          {tecnicos.map((t) => (
            <View
              key={t.id}
              style={{
                width: 200, backgroundColor: THEME.color.surface,
                borderRadius: THEME.radius.lg, padding: THEME.space.md,
                ...THEME.shadow.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
                {t.foto_url ? (
                  <Image
                    source={{ uri: t.foto_url }}
                    style={{ width: 44, height: 44, borderRadius: THEME.radius.full, backgroundColor: THEME.color.surfaceSunken }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: THEME.radius.full, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ ...THEME.font.h3, color: THEME.color.brand }}>{(t.nombre || '?')[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink, flexShrink: 1 }} numberOfLines={1}>
                      {t.nombre}
                    </Text>
                    {t.verificado ? <Ionicons name="checkmark-circle" size={13} color={THEME.color.success} /> : null}
                  </View>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }} numberOfLines={1}>
                    {t.oficio ?? t.ultimo_servicio ?? 'Especialista'}
                  </Text>
                </View>
              </View>

              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.sm }} numberOfLines={1}>
                {t.veces > 0
                  ? `Te atendió ${t.veces} ${t.veces === 1 ? 'vez' : 'veces'}`
                  : t.ultimo_servicio ?? 'Ya trabajaron juntos'}
              </Text>

              <PressableScale
                onPress={() => lead.contactar({ id: t.id, oficio: t.oficio, distrito: t.ultimo_distrito ?? t.distrito })}
                disabled={lead.enviando}
                accessibilityLabel={`Volver a contactar a ${t.nombre}`}
                style={{
                  marginTop: THEME.space.sm, minHeight: 44,
                  backgroundColor: THEME.color.brand, borderRadius: THEME.radius.md,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  ...THEME.shadow.brand,
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={15} color={THEME.color.white} />
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>
                  {lead.enviando ? 'Abriendo…' : 'Volver a contactar'}
                </Text>
              </PressableScale>
            </View>
          ))}
        </ScrollView>
      )}

      <ContactLeadModal
        visible={lead.modalVisible}
        initialNombre={lead.initialNombre}
        initialWhatsapp={lead.initialWhatsapp}
        enviando={lead.enviando}
        onConfirm={(nombre, wa) => { void lead.confirmarModal(nombre, wa) }}
        onClose={lead.cerrarModal}
      />
    </FadeInUp>
  )
}
