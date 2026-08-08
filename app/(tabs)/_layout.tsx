import { useState, useCallback, useEffect, useRef } from 'react'
import { Tabs, useRouter, useFocusEffect } from 'expo-router'
import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getTechToken, fetchNotifications } from '../../src/lib/notif-api'
import { getTechSessionMeta, onTechSessionChange } from '../../src/lib/tech-session'
import { fetchChatsResumen } from '../../src/components/tecnico/lead-api'
import { logger } from '../../src/lib/logger'
import { THEME } from '../../src/lib/theme'

const ACTIVE_COLOR = THEME.color.brand
const INACTIVE_COLOR = THEME.color.inkMuted

type IconName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ focused, iconFilled, iconOutline }: { focused: boolean; iconFilled: IconName; iconOutline: IconName }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {focused && (
        <View style={{
          position: 'absolute',
          top: -8,
          width: 24,
          height: 3,
          borderRadius: 2,
          backgroundColor: ACTIVE_COLOR,
        }} />
      )}
      <Ionicons
        name={focused ? iconFilled : iconOutline}
        size={22}
        color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
      />
    </View>
  )
}

// Contador sobre el ícono de una pestaña (notificaciones / mensajes sin leer).
function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <View style={{
      position: 'absolute',
      top: -4,
      right: -10,
      backgroundColor: THEME.color.danger,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: THEME.color.surface,
    }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  )
}

export default function TabLayout() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 16)
  const [unreadCount, setUnreadCount] = useState(0)
  // La bandeja solo tiene sentido con sesión de técnico: al cliente no se le
  // muestra la pestaña.
  const [esTecnico, setEsTecnico] = useState(false)
  const [mensajesNuevos, setMensajesNuevos] = useState(0)

  // Ref de montaje para que las cargas asíncronas no seteen estado tras desmontar.
  const montadoRef = useRef(true)
  useEffect(() => {
    montadoRef.current = true
    return () => { montadoRef.current = false }
  }, [])

  // Los técnicos se autentican con Bearer (no Supabase Auth) y la tabla
  // `notificaciones` está en deny-all para anon tras el lockdown RLS: por eso
  // el contador va contra el endpoint server-side autenticado, no a Supabase.
  const fetchUnread = useCallback(async () => {
    try {
      const session = await getTechSessionMeta()
      const token = await getTechToken()
      if (!session?.id || !token) {
        if (montadoRef.current) {
          setEsTecnico(false)
          setUnreadCount(0)
          setMensajesNuevos(0)
        }
        return
      }
      if (montadoRef.current) setEsTecnico(true)

      // Independientes: que fallen las notificaciones no debe dejar la
      // bandeja sin badge (ni al revés).
      const [notifs, chats] = await Promise.allSettled([
        fetchNotifications(token, 50, session.id),
        fetchChatsResumen(token),
      ])
      if (!montadoRef.current) return
      if (notifs.status === 'fulfilled') {
        setUnreadCount(notifs.value.filter((n) => !n.leido).length)
      }
      if (chats.status === 'fulfilled') {
        setMensajesNuevos(chats.value.reduce((sum, c) => sum + c.mensajes_nuevos, 0))
      }
    } catch (err) {
      logger.error('No se pudo cargar el contador de notificaciones:', err)
    }
  }, [])

  // Se refresca al volver al foco para reflejar lo leído en Mi Cuenta.
  useFocusEffect(
    useCallback(() => {
      fetchUnread()
    }, [fetchUnread]),
  )

  // Y también apenas cambia la sesión (login/logout): antes la pestaña
  // "Mensajes" no aparecía hasta reiniciar la app porque el estado solo se
  // recalculaba al enfocar, y tras loguearse la barra ya estaba montada.
  useEffect(() => onTechSessionChange(() => { void fetchUnread() }), [fetchUnread])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: THEME.color.surface,
          borderTopWidth: 1,
          borderTopColor: THEME.color.lineSoft,
          height: 64 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          shadowColor: THEME.color.ink,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        headerStyle: { backgroundColor: THEME.color.surface, shadowColor: 'transparent', elevation: 0 },
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: THEME.color.ink },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'SOLU',
          headerShown: false,
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconFilled="home" iconOutline="home-outline" />,
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar técnico',
          tabBarLabel: 'Buscar',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconFilled="search" iconOutline="search-outline" />,
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: 'Mensajes',
          tabBarLabel: 'Mensajes',
          // Sin sesión de técnico la pestaña no existe para el cliente.
          href: esTecnico ? '/(tabs)/mensajes' : null,
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon focused={focused} iconFilled="chatbubbles" iconOutline="chatbubbles-outline" />
              <TabBadge count={mensajesNuevos} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="urgencias-tab"
        listeners={{
          tabPress: (e) => {
            e.preventDefault()
            router.push('/soporte')
          },
        }}
        options={{
          title: 'Soporte',
          headerShown: false,
          tabBarLabel: 'Soporte',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconFilled="headset" iconOutline="headset-outline" />,
        }}
      />
      <Tabs.Screen
        name="micuenta"
        options={{
          title: 'Mi Cuenta',
          headerShown: false,
          tabBarLabel: 'Mi Cuenta',
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon focused={focused} iconFilled="person-circle" iconOutline="person-circle-outline" />
              <TabBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="servicios"
        options={{
          href: null,
        }}
      />
      {/* Fuera del tab bar pero navegable: la bandeja manda acá. Sin título
          propio la cabecera decía "cuenta" (el nombre del archivo). */}
      <Tabs.Screen name="cuenta" options={{ href: null, title: 'Mi cuenta de técnico' }} />
      <Tabs.Screen name="vecinos" options={{ href: null }} />
    </Tabs>
  )
}
