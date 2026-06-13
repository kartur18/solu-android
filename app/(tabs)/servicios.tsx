import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, RefreshControl, StatusBar } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SUPPORT_PHONE, waLink } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { fetchClienteServicios } from '../../src/lib/servicios'
import { ENV } from '../../src/lib/env'
import { registerForPushNotifications, sendLocalNotification, getStatusNotification } from '../../src/lib/notifications'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, Shimmer, haptics } from '../../src/components/ui/Motion'
import type { Cliente, ClienteUser } from '../../src/lib/types'

// Cada estado de servicio mapea a un color semántico del theme + ícono.
const STATUS_INFO: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  Nuevo: { label: 'Registrada', color: THEME.color.info, bg: THEME.color.infoBg, icon: 'document-text' },
  Asignado: { label: 'Técnico asignado', color: THEME.color.warning, bg: THEME.color.warningBg, icon: 'person' },
  'En camino': { label: 'En camino', color: THEME.color.platino, bg: '#EEF0FF', icon: 'car' },
  'En proceso': { label: 'En proceso', color: THEME.color.brand, bg: THEME.color.brandLight, icon: 'hammer' },
  Completado: { label: 'Completado', color: THEME.color.success, bg: THEME.color.successBg, icon: 'checkmark-circle' },
  Calificado: { label: 'Calificado', color: THEME.color.success, bg: THEME.color.successBg, icon: 'star' },
  Cancelado: { label: 'Cancelado', color: THEME.color.danger, bg: THEME.color.dangerBg, icon: 'close-circle' },
}

const SESSION_KEY = 'solu_client_session'

// Skeleton con la forma de una ServiceCard real.
function ServiceCardShimmer() {
  return (
    <View style={{
      backgroundColor: THEME.color.surface,
      borderRadius: THEME.radius.xl,
      padding: THEME.space.lg,
      marginBottom: THEME.space.md,
      ...THEME.shadow.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
        <Shimmer style={{ width: 48, height: 48, borderRadius: THEME.radius.lg }} />
        <View style={{ flex: 1, gap: THEME.space.sm }}>
          <Shimmer style={{ width: '60%', height: 15, borderRadius: 6 }} />
          <Shimmer style={{ width: '42%', height: 11, borderRadius: 6 }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.md }}>
        <Shimmer style={{ flex: 1, height: 36, borderRadius: THEME.radius.md }} />
        <Shimmer style={{ flex: 1, height: 36, borderRadius: THEME.radius.md }} />
      </View>
    </View>
  )
}

export default function MisServiciosScreen() {
  const router = useRouter()
  const [user, setUser] = useState<ClienteUser | null>(null)
  const [loginWa, setLoginWa] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [servicios, setServicios] = useState<Cliente[]>([])

  // Auto-login from saved session
  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ClienteUser
          setUser(parsed)
          loadServicios(parsed.whatsapp)
        } catch {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    })
  }, [])

  async function loadServicios(wa: string) {
    setLoading(true)
    try {
      // Lectura de `clientes` migrada a endpoint server-side (anon cerrado por PII).
      // Replicamos en memoria el orden created_at desc y el limit 30 originales.
      const data = await fetchClienteServicios(wa)
      const ordered = [...data]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 30)
      setServicios(ordered)
    } catch {} finally {
      setLoading(false)
    }
  }

  async function doLogin() {
    const waClean = loginWa.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) {
      return Alert.alert('Error', 'Ingresa un WhatsApp válido (9 dígitos, empieza con 9)')
    }
    if (!loginPassword) return Alert.alert('Error', 'Ingresa tu contraseña')

    setLoading(true)
    try {
      const res = await fetch(`${ENV.API_BASE_URL}/login-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: waClean, password: loginPassword }),
      })
      const result = await res.json()

      if (!res.ok) {
        if (res.status === 404) {
          Alert.alert('No encontrado', 'No hay cuenta con ese WhatsApp. ¿Quieres crear una?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Crear cuenta', onPress: () => router.push('/registro-cliente') },
          ])
        } else {
          Alert.alert('Error', result.error || 'Error al iniciar sesión')
        }
        setLoading(false)
        return
      }

      const data = result.client

      // Save session
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data))
      haptics.success()
      setUser(data)
      await loadServicios(waClean)

      // Register push notifications
      registerForPushNotifications().then(async (token) => {
        if (token) {
          await supabase.from('clientes_users').update({ push_token: token }).eq('id', data.id)
        }
      })
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', onPress: async () => {
          await AsyncStorage.removeItem(SESSION_KEY)
          setUser(null)
          setServicios([])
          setLoginWa('')
          setLoginPassword('')
        },
      },
    ])
  }

  const onRefresh = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    await loadServicios(user.whatsapp)
    setRefreshing(false)
  }, [user])

  const activos = servicios.filter(s => s.estado !== 'Completado' && s.estado !== 'Calificado' && s.estado !== 'Cancelado')
  const historial = servicios.filter(s => s.estado === 'Completado' || s.estado === 'Calificado' || s.estado === 'Cancelado')

  // Realtime subscription — notify when service status changes
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`servicios_cliente_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clientes', filter: `whatsapp=eq.${user.whatsapp}` },
        (payload) => {
          const updated = payload.new as Cliente
          // Update service in state
          setServicios(prev => prev.map(s => s.id === updated.id ? updated : s))
          // Send local notification for status change
          const notif = getStatusNotification(updated.estado, updated.servicio)
          if (notif) sendLocalNotification(notif.title, notif.body)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // ═══ LOGIN SCREEN ═══
  if (!user) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: THEME.space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInUp>
          <View style={{
            backgroundColor: THEME.color.surface,
            borderRadius: THEME.radius.xxl,
            padding: THEME.space.xxl,
            ...THEME.shadow.lg,
          }}>
            <View style={{
              width: 72, height: 72, borderRadius: THEME.radius.xl,
              backgroundColor: THEME.color.navy, alignItems: 'center', justifyContent: 'center',
              alignSelf: 'center', marginBottom: THEME.space.lg,
              ...THEME.shadow.md,
            }}>
              <Ionicons name="clipboard" size={30} color={THEME.color.white} />
            </View>
            <Text style={{ ...THEME.font.h1, color: THEME.color.ink, textAlign: 'center' }}>Mis Servicios</Text>
            <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs, marginBottom: THEME.space.xxl }}>
              Inicia sesión para ver tus solicitudes
            </Text>

            <Text style={{ ...THEME.font.label, color: THEME.color.ink, marginBottom: 6 }}>WhatsApp</Text>
            <TextInput
              placeholder="999 888 777"
              value={loginWa}
              onChangeText={setLoginWa}
              keyboardType="phone-pad"
              style={{
                backgroundColor: THEME.color.surfaceAlt,
                borderRadius: THEME.radius.lg,
                paddingHorizontal: THEME.space.lg,
                height: 52,
                ...THEME.font.body,
                color: THEME.color.ink,
                marginBottom: THEME.space.md,
              }}
              placeholderTextColor={THEME.color.inkMuted}
            />

            <Text style={{ ...THEME.font.label, color: THEME.color.ink, marginBottom: 6 }}>Contraseña</Text>
            <View style={{ position: 'relative', marginBottom: THEME.space.xs }}>
              <TextInput
                placeholder="Tu contraseña"
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry={!showPassword}
                style={{
                  backgroundColor: THEME.color.surfaceAlt,
                  borderRadius: THEME.radius.lg,
                  paddingHorizontal: THEME.space.lg,
                  paddingRight: 50,
                  height: 52,
                  ...THEME.font.body,
                  color: THEME.color.ink,
                }}
                placeholderTextColor={THEME.color.inkMuted}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: THEME.space.md, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 6 }}
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={THEME.color.inkMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/recuperar')}
              style={{ alignSelf: 'flex-end', marginBottom: THEME.space.lg, paddingVertical: THEME.space.xs }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.navy }}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <PressableScale
              onPress={doLogin}
              disabled={loading}
              accessibilityLabel="Ingresar"
              style={{
                backgroundColor: THEME.color.brand,
                borderRadius: THEME.radius.lg,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                ...THEME.shadow.brand,
              }}
            >
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
            </PressableScale>

            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: THEME.space.lg, gap: THEME.space.xs }}>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft }}>¿No tienes cuenta?</Text>
              <TouchableOpacity onPress={() => router.push('/registro-cliente')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.brand }}>Crear cuenta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </FadeInUp>
      </ScrollView>
    )
  }

  // ═══ MAIN SCREEN (logged in) ═══
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.color.brand} />}
    >
      {/* Header oscuro con saludo + stats */}
      <View style={{
        backgroundColor: THEME.color.navy,
        paddingHorizontal: THEME.space.xl,
        paddingTop: (StatusBar.currentHeight || 40) + 12,
        paddingBottom: THEME.space.xxl,
        borderBottomLeftRadius: THEME.radius.xxl,
        borderBottomRightRadius: THEME.radius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, flex: 1 }}>
            <View style={{
              width: 46, height: 46, borderRadius: THEME.radius.lg,
              backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ ...THEME.font.h3, fontWeight: '800', color: THEME.color.white }}>{user.nombre[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.h2, color: THEME.color.white }} numberOfLines={1}>Hola, {user.nombre.split(' ')[0]}</Text>
              <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {activos.length} servicio{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={logout}
            style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.lg }}>
          {[
            { label: 'Activos', value: activos.length },
            { label: 'Completados', value: historial.filter(s => s.estado === 'Completado' || s.estado === 'Calificado').length },
            { label: 'Total', value: servicios.length },
          ].map((stat) => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: THEME.radius.md, paddingVertical: THEME.space.md, alignItems: 'center' }}>
              <Text style={{ ...THEME.font.h1, color: THEME.color.white }}>{stat.value}</Text>
              <Text style={{ ...THEME.font.caption, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ padding: THEME.space.lg }}>
        {/* Quick action — solicitar nuevo servicio */}
        <FadeInUp delay={60}>
          <PressableScale
            onPress={() => router.push('/solicitar')}
            accessibilityLabel="Solicitar nuevo servicio"
            style={{
              backgroundColor: THEME.color.brand,
              borderRadius: THEME.radius.lg,
              height: 56,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm,
              marginBottom: THEME.space.lg,
              ...THEME.shadow.brand,
            }}
          >
            <Ionicons name="add-circle" size={22} color={THEME.color.white} />
            <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Solicitar nuevo servicio</Text>
          </PressableScale>
        </FadeInUp>

        {/* Loading skeletons */}
        {loading && servicios.length === 0 && (
          <FadeInUp delay={120}>
            <ServiceCardShimmer />
            <ServiceCardShimmer />
          </FadeInUp>
        )}

        {/* Active services */}
        {activos.length > 0 && (
          <FadeInUp delay={120}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginBottom: THEME.space.md }}>En curso</Text>
            {activos.map((s, i) => (
              <FadeInUp key={s.id} delay={150 + i * 60}>
                <ServiceCard service={s} router={router} user={user} />
              </FadeInUp>
            ))}
          </FadeInUp>
        )}

        {/* Empty state — sin servicios activos */}
        {activos.length === 0 && !loading && (
          <FadeInUp delay={120}>
            <View style={{
              backgroundColor: THEME.color.surface,
              borderRadius: THEME.radius.xxl,
              padding: THEME.space.xxxl,
              alignItems: 'center',
              marginBottom: THEME.space.lg,
              ...THEME.shadow.md,
            }}>
              <View style={{
                width: 88, height: 88, borderRadius: THEME.radius.full,
                backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center',
                marginBottom: THEME.space.lg,
              }}>
                <Ionicons name="sparkles-outline" size={40} color={THEME.color.brand} />
              </View>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Aún no tienes servicios activos</Text>
              <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.sm, lineHeight: 21 }}>
                Solicita un técnico y sigue tu pedido{'\n'}en tiempo real desde aquí.
              </Text>
              <PressableScale
                onPress={() => router.push('/solicitar')}
                accessibilityLabel="Solicitar mi primer servicio"
                style={{
                  marginTop: THEME.space.xl,
                  height: 52,
                  paddingHorizontal: THEME.space.xxl,
                  backgroundColor: THEME.color.brand,
                  borderRadius: THEME.radius.lg,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs,
                  ...THEME.shadow.brand,
                }}
              >
                <Ionicons name="add" size={18} color={THEME.color.white} />
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Solicitar técnico</Text>
              </PressableScale>
            </View>
          </FadeInUp>
        )}

        {/* History */}
        {historial.length > 0 && (
          <FadeInUp delay={180}>
            <Text style={{ ...THEME.font.h3, color: THEME.color.ink, marginTop: THEME.space.xs, marginBottom: THEME.space.md }}>Historial</Text>
            {historial.map((s, i) => (
              <FadeInUp key={s.id} delay={210 + i * 50}>
                <ServiceCard service={s} router={router} user={user} />
              </FadeInUp>
            ))}
          </FadeInUp>
        )}

        {/* Help */}
        <PressableScale
          onPress={() => Linking.openURL(waLink(SUPPORT_PHONE, 'Hola, necesito ayuda con un servicio en SOLU'))}
          accessibilityLabel="Contactar a soporte por WhatsApp"
          style={{
            marginTop: THEME.space.md,
            backgroundColor: THEME.color.surface,
            borderRadius: THEME.radius.lg,
            padding: THEME.space.md,
            flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
            ...THEME.shadow.sm,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: THEME.radius.md,
            backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="logo-whatsapp" size={20} color={THEME.color.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>¿Necesitas ayuda?</Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 1 }}>Contacta a soporte por WhatsApp</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={THEME.color.inkMuted} />
        </PressableScale>
      </View>
    </ScrollView>
  )
}

function ServiceCard({ service: s, router, user }: { service: Cliente; router: any; user: ClienteUser | null }) {
  const info = STATUS_INFO[s.estado] || { label: s.estado, color: THEME.color.inkSoft, bg: THEME.color.surfaceSunken, icon: 'help-circle' }
  const isActive = s.estado !== 'Completado' && s.estado !== 'Calificado' && s.estado !== 'Cancelado'
  const isCompleted = s.estado === 'Completado' || s.estado === 'Calificado'
  const date = new Date(s.created_at)
  const dateStr = date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <View
      style={{
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.xl,
        padding: THEME.space.lg,
        marginBottom: THEME.space.md,
        ...(isActive ? THEME.shadow.md : THEME.shadow.sm),
      }}
    >
      <PressableScale
        onPress={() => router.push({ pathname: '/tracking/[code]', params: { code: s.codigo } })}
        accessibilityLabel={`Ver seguimiento de ${s.servicio}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
          <View style={{
            width: 48, height: 48, borderRadius: THEME.radius.lg,
            backgroundColor: info.bg, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={info.icon as any} size={23} color={info.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: THEME.space.sm }}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink, flex: 1 }} numberOfLines={1}>{s.servicio}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: info.bg, borderRadius: THEME.radius.sm, paddingHorizontal: THEME.space.sm, paddingVertical: 4 }}>
                {isActive && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: info.color }} />}
                <Text style={{ ...THEME.font.caption, fontWeight: '800', color: info.color, letterSpacing: 0.3 }}>{info.label.toUpperCase()}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginTop: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="location-outline" size={12} color={THEME.color.inkMuted} />
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{s.distrito}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="calendar-outline" size={12} color={THEME.color.inkMuted} />
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{dateStr}</Text>
              </View>
            </View>
            {s.codigo && (
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>Código: {s.codigo}</Text>
            )}
          </View>
        </View>
      </PressableScale>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: THEME.space.sm, marginTop: THEME.space.md }}>
        {isActive && s.tecnico_asignado && user && (
          <PressableScale
            onPress={() => router.push({
              pathname: '/chat/[id]',
              params: {
                id: s.id.toString(),
                codigo: s.codigo,
                techName: 'Tecnico',
                clientName: user.nombre,
                senderType: 'cliente',
              },
            })}
            accessibilityLabel="Abrir chat con el técnico"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.color.navy, borderRadius: THEME.radius.md, paddingVertical: 10, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="chatbubbles" size={15} color={THEME.color.white} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Chat</Text>
          </PressableScale>
        )}
        {isActive && (
          <PressableScale
            onPress={() => router.push({ pathname: '/tracking/[code]', params: { code: s.codigo } })}
            accessibilityLabel="Ver seguimiento"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.md, paddingVertical: 10, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="navigate" size={15} color={THEME.color.info} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.info }}>Seguimiento</Text>
          </PressableScale>
        )}
        {isCompleted && (
          <PressableScale
            onPress={() => router.push({ pathname: '/solicitar', params: { servicio: s.servicio, distrito: s.distrito } })}
            accessibilityLabel="Re-agendar este servicio"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.color.brandLight, borderRadius: THEME.radius.md, paddingVertical: 10, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={15} color={THEME.color.brand} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.brandDark }}>Re-agendar</Text>
          </PressableScale>
        )}
        {s.estado === 'Completado' && (
          <PressableScale
            onPress={() => router.push({ pathname: '/calificar/[code]', params: { code: s.codigo } })}
            accessibilityLabel="Calificar este servicio"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.md, paddingVertical: 10, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="star" size={15} color={THEME.color.warning} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.warning }}>Calificar</Text>
          </PressableScale>
        )}
      </View>
    </View>
  )
}
