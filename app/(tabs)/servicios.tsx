import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Linking, RefreshControl, StatusBar } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SUPPORT_PHONE, waLink } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import { ENV } from '../../src/lib/env'
import { registerForPushNotifications, sendLocalNotification, getStatusNotification } from '../../src/lib/notifications'
import type { Cliente, ClienteUser } from '../../src/lib/types'

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  Nuevo: { label: 'Registrada', color: '#2563EB', icon: 'document-text' },
  Asignado: { label: 'Técnico asignado', color: '#F59E0B', icon: 'person' },
  'En camino': { label: 'En camino', color: '#8B5CF6', icon: 'car' },
  'En proceso': { label: 'En proceso', color: '#F97316', icon: 'hammer' },
  Completado: { label: 'Completado', color: '#10B981', icon: 'checkmark-circle' },
  Calificado: { label: 'Calificado', color: '#10B981', icon: 'star' },
  Cancelado: { label: 'Cancelado', color: '#EF4444', icon: 'close-circle' },
}

const SESSION_KEY = 'solu_client_session'

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
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('whatsapp', wa)
        .order('created_at', { ascending: false })
        .limit(30)
      setServicios(data || [])
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
      <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, elevation: 3 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
            <Ionicons name="clipboard" size={28} color="#fff" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark, textAlign: 'center', marginBottom: 4 }}>Mis Servicios</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginBottom: 24 }}>Inicia sesión para ver tus solicitudes</Text>

          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>WhatsApp</Text>
          <TextInput
            placeholder="999 888 777"
            value={loginWa}
            onChangeText={setLoginWa}
            keyboardType="phone-pad"
            style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: '600', marginBottom: 12 }}
            placeholderTextColor={COLORS.gray2}
          />

          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 6 }}>Contraseña</Text>
          <View style={{ position: 'relative', marginBottom: 4 }}>
            <TextInput
              placeholder="Tu contraseña"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry={!showPassword}
              style={{ backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16, paddingRight: 48, fontSize: 15, fontWeight: '600' }}
              placeholderTextColor={COLORS.gray2}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: 16 }}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.gray2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/recuperar')}
            style={{ alignSelf: 'flex-end', marginBottom: 16 }}
          >
            <Text style={{ fontSize: 11, color: '#1E3A5F', fontWeight: '600' }}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={doLogin}
            disabled={loading}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 4 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray }}>¿No tienes cuenta?</Text>
            <TouchableOpacity onPress={() => router.push('/registro-cliente')}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.pri }}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    )
  }

  // ═══ MAIN SCREEN (logged in) ═══
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A5F" />}
    >
      {/* Header */}
      <View style={{ backgroundColor: '#1E3A5F', padding: 20, paddingTop: (StatusBar.currentHeight || 40) + 10, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff' }}>{user.nombre[0]}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Hola, {user.nombre.split(' ')[0]}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{activos.length} servicio{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 8 }}>
            <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Activos', value: activos.length, color: '#10B981' },
            { label: 'Completados', value: historial.filter(s => s.estado === 'Completado' || s.estado === 'Calificado').length, color: '#2563EB' },
            { label: 'Total', value: servicios.length, color: 'rgba(255,255,255,0.6)' },
          ].map((stat) => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{stat.value}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ padding: 16 }}>
        {/* Quick action */}
        <TouchableOpacity
          onPress={() => router.push('/solicitar')}
          activeOpacity={0.85}
          style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, elevation: 4 }}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Solicitar nuevo servicio</Text>
        </TouchableOpacity>

        {/* Active services */}
        {activos.length > 0 && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>En curso</Text>
            {activos.map((s) => <ServiceCard key={s.id} service={s} router={router} user={user} />)}
          </>
        )}

        {activos.length === 0 && !loading && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 30, alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.gray2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark, marginTop: 10 }}>No tienes servicios pendientes</Text>
            <Text style={{ fontSize: 11, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>
              Toca el botón de arriba para solicitar un técnico
            </Text>
          </View>
        )}

        {/* History */}
        {historial.length > 0 && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginTop: 8, marginBottom: 10 }}>Historial</Text>
            {historial.map((s) => <ServiceCard key={s.id} service={s} router={router} user={user} />)}
          </>
        )}

        {/* Help */}
        <TouchableOpacity
          onPress={() => Linking.openURL(waLink(SUPPORT_PHONE, 'Hola, necesito ayuda con un servicio en SOLU'))}
          style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E2E8F0' }}
        >
          <Ionicons name="help-circle" size={20} color={COLORS.gray} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark }}>¿Necesitas ayuda?</Text>
            <Text style={{ fontSize: 10, color: COLORS.gray }}>Contacta a soporte por WhatsApp</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={COLORS.gray2} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function ServiceCard({ service: s, router, user }: { service: Cliente; router: any; user: ClienteUser | null }) {
  const info = STATUS_INFO[s.estado] || { label: s.estado, color: COLORS.gray, icon: 'help-circle' }
  const isActive = s.estado !== 'Completado' && s.estado !== 'Calificado' && s.estado !== 'Cancelado'
  const isCompleted = s.estado === 'Completado' || s.estado === 'Calificado'
  const date = new Date(s.created_at)
  const dateStr = date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <View
      style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
        borderLeftWidth: 4, borderLeftColor: info.color,
        elevation: isActive ? 3 : 1,
        shadowColor: info.color,
        shadowOffset: { width: 0, height: isActive ? 4 : 1 },
        shadowOpacity: isActive ? 0.15 : 0.05,
        shadowRadius: 8,
      }}
    >
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/tracking/[code]', params: { code: s.codigo } })}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: info.color + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={info.icon as any} size={22} color={info.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1 }} numberOfLines={1}>{s.servicio}</Text>
              <View style={{ backgroundColor: info.color + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: info.color }}>{info.label.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 3 }}>
              📍 {s.distrito}  ·  🗓 {dateStr}
            </Text>
            {s.codigo && (
              <Text style={{ fontSize: 10, color: COLORS.gray2, marginTop: 2 }}>Código: {s.codigo}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {isActive && s.tecnico_asignado && user && (
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/chat/[id]',
              params: {
                id: s.id.toString(),
                techId: s.tecnico_asignado!.toString(),
                techName: 'Tecnico',
                clientName: user.nombre,
                senderType: 'cliente',
                senderId: user.id.toString(),
              },
            })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="chatbubbles" size={14} color="#fff" />
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>Chat</Text>
          </TouchableOpacity>
        )}
        {isActive && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/tracking/[code]', params: { code: s.codigo } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="navigate" size={14} color="#2563EB" />
            <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>Seguimiento</Text>
          </TouchableOpacity>
        )}
        {isCompleted && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/solicitar', params: { servicio: s.servicio, distrito: s.distrito } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.priLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={14} color={COLORS.pri} />
            <Text style={{ fontSize: 12, color: COLORS.pri, fontWeight: '700' }}>Re-agendar</Text>
          </TouchableOpacity>
        )}
        {s.estado === 'Completado' && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/calificar/[code]', params: { code: s.codigo } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flex: 1, justifyContent: 'center' }}
          >
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '700' }}>Calificar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}
