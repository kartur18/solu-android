import { useState, useEffect } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'

const ACTIVE_COLOR = '#1E3A5F'
const INACTIVE_COLOR = '#9CA3AF'

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
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 10)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    async function fetchUnread() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { count } = await supabase
          .from('notificaciones')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('leida', false)
        setUnreadCount(count || 0)
      } catch {}
    }
    fetchUnread()
  }, [])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          shadowColor: '#1E3A5F',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        headerStyle: { backgroundColor: COLORS.white, shadowColor: 'transparent', elevation: 0 },
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: COLORS.dark },
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
                  backgroundColor: '#EF4444',
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                  borderWidth: 1.5,
                  borderColor: COLORS.white,
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
      {/* Hidden tabs */}
      <Tabs.Screen name="servicios" options={{ href: null }} />
      <Tabs.Screen name="cuenta" options={{ href: null }} />
      <Tabs.Screen name="vecinos" options={{ href: null }} />
    </Tabs>
  )
}
