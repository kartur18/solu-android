import { useEffect, useState, type ComponentType } from 'react'
import { View, Text, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { THEME } from '../../src/lib/theme'
import { modoInicial, type ModoCuenta } from '../../src/lib/modo-cuenta'
import { cambiarModo, leerCuentasEnDispositivo, leerModoActivo, olvidarModo, onModoChange } from '../../src/lib/modo-sesion'
import { FadeInUp, PressableScale } from '../../src/components/ui/Motion'

export default function MiCuentaScreen() {
  const [selected, setSelected] = useState<ModoCuenta | null>(null)
  // true mientras se consulta la sesión guardada (evita el flash del selector)
  const [restaurando, setRestaurando] = useState(true)

  // Con sesión guardada se entra directo a su lado: manda el último modo que
  // eligió (si esa cuenta sigue abierta), si no gana técnico — el panel es su
  // pantalla diaria. El selector queda para quien no tiene ninguna.
  useEffect(() => {
    let activo = true
    void (async () => {
      try {
        const [guardado, cuentas] = await Promise.all([leerModoActivo(), leerCuentasEnDispositivo()])
        if (activo) setSelected(modoInicial(guardado, cuentas))
      } finally {
        if (activo) setRestaurando(false)
      }
    })()
    return () => { activo = false }
  }, [])

  // El panel del técnico y la pantalla del cliente cambian el modo desde su
  // propio header: acá se refleja sin cerrar ninguna de las dos sesiones.
  useEffect(() => onModoChange((modo) => setSelected(modo)), [])

  // Volver al selector: se olvida la elección para que la próxima apertura no
  // la reimponga.
  function volverAElegir() {
    olvidarModo()
    setSelected(null)
  }

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
            onPress={() => cambiarModo('cliente')}
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
            onPress={() => cambiarModo('tecnico')}
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
    return <ClienteRedirect onBack={volverAElegir} onCambiarModo={() => setSelected('tecnico')} />
  }
  return <TecnicoRedirect onBack={volverAElegir} onCambiarModo={() => setSelected('cliente')} />
}

// Barra de "volver" propia, en flujo normal.
//
// Antes flotaba con position:absolute sobre la pantalla embebida, en el mismo
// x/y que el avatar de su header (cliente y técnico lo tienen arriba a la
// izquierda): el botón caía justo encima de la foto de perfil y la tapaba.
// Ocupando su propia barra nada queda debajo de nada.
// El cambio de modo NO vive acá: cada panel lo ofrece en su propio header
// (CambiarModo), que también funciona cuando se abre sin pasar por Mi cuenta.
function VolverBar({ onBack, titulo }: {
  onBack: () => void
  titulo: string
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
    </View>
  )
}

// Las dos pantallas se montan embebidas: reciben onCambiarModo para que su
// entrada de cambio de modo se refleje acá sin remontar ni navegar.
type PantallaEmbebida = ComponentType<{ onCambiarModo?: () => void }>

function ClienteRedirect({ onBack, onCambiarModo }: { onBack: () => void; onCambiarModo: () => void }) {
  // Import and render servicios screen inline
  const ServiciosScreen = require('./servicios').default as PantallaEmbebida
  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.navy }}>
      <VolverBar onBack={onBack} titulo="Estás como cliente" />
      <ServiciosScreen onCambiarModo={onCambiarModo} />
    </View>
  )
}

function TecnicoRedirect({ onBack, onCambiarModo }: { onBack: () => void; onCambiarModo: () => void }) {
  const CuentaScreen = require('./cuenta').default as PantallaEmbebida
  return (
    <View style={{ flex: 1, backgroundColor: THEME.color.navy }}>
      <VolverBar onBack={onBack} titulo="Estás como técnico" />
      <CuentaScreen onCambiarModo={onCambiarModo} />
    </View>
  )
}
