import { useState, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, Switch, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, getTechLevel, getTechLevelProgress, ACHIEVEMENTS, PLAN_FEATURES, LEVELS, waLink, DISTRITOS } from '../../src/lib/constants'
import { ENV } from '../../src/lib/env'
import { YapeQR } from '../../src/components/YapeQR'
import { PlinQR } from '../../src/components/PlinQR'
import { supabase } from '../../src/lib/supabase'
import { registerForPushNotifications, savePushToken } from '../../src/lib/notifications'
import type { Tecnico, Cliente, Resena } from '../../src/lib/types'

type Tab = 'dashboard' | 'servicios' | 'resenas' | 'plan' | 'perfil'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'dashboard', icon: 'grid', label: 'Inicio' },
  { key: 'servicios', icon: 'briefcase', label: 'Servicios' },
  { key: 'resenas', icon: 'star', label: 'Reseñas' },
  { key: 'plan', icon: 'diamond', label: 'Plan' },
  { key: 'perfil', icon: 'person', label: 'Perfil' },
]

export default function CuentaScreen() {
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState(false)
  const [wa, setWa] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tech, setTech] = useState<Tecnico | null>(null)
  const [leads, setLeads] = useState<Cliente[]>([])
  const [reviews, setReviews] = useState<Resena[]>([])
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState<'yape' | 'plin'>('yape')

  // Edit profile state
  const [editing, setEditing] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editPrecio, setEditPrecio] = useState('')
  const [editDisponible, setEditDisponible] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  async function doLogin() {
    if (!wa) return Alert.alert('Error', 'Ingresa tu WhatsApp')
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tecnicos')
        .select('*')
        .eq('whatsapp', wa)
        .single()

      if (error || !data) {
        Alert.alert('No encontrado', 'No hay cuenta de técnico con ese WhatsApp')
        setLoading(false)
        return
      }

      setTech(data)
      setLoggedIn(true)
      setEditDesc(data.descripcion || '')
      setEditPrecio(data.precio_desde?.toString() || '')
      setEditDisponible(data.disponible)

      registerForPushNotifications().then(token => {
        if (token) savePushToken(data.id, token)
      })
      await loadData(data.id)
    } catch {
      Alert.alert('Error', 'Error de conexión. Verifica tu internet.')
    } finally {
      setLoading(false)
    }
  }

  async function loadData(techId: number) {
    try {
      const [leadsRes, revRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('tecnico_asignado', techId).order('created_at', { ascending: false }).limit(30),
        supabase.from('resenas').select('*').eq('tecnico_id', techId).order('created_at', { ascending: false }).limit(30),
      ])
      setLeads(leadsRes.data || [])
      setReviews(revRes.data || [])
    } catch {
      // silent
    }
  }

  const onRefresh = useCallback(async () => {
    if (!tech) return
    setRefreshing(true)
    try {
      const { data } = await supabase.from('tecnicos').select('*').eq('id', tech.id).single()
      if (data) {
        setTech(data)
        setEditDesc(data.descripcion || '')
        setEditPrecio(data.precio_desde?.toString() || '')
        setEditDisponible(data.disponible)
      }
      await loadData(tech.id)
    } catch {} finally {
      setRefreshing(false)
    }
  }, [tech])

  async function saveProfile() {
    if (!tech) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('tecnicos').update({
        descripcion: editDesc || null,
        precio_desde: editPrecio ? parseInt(editPrecio) : null,
        disponible: editDisponible,
      }).eq('id', tech.id)

      if (error) throw error
      setTech({ ...tech, descripcion: editDesc || null, precio_desde: editPrecio ? parseInt(editPrecio) : null, disponible: editDisponible })
      setEditing(false)
      Alert.alert('Guardado', 'Tu perfil se actualizó correctamente')
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo guardar: ' + (err?.message || 'Intenta de nuevo'))
    } finally {
      setSavingProfile(false)
    }
  }

  const daysLeft = tech?.fecha_vencimiento
    ? Math.max(0, Math.ceil((new Date(tech.fecha_vencimiento).getTime() - Date.now()) / 86400000))
    : 0
  const isExpired = tech?.fecha_vencimiento
    ? new Date(tech.fecha_vencimiento).getTime() < Date.now()
    : false

  // Stats
  const thisMonthLeads = leads.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const completedLeads = leads.filter(l => l.estado === 'completado' || l.estado === 'calificado').length
  const activeLeads = leads.filter(l => l.estado !== 'completado' && l.estado !== 'calificado' && l.estado !== 'cancelado').length

  // LOGIN SCREEN
  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
            <Ionicons name="person" size={28} color="#fff" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark, textAlign: 'center', marginBottom: 4 }}>Mi cuenta</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginBottom: 24 }}>Ingresa tu WhatsApp registrado</Text>
          <TextInput
            placeholder="999 888 777"
            value={wa}
            onChangeText={setWa}
            keyboardType="phone-pad"
            style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, fontSize: 16, marginBottom: 12, textAlign: 'center', fontWeight: '600' }}
            placeholderTextColor={COLORS.gray2}
          />
          <TouchableOpacity
            onPress={doLogin}
            disabled={loading}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{loading ? 'Buscando...' : 'Ingresar →'}</Text>
          </TouchableOpacity>
          <Text style={{ textAlign: 'center', fontSize: 11, color: COLORS.gray2, marginTop: 12 }}>
            ¿No tienes cuenta? Regístrate desde la pantalla de inicio
          </Text>
        </View>
        <LegalSection router={router} />
      </View>
    )
  }

  if (!tech) return null

  const level = getTechLevel(tech.servicios_completados)
  const planInfo = PLAN_FEATURES[tech.plan as keyof typeof PLAN_FEATURES]

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" />}
      >
        {/* Header */}
        <View style={{ backgroundColor: '#1E3A5F', padding: 20, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Bienvenido</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{tech.nombre}</Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => { setLoggedIn(false); setTech(null); setTab('dashboard') } },
              ])}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard value={`★ ${tech.calificacion?.toFixed(1) || '0.0'}`} label="Rating" />
            <StatCard value={String(tech.num_resenas || 0)} label="Reseñas" />
            <StatCard value={String(tech.servicios_completados || 0)} label="Servicios" />
            <StatCard value={`${daysLeft}d`} label={isExpired ? 'Vencido' : 'Restantes'} expired={isExpired} />
          </View>

          {/* Plan badge */}
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: isExpired ? '#FCA5A5' : COLORS.green }}>
                {level.emoji} {level.name} · Plan {tech.plan?.toUpperCase() || 'TRIAL'}
              </Text>
            </View>
            {tech.verificado && (
              <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.green }}>✅ Verificado</Text>
              </View>
            )}
          </View>
        </View>

        {/* Expired alert */}
        {isExpired && (
          <View style={{ margin: 16, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>⚠️ Tu plan venció</Text>
            <Text style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>Tu perfil sigue visible pero perdiste prioridad y beneficios. Renueva para recibir más clientes.</Text>
          </View>
        )}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 12, paddingHorizontal: 12 }}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                backgroundColor: tab === t.key ? '#1E3A5F' : '#fff',
                marginRight: 6, borderWidth: 1,
                borderColor: tab === t.key ? '#1E3A5F' : '#E2E8F0',
              }}
            >
              <Ionicons name={t.icon as any} size={14} color={tab === t.key ? '#fff' : COLORS.gray} />
              <Text style={{ fontWeight: '700', fontSize: 11, color: tab === t.key ? '#fff' : COLORS.gray }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ padding: 16, paddingTop: 4 }}>

          {/* ═══ DASHBOARD ═══ */}
          {tab === 'dashboard' && (
            <View style={{ gap: 12 }}>
              {/* Quick stats */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>Resumen del mes</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <QuickStat icon="trending-up" color="#2563EB" value={String(thisMonthLeads)} label="Solicitudes" />
                  <QuickStat icon="checkmark-circle" color={COLORS.green} value={String(completedLeads)} label="Completados" />
                  <QuickStat icon="time" color={COLORS.pri} value={String(activeLeads)} label="Activos" />
                </View>
              </View>

              {/* Level progress */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 28 }}>{level.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{level.name}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.gray }}>{tech.servicios_completados} servicios completados</Text>
                  </View>
                </View>
                <View style={{ height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: '100%', backgroundColor: level.color, borderRadius: 4, width: `${Math.min(getTechLevelProgress(tech.servicios_completados) * 100, 100)}%` }} />
                </View>
                {(() => {
                  const idx = LEVELS.indexOf(level)
                  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
                  return next ? (
                    <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 6 }}>
                      {next.min - tech.servicios_completados} servicios más para {next.emoji} {next.name}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 6 }}>Nivel máximo alcanzado 🎉</Text>
                  )
                })()}
              </View>

              {/* Achievements */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Logros</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 12 }}>
                  {ACHIEVEMENTS.filter(a => a.check(tech)).length}/{ACHIEVEMENTS.length} desbloqueados
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ACHIEVEMENTS.map((a) => {
                    const unlocked = a.check(tech)
                    return (
                      <View key={a.id} style={{ width: '22%', alignItems: 'center', opacity: unlocked ? 1 : 0.3, padding: 4 }}>
                        <Text style={{ fontSize: 22 }}>{unlocked ? a.emoji : '🔒'}</Text>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: COLORS.dark, textAlign: 'center', marginTop: 2 }}>{a.name}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* Recent leads preview */}
              {leads.length > 0 && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Últimas solicitudes</Text>
                    <TouchableOpacity onPress={() => setTab('servicios')}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>Ver todas →</Text>
                    </TouchableOpacity>
                  </View>
                  {leads.slice(0, 3).map((l) => (
                    <LeadRow key={l.id} lead={l} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ═══ SERVICIOS ═══ */}
          {tab === 'servicios' && (
            <View style={{ gap: 12 }}>
              {/* Active */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Servicios activos</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 10 }}>Solicitudes pendientes y en proceso</Text>
                {leads.filter(l => l.estado !== 'completado' && l.estado !== 'calificado' && l.estado !== 'cancelado').length === 0 ? (
                  <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 16, fontSize: 12 }}>No tienes servicios activos</Text>
                ) : (
                  leads.filter(l => l.estado !== 'completado' && l.estado !== 'calificado' && l.estado !== 'cancelado').map((l) => (
                    <LeadRow key={l.id} lead={l} />
                  ))
                )}
              </View>

              {/* History */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Historial</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 10 }}>Servicios completados</Text>
                {leads.filter(l => l.estado === 'completado' || l.estado === 'calificado').length === 0 ? (
                  <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 16, fontSize: 12 }}>Sin historial aún</Text>
                ) : (
                  leads.filter(l => l.estado === 'completado' || l.estado === 'calificado').map((l) => (
                    <LeadRow key={l.id} lead={l} />
                  ))
                )}
              </View>
            </View>
          )}

          {/* ═══ RESEÑAS ═══ */}
          {tab === 'resenas' && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Mis reseñas</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 12 }}>Lo que dicen tus clientes</Text>
              {reviews.length === 0 ? (
                <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20, fontSize: 12 }}>Aún no tienes reseñas</Text>
              ) : (
                reviews.map((r) => (
                  <View key={r.id} style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{r.nombre_cliente}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons key={s} name="star" size={12} color={s <= r.calificacion ? '#F59E0B' : '#E2E8F0'} />
                        ))}
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.gray, fontStyle: 'italic' }}>"{r.comentario}"</Text>
                    <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 4 }}>{r.servicio} · {new Date(r.created_at).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══ PLAN ═══ */}
          {tab === 'plan' && (
            <View style={{ gap: 12 }}>
              {/* Current plan */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Tu plan actual</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontWeight: '800', color: '#1E3A5F' }}>{planInfo?.name || 'Gratuito'}</Text>
                  </View>
                  {!isExpired && daysLeft > 0 && (
                    <Text style={{ fontSize: 11, color: COLORS.gray2 }}>{daysLeft} días restantes</Text>
                  )}
                </View>
                <View style={{ marginTop: 12 }}>
                  {(planInfo?.features || []).map((f: string, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                      <Text style={{ fontSize: 12, color: COLORS.dark }}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Upgrade */}
              {(tech.plan === 'trial' || tech.plan === 'profesional' || tech.plan === 'premium') && (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark, marginBottom: 8 }}>Mejora tu plan</Text>
                  {(['profesional', 'premium', 'elite'] as const)
                    .filter(planKey => {
                      const rank: Record<string, number> = { trial: 0, profesional: 1, premium: 2, elite: 3 }
                      return (rank[planKey] || 0) > (rank[tech.plan] || 0)
                    })
                    .map((planKey) => {
                    const plan = PLAN_FEATURES[planKey]
                    return (
                      <View key={planKey} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark }}>{plan.name}</Text>
                          <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.pri }}>S/{plan.price}/mes</Text>
                        </View>
                        {plan.features.map((f, i) => (
                          <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                            <Ionicons name="checkmark" size={12} color={COLORS.green} />
                            <Text style={{ fontSize: 11, color: COLORS.gray }}>{f}</Text>
                          </View>
                        ))}
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`${plan.culqiLink}?metadata[tecnico_id]=${tech.id}&metadata[plan]=${planKey}`)}
                          style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                          <Ionicons name="card-outline" size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Pagar con tarjeta S/{plan.price}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setSelectedPlan(selectedPlan === planKey ? null : planKey)}
                          style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6 }}
                        >
                          <Text style={{ color: COLORS.gray, fontWeight: '600', fontSize: 12 }}>
                            {selectedPlan === planKey ? 'Ocultar' : 'Pagar con Yape o Plin'}
                          </Text>
                        </TouchableOpacity>
                        {selectedPlan === planKey && (
                          <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                              <TouchableOpacity onPress={() => setPayMethod('yape')} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: payMethod === 'yape' ? '#6C2EB9' : '#E2E8F0' }}>
                                <Text style={{ fontSize: 18 }}>💜</Text>
                                <Text style={{ fontSize: 11, fontWeight: '600' }}>Yape</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => setPayMethod('plin')} style={{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: payMethod === 'plin' ? '#00BFA5' : '#E2E8F0' }}>
                                <Text style={{ fontSize: 18 }}>💚</Text>
                                <Text style={{ fontSize: 11, fontWeight: '600' }}>Plin</Text>
                              </TouchableOpacity>
                            </View>
                            {payMethod === 'yape' ? (
                              <YapeQR amount={plan.price} reference={`PLAN-${planKey.toUpperCase()}-${tech.id}`} />
                            ) : (
                              <PlinQR amount={plan.price} reference={`PLAN-${planKey.toUpperCase()}-${tech.id}`} />
                            )}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* ═══ PERFIL (Editable) ═══ */}
          {tab === 'perfil' && (
            <View style={{ gap: 12 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.dark }}>Mi perfil</Text>
                  {!editing ? (
                    <TouchableOpacity onPress={() => setEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                      <Ionicons name="create-outline" size={14} color="#2563EB" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Editar</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => setEditing(false)} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.gray }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveProfile} disabled={savingProfile} style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{savingProfile ? 'Guardando...' : 'Guardar'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <InfoRow label="Nombre" value={tech.nombre} />
                <InfoRow label="Oficio" value={tech.oficio} />
                <InfoRow label="Distrito" value={tech.distrito} />
                <InfoRow label="WhatsApp" value={tech.whatsapp} />
                <InfoRow label="Email" value={tech.email || 'No registrado'} />
                <InfoRow label="Verificado" value={tech.verificado ? 'Sí ✅' : 'Pendiente ⏳'} />

                {/* Editable fields */}
                {editing ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Descripción</Text>
                    <TextInput
                      value={editDesc}
                      onChangeText={setEditDesc}
                      multiline
                      numberOfLines={3}
                      placeholder="Ej: Gasfitero con 10 años de experiencia..."
                      style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12, textAlignVertical: 'top', minHeight: 70 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Precio base (S/)</Text>
                    <TextInput
                      value={editPrecio}
                      onChangeText={setEditPrecio}
                      keyboardType="numeric"
                      placeholder="60"
                      style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}
                      placeholderTextColor={COLORS.gray2}
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark }}>Disponible para trabajar</Text>
                      <Switch
                        value={editDisponible}
                        onValueChange={setEditDisponible}
                        trackColor={{ false: '#E2E8F0', true: '#86EFAC' }}
                        thumbColor={editDisponible ? COLORS.green : '#94A3B8'}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <InfoRow label="Descripción" value={tech.descripcion || 'Sin descripción'} />
                    <InfoRow label="Precio desde" value={tech.precio_desde ? `S/${tech.precio_desde}` : 'No especificado'} />
                    <InfoRow label="Disponible" value={tech.disponible ? 'Sí ✅' : 'No ❌'} />
                    {tech.zonas && tech.zonas.length > 0 && (
                      <InfoRow label="Zonas" value={tech.zonas.join(', ')} />
                    )}
                  </View>
                )}
              </View>

              {/* Danger zone */}
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.gray, marginBottom: 8 }}>Cuenta</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert('Cerrar sesión', '¿Seguro?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', style: 'destructive', onPress: () => { setLoggedIn(false); setTech(null); setTab('dashboard') } },
                  ])}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}
                >
                  <Ionicons name="log-out-outline" size={18} color={COLORS.gray} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.gray }}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <LegalSection router={router} />
      </ScrollView>
    </View>
  )
}

function StatCard({ value, label, expired }: { value: string; label: string; expired?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: expired ? '#FCA5A5' : '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 9, color: expired ? '#FCA5A5' : 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </View>
  )
}

function QuickStat({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color + '10', borderRadius: 12, padding: 12, alignItems: 'center' }}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark, marginTop: 4 }}>{value}</Text>
      <Text style={{ fontSize: 9, color: COLORS.gray2, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

function LeadRow({ lead }: { lead: Cliente }) {
  const statusColors: Record<string, string> = {
    nuevo: '#2563EB', asignado: '#F59E0B', en_camino: '#8B5CF6',
    en_proceso: '#F97316', completado: '#10B981', calificado: '#10B981', cancelado: '#EF4444',
  }
  const color = statusColors[lead.estado] || COLORS.gray
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="build" size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.dark }}>{lead.nombre}</Text>
        <Text style={{ fontSize: 10, color: COLORS.gray }}>{lead.servicio} · {lead.distrito}</Text>
      </View>
      <View style={{ backgroundColor: color + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color }}>{lead.estado?.replace('_', ' ')}</Text>
      </View>
    </View>
  )
}

function LegalSection({ router }: { router: any }) {
  return (
    <View style={{ margin: 16, marginBottom: 40 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
        {[
          { icon: 'shield-checkmark-outline', label: 'Política de Privacidad', route: '/privacidad', color: COLORS.gray },
          { icon: 'document-text-outline', label: 'Términos y Condiciones', route: '/terminos', color: COLORS.gray },
          { icon: 'chatbubble-ellipses-outline', label: 'Soporte por WhatsApp', route: null, color: COLORS.gray },
          { icon: 'trash-outline', label: 'Eliminar mi cuenta', route: '/eliminar-cuenta', color: COLORS.red },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => item.route ? router.push(item.route) : Linking.openURL('https://wa.me/51904518343?text=Hola,%20necesito%20soporte%20con%20SOLU')}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#F1F5F9' }}
          >
            <Ionicons name={item.icon as any} size={18} color={item.color} />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '600', color: item.color }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.gray2} />
          </TouchableOpacity>
        ))}
        <View style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: COLORS.gray2 }}>SOLU v1.0.0 · CITYLAND GROUP E.I.R.L.</Text>
        </View>
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
      <Text style={{ fontSize: 12, color: COLORS.gray, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark, flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}
