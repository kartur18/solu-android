import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'

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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
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
        name="vecinos"
        options={{
          title: 'Vecinos',
          tabBarLabel: 'Vecinos',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconFilled="people" iconOutline="people-outline" />,
        }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{
          title: 'Mi cuenta',
          tabBarLabel: 'Cuenta',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} iconFilled="person" iconOutline="person-outline" />,
        }}
      />
    </Tabs>
  )
}
