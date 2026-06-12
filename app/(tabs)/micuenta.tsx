import { useState } from 'react'
import { View, Text, ScrollView, StatusBar } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale } from '../../src/components/ui/Motion'

export default function MiCuentaScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<'cliente' | 'tecnico' | null>(null)

  if (!selected) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, justifyContent: 'center', padding: THEME.space.xxl }}>
        {/* Header */}
        <FadeInUp delay={0}>
          <View style={{ alignItems: 'center', marginBottom: THEME.space.xxxl }}>
            <View style={{ width: 80, height: 80, borderRadius: THEME.radius.xxl, backgroundColor: THEME.color.navy, alignItems: 'center', justifyContent: 'center', marginBottom: THEME.space.lg, ...THEME.shadow.lg }}>
              <Ionicons name="person-circle" size={40} color={THEME.color.white} />
            </View>
            <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>Mi cuenta</Text>
            <Text style={{ ...THEME.font.body, color: THEME.color.inkSoft, marginTop: THEME.space.xs }}>¿Cómo quieres ingresar?</Text>
          </View>
        </FadeInUp>

        {/* Client option */}
        <FadeInUp delay={60}>
          <PressableScale
            onPress={() => setSelected('cliente')}
            accessibilityLabel="Ingresar como cliente"
            style={{
              backgroundColor: THEME.color.surface, borderRadius: THEME.radius.xl, padding: THEME.space.xl, marginBottom: THEME.space.md,
              flexDirection: 'row', alignItems: 'center', gap: THEME.space.lg,
              ...THEME.shadow.md,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: THEME.radius.lg, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="home" size={28} color={THEME.color.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Soy cliente</Text>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 2 }}>Necesito un técnico para mi hogar</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={THEME.color.inkMuted} />
          </PressableScale>
        </FadeInUp>

        {/* Technician option */}
        <FadeInUp delay={120}>
          <PressableScale
            onPress={() => setSelected('tecnico')}
            accessibilityLabel="Ingresar como técnico"
            style={{
              backgroundColor: THEME.color.navy, borderRadius: THEME.radius.xl, padding: THEME.space.xl,
              flexDirection: 'row', alignItems: 'center', gap: THEME.space.lg,
              ...THEME.shadow.lg,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: THEME.radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="construct" size={28} color={THEME.color.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.h3, color: THEME.color.white }}>Soy técnico</Text>
              <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Quiero recibir clientes y crecer</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
          </PressableScale>
        </FadeInUp>
      </View>
    )
  }

  // Redirect to the correct panel
  if (selected === 'cliente') {
    return <ClienteRedirect router={router} onBack={() => setSelected(null)} />
  }
  return <TecnicoRedirect router={router} onBack={() => setSelected(null)} />
}

function ClienteRedirect({ router, onBack }: { router: any; onBack: () => void }) {
  // Import and render servicios screen inline
  const ServiciosScreen = require('./servicios').default
  return (
    <View style={{ flex: 1 }}>
      <PressableScale
        onPress={onBack}
        accessibilityLabel="Volver"
        style={{ position: 'absolute', top: (StatusBar.currentHeight || 40) + 4, left: THEME.space.lg, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: THEME.radius.full, padding: THEME.space.sm, ...THEME.shadow.md }}
      >
        <Ionicons name="arrow-back" size={20} color={THEME.color.navy} />
      </PressableScale>
      <ServiciosScreen />
    </View>
  )
}

function TecnicoRedirect({ router, onBack }: { router: any; onBack: () => void }) {
  const CuentaScreen = require('./cuenta').default
  return (
    <View style={{ flex: 1 }}>
      <PressableScale
        onPress={onBack}
        accessibilityLabel="Volver"
        style={{ position: 'absolute', top: (StatusBar.currentHeight || 40) + 4, left: THEME.space.lg, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: THEME.radius.full, padding: THEME.space.sm, ...THEME.shadow.md }}
      >
        <Ionicons name="arrow-back" size={20} color={THEME.color.navy} />
      </PressableScale>
      <CuentaScreen />
    </View>
  )
}
