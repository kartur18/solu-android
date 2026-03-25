import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'
import type { GrupoVecinos } from '../../src/lib/types'

export default function VecinosScreen() {
  const [tab, setTab] = useState<'join' | 'create'>('join')
  const [code, setCode] = useState('')
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [grupo, setGrupo] = useState<GrupoVecinos | null>(null)

  async function joinGroup() {
    if (!code) return Alert.alert('Error', 'Ingresa el código del grupo')
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vecinos')
        .select('*')
        .eq('codigo', code.toUpperCase())
        .single()

      if (error || !data) {
        Alert.alert('Error', 'Grupo no encontrado')
      } else {
        await supabase.from('vecinos').update({ miembros: (data.miembros || 0) + 1 }).eq('id', data.id)
        setGrupo(data)
        Alert.alert('¡Listo!', `Te uniste al grupo "${data.nombre}". Tienes 10% de descuento en todos los servicios.`)
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function createGroup() {
    if (!nombre || !direccion || !whatsapp) return Alert.alert('Error', 'Completa todos los campos')
    setLoading(true)
    try {
      const codigo = 'VEC-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      const { data, error } = await supabase
        .from('vecinos')
        .insert({ nombre, direccion, whatsapp_admin: whatsapp, codigo, miembros: 1 })
        .select()
        .single()

      if (error) {
        Alert.alert('Error', 'No se pudo crear el grupo')
      } else {
        setGrupo(data)
        Alert.alert('¡Grupo creado!', `Código: ${codigo}\nComparte este código con tus vecinos para que se unan y obtengan 10% de descuento.`)
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }} contentContainerStyle={{ paddingBottom: 300 }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.blue, padding: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Ionicons name="people" size={28} color={COLORS.white} />
          <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.white }}>Vecinos SOLU</Text>
        </View>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
          Crea o únete a un grupo de vecinos y obtén 10% de descuento permanente
        </Text>
      </View>

      {grupo ? (
        <View style={{ padding: 20 }}>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.acc} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark, textAlign: 'center' }}>{grupo.nombre}</Text>
            <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 4 }}>{grupo.direccion}</Text>
            <View style={{ backgroundColor: COLORS.priLight, borderRadius: 12, padding: 16, marginTop: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Código del grupo</Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.pri, marginTop: 4 }}>{grupo.codigo}</Text>
              <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 4 }}>Comparte este código con tus vecinos</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.dark }}>{grupo.miembros || 1}</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray }}>Miembros</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.acc }}>10%</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray }}>Descuento</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ padding: 20 }}>
          {/* Tabs */}
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border }}>
            <TouchableOpacity
              onPress={() => setTab('join')}
              style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: tab === 'join' ? COLORS.pri : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: tab === 'join' ? COLORS.white : COLORS.gray }}>Unirme</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab('create')}
              style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: tab === 'create' ? COLORS.pri : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', fontSize: 13, color: tab === 'create' ? COLORS.white : COLORS.gray }}>Crear grupo</Text>
            </TouchableOpacity>
          </View>

          {tab === 'join' ? (
            <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Unirme a un grupo</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 16 }}>Ingresa el código que te compartió tu vecino</Text>
              <TextInput
                placeholder="Ej: VEC-ABC12"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}
                placeholderTextColor={COLORS.gray2}
              />
              <TouchableOpacity
                onPress={joinGroup}
                disabled={loading}
                style={{ backgroundColor: COLORS.pri, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>{loading ? 'Buscando...' : 'Unirme al grupo'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.dark, marginBottom: 4 }}>Crear un grupo</Text>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 16 }}>Registra tu edificio o condominio</Text>
              <TextInput placeholder="Nombre del edificio" value={nombre} onChangeText={setNombre} style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 10 }} placeholderTextColor={COLORS.gray2} />
              <TextInput placeholder="Dirección" value={direccion} onChangeText={setDireccion} style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 10 }} placeholderTextColor={COLORS.gray2} />
              <TextInput placeholder="Tu WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 12 }} placeholderTextColor={COLORS.gray2} />
              <TouchableOpacity
                onPress={createGroup}
                disabled={loading}
                style={{ backgroundColor: COLORS.acc, borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>{loading ? 'Creando...' : 'Crear grupo'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}
