import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink, DISTRITOS, SUPPORT_PHONE, ESTADOS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'
import { useLocationDetection } from '../src/lib/useLocation'

const EMERGENCIAS = [
  { name: 'Fuga de agua', icon: 'water' as const, color: '#3B82F6', oficio: 'Gasfitero', desc: 'Tubería rota, inundación, fuga de agua' },
  { name: 'Corte de luz', icon: 'flash' as const, color: '#F59E0B', oficio: 'Electricista', desc: 'Sin electricidad, cortocircuito, chispas' },
  { name: 'Cerradura trabada', icon: 'key' as const, color: '#EF4444', oficio: 'Cerrajero', desc: 'No puedo entrar a mi casa, llave rota' },
  { name: 'Fuga de gas', icon: 'flame' as const, color: '#DC2626', oficio: 'Gasfitero', desc: 'Olor a gas, conexión de gas dañada' },
  { name: 'Atoro de desagüe', icon: 'water' as const, color: '#8B5CF6', oficio: 'Gasfitero', desc: 'Desagüe tapado, agua estancada' },
  { name: 'Otro', icon: 'alert-circle' as const, color: '#6B7280', oficio: '', desc: 'Otra emergencia del hogar' },
]

export default function UrgenciasScreen() {
  const router = useRouter()
  const location = useLocationDetection()
  const [selected, setSelected] = useState<typeof EMERGENCIAS[0] | null>(null)
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [direccion, setDireccion] = useState('')
  const [detalle, setDetalle] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [assignedTech, setAssignedTech] = useState<any>(null)

  // Auto-detect location
  useEffect(() => { location.detectLocation() }, [])

  async function handleSubmit() {
    if (!selected) return Alert.alert('Error', 'Selecciona el tipo de emergencia')
    if (!nombre.trim() || !whatsapp.trim()) return Alert.alert('Error', 'Completa nombre y WhatsApp')

    const waClean = whatsapp.replace(/\D/g, '')
    if (waClean.length !== 9 || !/^9\d{8}$/.test(waClean)) return Alert.alert('Error', 'Ingresa un número de WhatsApp válido (9 dígitos, empieza con 9)')

    setLoading(true)
    try {
      const distrito = location.distrito || 'Lima'

      // Find available tech for this emergency
      let query = supabase
        .from('tecnicos')
        .select('*')
        .eq('disponible', true)

      if (selected.oficio) {
        query = query.or(`oficio.ilike.%${selected.oficio}%`)
      }

      const { data: techs } = await query
        .order('calificacion', { ascending: false })
        .limit(5)

      // Prefer tech in same district
      const localTech = techs?.find(t => t.distrito?.toLowerCase() === distrito.toLowerCase())
      const bestTech = localTech || techs?.[0] || null

      // Create urgent service request
      const code = `URG-${Date.now().toString(36).toUpperCase()}`
      await supabase.from('clientes').insert({
        nombre,
        whatsapp,
        servicio: `🚨 URGENCIA: ${selected.name}`,
        distrito,
        urgencia: 'emergencia',
        descripcion: `${selected.desc}${detalle ? '. ' + detalle : ''}${direccion ? '. Dirección: ' + direccion : ''}`,
        estado: bestTech ? ESTADOS.ASIGNADO : ESTADOS.NUEVO,
        tecnico_asignado: bestTech?.id || null,
        codigo: code,
        created_at: new Date().toISOString(),
      })

      setAssignedTech(bestTech)
      setSent(true)
    } catch (err) {
      Alert.alert('Error', 'No se pudo enviar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="checkmark-circle" size={36} color={COLORS.green} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.dark, textAlign: 'center' }}>
            ¡Solicitud de emergencia enviada!
          </Text>

          {assignedTech ? (
            <View style={{ marginTop: 16, width: '100%' }}>
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.green, marginBottom: 6 }}>✅ Técnico asignado:</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark }}>{assignedTech.nombre}</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>{assignedTech.oficio} · {assignedTech.distrito}</Text>
                {assignedTech.calificacion > 0 && (
                  <Text style={{ fontSize: 11, color: COLORS.pri, marginTop: 2 }}>★ {assignedTech.calificacion.toFixed(1)} ({assignedTech.num_resenas} reseñas)</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={() => Linking.openURL(waLink(assignedTech.whatsapp, `🚨 URGENCIA SOLU: Hola ${assignedTech.nombre}, necesito ayuda urgente con: ${selected?.name}. Mi nombre es ${nombre}. ${direccion ? 'Dirección: ' + direccion : ''}`))}
                style={{ backgroundColor: '#25D366', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Contactar por WhatsApp ahora</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { if (assignedTech.whatsapp) { const phone = assignedTech.whatsapp.length === 9 ? '51' + assignedTech.whatsapp : assignedTech.whatsapp; Linking.openURL(`tel:+${phone}`) }}}
                style={{ backgroundColor: '#1E3A5F', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Llamar ahora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 16, width: '100%' }}>
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>⏳ Buscando técnico disponible...</Text>
                <Text style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>Te notificaremos cuando un técnico acepte tu emergencia</Text>
              </View>

              <TouchableOpacity
                onPress={() => Linking.openURL(waLink(SUPPORT_PHONE, `🚨 URGENCIA: Necesito ${selected?.name} urgente. Soy ${nombre}, mi WhatsApp es ${whatsapp}. ${direccion ? 'Dirección: ' + direccion : ''}`))}
                style={{ backgroundColor: '#DC2626', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Llamar a soporte SOLU</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 13 }}>← Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Header Emergencia Premium */}
      <View style={{ backgroundColor: '#7F1D1D', padding: 24, paddingTop: 48, paddingBottom: 32, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/') }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 }}>
            <Ionicons name="warning" size={24} color="#FDE68A" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>Emergencia 24/7</Text>
        </View>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 10, fontWeight: '600', lineHeight: 20 }}>
          Conectamos con un técnico de emergencia en tu zona lo más rápido posible
        </Text>
        <View style={{ backgroundColor: 'rgba(220,38,38,0.4)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' }}>
          <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '900' }}>⚡ Respuesta en menos de 30 min</Text>
        </View>
        {location.distrito && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>📍 {location.distrito}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 16 }}>
        {/* Quick action buttons */}
        <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>Solicitar ahora</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.push('/solicitar?servicio=Gasfitería&urgencia=Emergencia' as any)}
            style={{ flex: 1, backgroundColor: '#3B82F6', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="water" size={28} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11, textAlign: 'center' }}>Gasfitero urgente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/solicitar?servicio=Electricidad&urgencia=Emergencia' as any)}
            style={{ flex: 1, backgroundColor: '#F59E0B', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="flash" size={28} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11, textAlign: 'center' }}>Electricista urgente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/solicitar?servicio=Cerrajería&urgencia=Emergencia' as any)}
            style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="key" size={28} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11, textAlign: 'center' }}>Cerrajero urgente</Text>
          </TouchableOpacity>
        </View>

        {/* Direct contact buttons */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:+51${SUPPORT_PHONE}`)}
            style={{ flex: 1, backgroundColor: '#1E3A5F', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Llamar a soporte</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(waLink(SUPPORT_PHONE, '🚨 Necesito ayuda de emergencia urgente'))}
            style={{ flex: 1, backgroundColor: '#25D366', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>WhatsApp directo</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 16 }} />

        {/* Emergency type selection */}
        <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 10 }}>¿Qué emergencia tienes?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {EMERGENCIAS.map((e) => (
            <TouchableOpacity
              key={e.name}
              onPress={() => setSelected(e)}
              style={{
                width: '48%', backgroundColor: selected?.name === e.name ? e.color + '15' : '#fff',
                borderRadius: 12, padding: 14, borderWidth: 2,
                borderColor: selected?.name === e.name ? e.color : '#E2E8F0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Ionicons name={e.icon} size={20} color={e.color} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.dark }}>{e.name}</Text>
              </View>
              <Text style={{ fontSize: 9, color: COLORS.gray }}>{e.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selected && (
          <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.dark, marginBottom: 12 }}>Tus datos</Text>

            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Nombre *</Text>
            <TextInput
              value={nombre} onChangeText={setNombre}
              placeholder="Tu nombre"
              style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 }}
              placeholderTextColor={COLORS.gray2}
            />

            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>WhatsApp *</Text>
            <TextInput
              value={whatsapp} onChangeText={setWhatsapp}
              placeholder="999 888 777" keyboardType="phone-pad"
              style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 }}
              placeholderTextColor={COLORS.gray2}
            />

            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Dirección (opcional)</Text>
            <TextInput
              value={direccion} onChangeText={setDireccion}
              placeholder="Av. ejemplo 123, dpto 4B"
              style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 }}
              placeholderTextColor={COLORS.gray2}
            />

            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>Detalle adicional (opcional)</Text>
            <TextInput
              value={detalle} onChangeText={setDetalle}
              placeholder="Describe brevemente qué pasó"
              multiline numberOfLines={2}
              style={{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 16, textAlignVertical: 'top', minHeight: 60 }}
              placeholderTextColor={COLORS.gray2}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{ backgroundColor: '#DC2626', borderRadius: 20, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: '#DC2626', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="warning" size={22} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 }}>ENVIAR URGENCIA</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={{ fontSize: 10, color: COLORS.gray2, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>
              Te asignaremos el técnico más cercano disponible
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
