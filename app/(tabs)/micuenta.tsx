import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../src/lib/theme'
import { getTechSessionMeta } from '../../src/lib/tech-session'
import { FadeInUp, PressableScale } from '../../src/components/ui/Motion'

export default function MiCuentaScreen() {
  const [selected, setSelected] = useState<'cliente' | 'tecnico' | null>(null)
  // true mientras se consulta la sesión guardada (evita el flash del selector)
  const [restaurando, setRestaurando] = useState(true)

  // Con sesión de técnico guardada, el panel es su pantalla diaria: entrar
  // directo en vez de hacerle tocar "Soy técnico" en cada arranque frío.
  useEffect(() => {
    let activo = true
    void (async () => {
      try {
        const session = await getTechSessionMeta()
        if (activo && session?.id) setSelected('tecnico')
      } finally {
        if (activo) setRestaurando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  if (restaurando) {
    return <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }} />
  }

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
    return <ClienteRedirect onBack={() => setSelected(null)} />
  }
  return <TecnicoRedirect onBack={() => setSelected(null)} onEntrarCliente={() => setSelected('cliente')} />
}

// Barra de "volver" propia, en flujo normal.
//
// Antes flotaba con position:absolute sobre la pantalla embebida, en el mismo
// x/y que el avatar de su header (cliente y técnico lo tienen arriba a la
// izquierda): el botón caía justo encima de la foto de perfil y la tapaba.
// Ocupando su propia barra nada queda debajo de nada.
function VolverBar({ onBack, titulo, accion }: {
  onBack: () => void
  titulo: string
  accion?: { label: string; onPress: () => void }
}) {
  return (
    <View style={{
      backgroundColor: THEME.color.navy,
      paddingTop: (StatusBar.currentHeight || 40) + THEME.space.xs,
      paddingHorizontal: THEME.space.lg,
      paddingBottom: THEME.space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: THEME.space.md,
    }}>
      <PressableScale
        onPress={onBack}
        accessibilityLabel="Volver a elegir cómo ingresar"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: 40, height: 40, borderRadius: THEME.radius.full, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="arrow-back" size={20} color={THEME.color.white} />
      </PressableScale>
      <Text numberOfLines={1} style={{ ...THEME.font.label, fontWeight: '700', color: 'rgba(255,255,255,0.75)', flex: 1 }}>
        {titulo}
      </Text>
      {accion && (
        <PressableScale
          onPress={accion.onPress}
          accessibilityLabel={accion.label}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: THEME.space.sm }}
        >
          <Text style={{ ...THEME.font.caption, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }}>
            {accion.label}
          </Text>
        </PressableScale>
      )}
    </View>
  )
}

function ClienteRedirect({ onBack }: { onBack: () => void }) {
  // Import and render servicios screen inline
  const ServiciosScreen = require('./servicios').default
  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.navy }}>
      <VolverBar onBack={onBack} titulo="Estás como cliente" />
      <ServiciosScreen />
    </View>
  )
}

function TecnicoRedirect({ onBack, onEntrarCliente }: { onBack: () => void; onEntrarCliente: () => void }) {
  const CuentaScreen = require('./cuenta').default
  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.navy }}>
      {/* Link chico para el técnico que también pide servicios como cliente
          (con auto-selección, este es su camino de vuelta al lado cliente). */}
      <VolverBar
        onBack={onBack}
        titulo="Estás como técnico"
        accion={{ label: 'Entrar como cliente', onPress: onEntrarCliente }}
      />
      <CuentaScreen />
    </View>
  )
}
