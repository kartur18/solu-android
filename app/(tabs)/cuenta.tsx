import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, getTechLevel, getTechLevelProgress, ACHIEVEMENTS, PLAN_FEATURES, LEVELS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import type { Tecnico, Cliente, Resena } from '../../src/lib/types'

export default function CuentaScreen() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)
  const [wa, setWa] = useState('')
  const [loading, setLoading] = useState(false)
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [leads, setLeads] = useState<Cliente[]>([])
  const [reviews, setReviews] = useState<Resena[]>([])
  const [tab, setTab] = useState<'perfil' | 'leads' | 'resenas' | 'plan'>('perfil')

  async function doLogin() {
    if (!wa) return Alert.alert('Error', 'Ingresa tu WhatsApp')
    setLoading(true)
    const { data } = await supabase
      .from('tecnicos')
      .select('*')
      .eq('whatsapp', wa)
      .single()

    if (!data) {
      Alert.alert('No encontrado', 'No hay cuenta de técnico con ese WhatsApp')
    } else {
      setTech(data)
      setLoggedIn(true)
      const [leadsRes, revRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('tecnico_asignado', data.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('resenas').select('*').eq('tecnico_id', data.id).order('created_at', { ascending: false }).limit(20),
      ])
      setLeads(leadsRes.data || [])
      setReviews(revRes.data || [])
    }
    setLoading(false)
  }

  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.light, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: COLORS.white, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
            <Ionicons name="person" size={28} color={COLORS.pri} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, textAlign: 'center', marginBottom: 4 }}>Mi cuenta</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginBottom: 20 }}>Ingresa tu WhatsApp para acceder a tu perfil de técnico</Text>
          <TextInput
            placeholder="Tu WhatsApp: 999 888 777"
            value={wa}
            onChangeText={setWa}
            keyboardType="phone-pad"
            style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, textAlign: 'center' }}
            placeholderTextColor={COLORS.gray2}
          />
          <TouchableOpacity
            onPress={doLogin}
            disabled={loading}
            style={{ backgroundColor: COLORS.pri, borderRadius: 12, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 15 }}>{loading ? 'Buscando...' : 'Ingresar →'}</Text>
          </TouchableOpacity>
        </View>
        <LegalSection router={router} />
      </View>
    )
  }

  if (!tech) return null

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* Profile header */}
      <View style={{ backgroundColor: COLORS.pri, padding: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, alignItems: 'center' }}>
        <View style={{ width: 70, height: 70, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.[0] || 'T'}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.nombre}</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{tech.oficio} · {tech.distrito}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Rating</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.num_resenas || 0}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Reseñas</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.servicios_completados || 0}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Servicios</Text>
          </View>
        </View>
        <View style={{ marginTop: 10, backgroundColor: tech.plan === 'pro' ? '#FFD700' : 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: tech.plan === 'pro' ? COLORS.dark : COLORS.white }}>
            Plan {tech.plan?.toUpperCase() || 'GRATIS'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 16, paddingHorizontal: 12 }}>
        {([
          { key: 'perfil' as const, label: 'Perfil' },
          { key: 'leads' as const, label: 'Leads' },
          { key: 'resenas' as const, label: 'Reseñas' },
          { key: 'plan' as const, label: 'Plan' },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: tab === t.key ? COLORS.pri : COLORS.white, marginRight: 8, borderWidth: 1, borderColor: tab === t.key ? COLORS.pri : COLORS.border }}
          >
            <Text style={{ fontWeight: '700', fontSize: 12, color: tab === t.key ? COLORS.white : COLORS.gray }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ padding: 16, paddingTop: 0 }}>
        {tab === 'perfil' && (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border }}>
            <InfoRow label="WhatsApp" value={tech.whatsapp} />
            <InfoRow label="Email" value={tech.email || 'No registrado'} />
            <InfoRow label="Experiencia" value={tech.experiencia || 'No especificada'} />
            <InfoRow label="Precio desde" value={tech.precio_desde ? `S/${tech.precio_desde}` : 'No especificado'} />
            <InfoRow label="Disponible" value={tech.disponible ? 'Sí' : 'No'} />
            <InfoRow label="Verificado" value={tech.verificado ? 'Sí ✅' : 'Pendiente'} />
          </View>
        )}
        {tab === 'leads' && (
          <View>
            {leads.map((l) => (
              <View key={l.id} style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: COLORS.dark }}>{l.nombre}</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>{l.servicio} · {l.distrito}</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 2 }}>Estado: {l.estado}</Text>
              </View>
            ))}
            {leads.length === 0 && <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20 }}>Sin leads aún</Text>}
          </View>
        )}
        {tab === 'resenas' && (
          <View>
            {reviews.map((r) => (
              <View key={r.id} style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={14} color={s <= r.calificacion ? COLORS.yellow : COLORS.border} />
                  ))}
                </View>
                <Text style={{ fontSize: 13, color: COLORS.dark }}>{r.comentario}</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 4 }}>— {r.nombre_cliente}</Text>
              </View>
            ))}
            {reviews.length === 0 && <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20 }}>Sin reseñas aún</Text>}
          </View>
        )}
        {tab === 'plan' && tech && (
          <View>
            {/* Current plan */}
            <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Tu plan actual</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: COLORS.priLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontWeight: '800', color: COLORS.pri }}>{PLAN_FEATURES[tech.plan as keyof typeof PLAN_FEATURES]?.name || 'Gratuito'}</Text>
                </View>
                {tech.fecha_vencimiento && (
                  <Text style={{ fontSize: 11, color: COLORS.gray2 }}>Vence: {tech.fecha_vencimiento.split('T')[0]}</Text>
                )}
              </View>
              <View style={{ marginTop: 12 }}>
                {(PLAN_FEATURES[tech.plan as keyof typeof PLAN_FEATURES]?.features || []).map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.acc} />
                    <Text style={{ fontSize: 12, color: COLORS.dark }}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Upgrade options */}
            {tech.plan === 'trial' && (
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Mejora tu plan</Text>
                {(['profesional', 'premium', 'elite'] as const).map((planKey) => {
                  const plan = PLAN_FEATURES[planKey]
                  return (
                    <View key={planKey} style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>{plan.name}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.pri }}>S/{plan.price}/mes</Text>
                      </View>
                      {plan.features.map((f, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                          <Ionicons name="checkmark" size={12} color={COLORS.acc} />
                          <Text style={{ fontSize: 11, color: COLORS.gray }}>{f}</Text>
                        </View>
                      ))}
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`https://wa.me/51904518343?text=Hola,%20quiero%20el%20plan%20${plan.name}%20para%20mi%20cuenta%20${tech.whatsapp}`)}
                        style={{ backgroundColor: COLORS.pri, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 }}
                      >
                        <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>Contratar {plan.name}</Text>
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Level & Achievements */}
      {tech && (
        <View style={{ padding: 16, paddingTop: 0 }}>
          {/* Level */}
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Tu nivel</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 32 }}>{getTechLevel(tech.servicios_completados).emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{getTechLevel(tech.servicios_completados).name}</Text>
                <View style={{ height: 8, backgroundColor: COLORS.light, borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                  <View style={{ height: '100%', backgroundColor: COLORS.pri, borderRadius: 4, width: `${Math.min(getTechLevelProgress(tech.servicios_completados) * 100, 100)}%` }} />
                </View>
                <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 4 }}>{tech.servicios_completados} servicios completados</Text>
              </View>
            </View>
          </View>

          {/* Achievements */}
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Logros</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ACHIEVEMENTS.map((a) => {
                const unlocked = a.check(tech)
                return (
                  <View key={a.id} style={{ width: '23%', alignItems: 'center', opacity: unlocked ? 1 : 0.3, padding: 6 }}>
                    <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.dark, textAlign: 'center', marginTop: 2 }}>{a.name}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity
        onPress={() => { setLoggedIn(false); setTech(null) }}
        style={{ marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}
      >
        <Text style={{ color: COLORS.red, fontWeight: '700', fontSize: 14 }}>Cerrar sesión</Text>
      </TouchableOpacity>

      <LegalSection router={router} />
    </ScrollView>
  )
}

function LegalSection({ router }: { router: any }) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 40 }}>
      <View style={{ backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
        <TouchableOpacity onPress={() => router.push('/privacidad')} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.gray} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: COLORS.dark }}>Política de Privacidad</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gray2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/terminos')} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.gray} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: COLORS.dark }}>Términos y Condiciones</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gray2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/51904518343?text=Hola,%20necesito%20soporte%20con%20SOLU')} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.gray} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: COLORS.dark }}>Soporte por WhatsApp</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gray2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/eliminar-cuenta')} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: COLORS.red }}>Eliminar mi cuenta</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gray2} />
        </TouchableOpacity>
        <View style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: COLORS.gray2 }}>SOLU v1.0.0 · CITYLAND GROUP E.I.R.L.</Text>
        </View>
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      <Text style={{ fontSize: 13, color: COLORS.gray }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark }}>{value}</Text>
    </View>
  )
}
