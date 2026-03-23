import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SERVICIOS, DISTRITOS, URGENCIAS } from '../src/lib/constants'
import { supabase } from '../src/lib/supabase'

export default function SolicitarScreen() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [servicio, setServicio] = useState('')
  const [distrito, setDistrito] = useState('')
  const [urgencia, setUrgencia] = useState('normal')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [showServicios, setShowServicios] = useState(false)
  const [showDistritos, setShowDistritos] = useState(false)

  async function submit() {
    if (!nombre || !whatsapp || !servicio || !distrito) {
      return Alert.alert('Error', 'Completa los campos obligatorios')
    }
    setLoading(true)

    const codigo = 'SOLU-' + Math.random().toString(36).substring(2, 8).toUpperCase()

    // Find best tech
    const { data: techs } = await supabase
      .from('tecnicos')
      .select('id')
      .eq('disponible', true)
      .eq('distrito', distrito)
      .order('plan', { ascending: false })
      .order('calificacion', { ascending: false })
      .limit(1)

    const { error } = await supabase.from('clientes').insert({
      nombre, whatsapp, servicio, distrito, urgencia, descripcion, codigo,
      estado: techs?.[0] ? 'Asignado' : 'Nuevo',
      tecnico_asignado: techs?.[0]?.id || null,
    })

    if (error) {
      Alert.alert('Error', 'No se pudo enviar la solicitud')
    } else {
      Alert.alert(
        '¡Solicitud enviada!',
        `Tu código de seguimiento es: ${codigo}\n\nUn técnico se pondrá en contacto contigo pronto por WhatsApp.`,
        [{ text: 'OK', onPress: () => router.back() }]
      )
    }
    setLoading(false)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 20 }}>
          Completa el formulario y te asignaremos un técnico verificado
        </Text>

        <Text style={styles.label}>Nombre *</Text>
        <TextInput placeholder="Tu nombre" value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor={COLORS.gray2} />

        <Text style={styles.label}>WhatsApp *</Text>
        <TextInput placeholder="999 888 777" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} placeholderTextColor={COLORS.gray2} />

        <Text style={styles.label}>Servicio *</Text>
        <TouchableOpacity onPress={() => setShowServicios(!showServicios)} style={styles.input}>
          <Text style={{ color: servicio ? COLORS.dark : COLORS.gray2, fontSize: 14 }}>{servicio || 'Seleccionar servicio'}</Text>
        </TouchableOpacity>
        {showServicios && (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
            <ScrollView nestedScrollEnabled>
              {SERVICIOS.map((s) => (
                <TouchableOpacity key={s} onPress={() => { setServicio(s); setShowServicios(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <Text style={{ fontSize: 13, color: COLORS.dark }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Distrito *</Text>
        <TouchableOpacity onPress={() => setShowDistritos(!showDistritos)} style={styles.input}>
          <Text style={{ color: distrito ? COLORS.dark : COLORS.gray2, fontSize: 14 }}>{distrito || 'Seleccionar distrito'}</Text>
        </TouchableOpacity>
        {showDistritos && (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, marginTop: -8, marginBottom: 12, maxHeight: 200, borderWidth: 1, borderColor: COLORS.border }}>
            <ScrollView nestedScrollEnabled>
              {DISTRITOS.map((d) => (
                <TouchableOpacity key={d} onPress={() => { setDistrito(d); setShowDistritos(false) }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <Text style={{ fontSize: 13, color: COLORS.dark }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Urgencia</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {URGENCIAS.map((u) => (
            <TouchableOpacity
              key={u.value}
              onPress={() => setUrgencia(u.value)}
              style={{
                flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: urgencia === u.value ? u.color : COLORS.white,
                borderWidth: 1, borderColor: urgencia === u.value ? u.color : COLORS.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: urgencia === u.value ? COLORS.white : COLORS.gray }}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Descripción del problema</Text>
        <TextInput
          placeholder="Describe qué necesitas..."
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          numberOfLines={4}
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholderTextColor={COLORS.gray2}
        />

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={{ backgroundColor: COLORS.pri, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}
        >
          <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>
            {loading ? 'Enviando...' : 'Solicitar técnico →'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = {
  label: { fontSize: 13, fontWeight: '700' as const, color: COLORS.dark, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.dark,
  },
}
