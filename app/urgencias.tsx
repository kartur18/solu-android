import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator, StatusBar } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink, ESTADOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { useLocationDetection } from '../src/lib/useLocation'

const EMERGENCIAS = [
  { name: 'Fuga de agua', icon: 'water' as const, color: '#3B82F6', oficio: 'Gasfitero', desc: 'Tuberías, inundación' },
  { name: 'Corte de luz', icon: 'flash' as const, color: '#F59E0B', oficio: 'Electricista', desc: 'Sin energía, chispas' },
  { name: 'Cerrajería', icon: 'key' as const, color: '#EF4444', oficio: 'Cerrajero', desc: 'No puedo entrar' },
  { name: 'Fuga de gas', icon: 'flame' as const, color: '#DC2626', oficio: 'Gasfitero', desc: 'Olor a gas, peligro' },
]

export default function UrgenciasScreen() {
  const router = useRouter()
  const location = useLocationDetection()
  const [selected, setSelected] = useState<typeof EMERGENCIAS[0] | null>(null)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [assignedTech, setAssignedTech] = useState<any>(null)

  useEffect(() => { location.detectLocation() }, [])

  // Pre-fill from saved client session
  useEffect(() => {
    AsyncStorage.getItem('solu_client_session').then((stored) => {
      if (stored) {
        try {
          const user = JSON.parse(stored)
          if (user.nombre && !nombre) setNombre(user.nombre)
          if (user.whatsapp && !whatsapp) setWhatsapp(user.whatsapp)
        } catch {}
      }
    })
  }, [])

  async function handleSearch() {
    if (!selected) return Alert.alert('Aviso', 'Por favor selecciona el tipo de emergencia')
    if (!nombre.trim() || !whatsapp.trim()) return Alert.alert('Aviso', 'Necesitamos tu Nombre y WhatsApp para que el técnico te responda.')
    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) return Alert.alert('Aviso', 'Ingresa un WhatsApp válido de 9 dígitos.')

    setLoading(true)
    try {
      const distrito = location.distrito || 'Lima'

      // Automate: Find available tech
      const { data: techs } = await supabase
        .from('tecnicos')
        .select('*')
        .eq('disponible', true)
        .ilike('oficio', `%${selected.oficio}%`)
        .order('calificacion', { ascending: false })
        .limit(5)

      const localTech = techs?.find(t => t.distrito?.toLowerCase() === distrito.toLowerCase())
      const bestTech = localTech || techs?.[0] || null

      if (!bestTech) {
        Alert.alert('Lo sentimos', 'En este momento exacto no hay técnicos disponibles para esa emergencia. Intenta buscar en la pantalla principal.')
        setLoading(false)
        return
      }

      // Create service silently
      const code = `URG-${Date.now().toString(36).toUpperCase()}`
      await supabase.from('clientes').insert({
        nombre,
        whatsapp: waClean,
        servicio: `🚨 URGENCIA: ${selected.name}`,
        distrito,
        urgencia: 'emergencia',
        descripcion: `Emergencia urgente enviada desde la app.`,
        estado: ESTADOS.ASIGNADO,
        tecnico_asignado: bestTech.id,
        codigo: code,
      })

      setAssignedTech(bestTech)
    } catch (err) {
      Alert.alert('Error', 'Hubo un problema. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // --- SUCCESS SCREEN (TECH FOUND) ---
  if (assignedTech) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20, paddingTop: (StatusBar.currentHeight || 40) + 20 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 6 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="checkmark-circle" size={40} color="#10B981" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.dark, textAlign: 'center', marginBottom: 6 }}>¡Técnico Encontrado!</Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginBottom: 24 }}>Se ha asignado automáticamente un especialista para resolver tu problema ahora mismo.</Text>

          <View style={{ width: '100%', backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#065F46', marginBottom: 4 }}>{assignedTech.nombre}</Text>
            <Text style={{ fontSize: 12, color: '#065F46' }}>Especialidad: {assignedTech.oficio}</Text>
            <Text style={{ fontSize: 12, color: '#065F46' }}>Ubicación actual: {assignedTech.distrito}</Text>
          </View>

          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:+51${assignedTech.whatsapp}`)}
            style={{ width: '100%', backgroundColor: '#1E3A5F', borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 12 }}
          >
            <Ionicons name="call" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Llamar al Técnico Ahora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL(waLink(assignedTech.whatsapp, `🚨 URGENCIA SOLU: Hola ${assignedTech.nombre}, necesito tu ayuda inmediata con: ${selected?.name}. Mi nombre es ${nombre}.`))}
            style={{ width: '100%', backgroundColor: '#25D366', borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Escribirle al WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.pri }}>← Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // --- SEARCH SCREEN ---
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ backgroundColor: '#7F1D1D', padding: 24, paddingTop: (StatusBar.currentHeight || 40) + 16, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, elevation: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="warning" size={24} color="#FDE68A" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>SOS Automático</Text>
        </View>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '600', lineHeight: 22 }}>
          Encuentra un técnico libre en segundos para emergencias críticas del hogar.
        </Text>
      </View>

      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>1. ¿Qué se rompió?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {EMERGENCIAS.map((e) => (
            <TouchableOpacity
              key={e.name}
              onPress={() => setSelected(e)}
              style={{
                width: '48%', backgroundColor: selected?.name === e.name ? e.color + '15' : '#fff',
                borderRadius: 16, padding: 16, borderWidth: 2,
                borderColor: selected?.name === e.name ? e.color : '#E2E8F0',
                alignItems: 'center'
              }}
            >
              <Ionicons name={e.icon} size={32} color={e.color} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.dark, textAlign: 'center' }}>{e.name}</Text>
              <Text style={{ fontSize: 10, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>{e.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>2. Datos rápidos de contacto</Text>
        <TextInput
          value={nombre} onChangeText={setNombre}
          placeholder="Tu Nombre"
          style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
        />
        <TextInput
          value={whatsapp} onChangeText={setWhatsapp}
          placeholder="Tu celular (WhatsApp)" keyboardType="phone-pad"
          style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, fontSize: 15, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' }}
        />

        <TouchableOpacity
          onPress={handleSearch}
          disabled={loading}
          style={{ backgroundColor: '#DC2626', borderRadius: 16, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, elevation: 8 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="search" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 }}>ASIGNAR TÉCNICO AHORA</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
