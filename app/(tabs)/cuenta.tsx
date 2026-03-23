import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { supabase } from '../../src/lib/supabase'

export default function CuentaScreen() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [wa, setWa] = useState('')
  const [loading, setLoading] = useState(false)
  const [tech, setTech] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [tab, setTab] = useState<'perfil' | 'leads' | 'resenas'>('perfil')

  async function doLogin() {
    if (!wa) return Alert.alert('Error', 'Ingresa tu WhatsApp')
    setLoading(true)
    const { data } = await supabase
      .from('tecnicos')
      .select('*')
      .eq('whatsapp', wa)
      .single()

    if (!data) {
      Alert.alert('No encontrado', 'No hay cuenta de técnico con ese WhatsApp')
    } else {
      setTech(data)
      setLoggedIn(true)
      const [leadsRes, revRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('tecnico_asignado', data.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('resenas').select('*').eq('tecnico_id', data.id).order('created_at', { ascending: false }).limit(20),
      ])
      setLeads(leadsRes.data || [])
      setReviews(revRes.data || [])
    }
    setLoading(false)
  }

  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.light, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: COLORS.white, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.priLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 }}>
            <Ionicons name="person" size={28} color={COLORS.pri} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.dark, textAlign: 'center', marginBottom: 4 }}>Mi cuenta</Text>
          <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginBottom: 20 }}>Ingresa tu WhatsApp para acceder a tu perfil de técnico</Text>
          <TextInput
            placeholder="Tu WhatsApp: 999 888 777"
            value={wa}
            onChangeText={setWa}
            keyboardType="phone-pad"
            style={{ backgroundColor: COLORS.light, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, textAlign: 'center' }}
            placeholderTextColor={COLORS.gray2}
          />
          <TouchableOpacity
            onPress={doLogin}
            disabled={loading}
            style={{ backgroundColor: COLORS.pri, borderRadius: 12, padding: 14, alignItems: 'center' }}
          >
            <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 15 }}>{loading ? 'Buscando...' : 'Ingresar →'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }}>
      {/* Profile header */}
      <View style={{ backgroundColor: COLORS.pri, padding: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, alignItems: 'center' }}>
        <View style={{ width: 70, height: 70, borderRadius: 20, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: COLORS.pri }}>{tech.nombre?.[0] || 'T'}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.nombre}</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{tech.oficio} · {tech.distrito}</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.calificacion?.toFixed(1) || '0.0'}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Rating</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.num_resenas || 0}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Reseñas</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.white }}>{tech.servicios_completados || 0}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Servicios</Text>
          </View>
        </View>
        <View style={{ marginTop: 10, backgroundColor: tech.plan === 'pro' ? '#FFD700' : 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: tech.plan === 'pro' ? COLORS.dark : COLORS.white }}>
            Plan {tech.plan?.toUpperCase() || 'GRATIS'}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', padding: 16, gap: 8 }}>
        {(['perfil', 'leads', 'resenas'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: tab === t ? COLORS.pri : COLORS.white, alignItems: 'center', borderWidth: 1, borderColor: tab === t ? COLORS.pri : COLORS.border }}
          >
            <Text style={{ fontWeight: '700', fontSize: 12, color: tab === t ? COLORS.white : COLORS.gray }}>
              {t === 'perfil' ? 'Perfil' : t === 'leads' ? 'Leads' : 'Reseñas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16, paddingTop: 0 }}>
        {tab === 'perfil' && (
          <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border }}>
            <InfoRow label="WhatsApp" value={tech.whatsapp} />
            <InfoRow label="Email" value={tech.email || 'No registrado'} />
            <InfoRow label="Experiencia" value={tech.experiencia || 'No especificada'} />
            <InfoRow label="Precio desde" value={tech.precio_desde ? `S/${tech.precio_desde}` : 'No especificado'} />
            <InfoRow label="Disponible" value={tech.disponible ? 'Sí' : 'No'} />
            <InfoRow label="Verificado" value={tech.verificado ? 'Sí ✅' : 'Pendiente'} />
          </View>
        )}
        {tab === 'leads' && (
          <View>
            {leads.map((l: any) => (
              <View key={l.id} style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: COLORS.dark }}>{l.nombre}</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>{l.servicio} · {l.distrito}</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 2 }}>Estado: {l.estado}</Text>
              </View>
            ))}
            {leads.length === 0 && <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20 }}>Sin leads aún</Text>}
          </View>
        )}
        {tab === 'resenas' && (
          <View>
            {reviews.map((r: any) => (
              <View key={r.id} style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={14} color={s <= r.calificacion ? COLORS.yellow : COLORS.border} />
                  ))}
                </View>
                <Text style={{ fontSize: 13, color: COLORS.dark }}>{r.comentario}</Text>
                <Text style={{ fontSize: 11, color: COLORS.gray2, marginTop: 4 }}>— {r.nombre_cliente}</Text>
              </View>
            ))}
            {reviews.length === 0 && <Text style={{ textAlign: 'center', color: COLORS.gray2, padding: 20 }}>Sin reseñas aún</Text>}
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        onPress={() => { setLoggedIn(false); setTech(null) }}
        style={{ marginHorizontal: 16, marginBottom: 40, padding: 14, borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' }}
      >
        <Text style={{ color: COLORS.red, fontWeight: '700', fontSize: 14 }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      <Text style={{ fontSize: 13, color: COLORS.gray }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark }}>{value}</Text>
    </View>
  )
}
