import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'

export default function MiCuentaScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<'cliente' | 'tecnico' | null>(null)

  if (!selected) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', padding: 24 }}>
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="person-circle" size={36} color="#fff" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.dark }}>Mi Cuenta</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>¿Cómo quieres ingresar?</Text>
        </View>

        {/* Client option */}
        <TouchableOpacity
          onPress={() => setSelected('cliente')}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            borderWidth: 2, borderColor: '#E2E8F0', elevation: 2,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.pri + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="home" size={28} color={COLORS.pri} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.dark }}>Soy cliente</Text>
            <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>Necesito un técnico para mi hogar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray2} />
        </TouchableOpacity>

        {/* Technician option */}
        <TouchableOpacity
          onPress={() => setSelected('tecnico')}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#1E3A5F', borderRadius: 16, padding: 20,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            elevation: 4,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="construct" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>Soy técnico</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Quiero recibir clientes y crecer</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
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
      <TouchableOpacity
        onPress={onBack}
        style={{ position: 'absolute', top: 12, left: 16, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 8, elevation: 3 }}
      >
        <Ionicons name="arrow-back" size={20} color="#1E3A5F" />
      </TouchableOpacity>
      <ServiciosScreen />
    </View>
  )
}

function TecnicoRedirect({ router, onBack }: { router: any; onBack: () => void }) {
  const CuentaScreen = require('./cuenta').default
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={onBack}
        style={{ position: 'absolute', top: 12, left: 16, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 8, elevation: 3 }}
      >
        <Ionicons name="arrow-back" size={20} color="#1E3A5F" />
      </TouchableOpacity>
      <CuentaScreen />
    </View>
  )
}
