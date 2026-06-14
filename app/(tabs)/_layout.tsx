import { useState, useCallback } from 'react'
import { Tabs, useRouter, useFocusEffect } from 'expo-router'
import { View, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getTechToken, fetchNotifications } from '../../src/lib/notif-api'
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

export default function TabLayout() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 16)
  const [unreadCount, setUnreadCount] = useState(0)

  // Los técnicos se autentican con Bearer (no Supabase Auth) y la tabla
  // `notificaciones` está en deny-all para anon tras el lockdown RLS: por eso
  // el contador va contra el endpoint server-side autenticado, no a Supabase.
  // Se refresca al volver al foco para reflejar lo leído en Mi Cuenta.
  useFocusEffect(
    useCallback(() => {
      let activo = true
      async function fetchUnread() {
        try {
          const raw = await AsyncStorage.getItem('solu_tech_session')
          if (!raw) {
            if (activo) setUnreadCount(0)
            return
          }
          const session = JSON.parse(raw) as { id?: number; token?: string }
          const token = await getTechToken()
          if (!session?.id || !token) {
            if (activo) setUnreadCount(0)
            return
          }
          const notifs = await fetchNotifications(token, 50, session.id)
          if (activo) setUnreadCount(notifs.filter((n) => !n.leido).length)
        } catch (err) {
          logger.error('No se pudo cargar el contador de notificaciones:', err)
        }
      }
      fetchUnread()
      return () => {
        activo = false
      }
    }, []),
  )

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
              {unreadCount > 0 && (
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
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
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
      <Tabs.Screen name="cuenta" options={{ href: null }} />
      <Tabs.Screen name="vecinos" options={{ href: null }} />
    </Tabs>
  )
}
