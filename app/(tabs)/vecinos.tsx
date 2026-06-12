import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../src/lib/supabase'
import { THEME } from '../../src/lib/theme'
import { FadeInUp, PressableScale, haptics } from '../../src/components/ui/Motion'
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
        haptics.success()
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
        haptics.success()
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
    <ScrollView
      style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt }}
      contentContainerStyle={{ paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header oscuro */}
      <View style={{
        backgroundColor: THEME.color.navy,
        paddingHorizontal: THEME.space.xl,
        paddingTop: (StatusBar.currentHeight || 40) + 12,
        paddingBottom: THEME.space.xxl,
        borderBottomLeftRadius: THEME.radius.xxl,
        borderBottomRightRadius: THEME.radius.xxl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.sm }}>
          <View style={{
            width: 46, height: 46, borderRadius: THEME.radius.lg,
            backgroundColor: THEME.color.brand, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="people" size={24} color={THEME.color.white} />
          </View>
          <Text style={{ ...THEME.font.h1, color: THEME.color.white }}>Vecinos SOLU</Text>
        </View>
        <Text style={{ ...THEME.font.bodySm, color: 'rgba(255,255,255,0.72)', lineHeight: 19 }}>
          Crea o únete a un grupo de vecinos y obtén 10% de descuento permanente en todos los servicios.
        </Text>
      </View>

      {grupo ? (
        // ═══ ESTADO: grupo activo ═══
        <View style={{ padding: THEME.space.lg }}>
          <FadeInUp>
            <View style={{
              backgroundColor: THEME.color.surface,
              borderRadius: THEME.radius.xxl,
              padding: THEME.space.xxl,
              ...THEME.shadow.md,
            }}>
              <View style={{
                width: 80, height: 80, borderRadius: THEME.radius.full,
                backgroundColor: THEME.color.successBg, alignItems: 'center', justifyContent: 'center',
                alignSelf: 'center', marginBottom: THEME.space.md,
              }}>
                <Ionicons name="checkmark-circle" size={44} color={THEME.color.success} />
              </View>
              <Text style={{ ...THEME.font.h2, color: THEME.color.ink, textAlign: 'center' }}>{grupo.nombre}</Text>
              <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, textAlign: 'center', marginTop: THEME.space.xs }}>{grupo.direccion}</Text>

              <View style={{
                backgroundColor: THEME.color.brandLight,
                borderRadius: THEME.radius.lg,
                padding: THEME.space.lg,
                marginTop: THEME.space.lg,
                alignItems: 'center',
              }}>
                <Text style={{ ...THEME.font.label, color: THEME.color.inkSoft }}>Código del grupo</Text>
                <Text style={{ ...THEME.font.display, fontSize: 32, color: THEME.color.brand, marginTop: THEME.space.xs, letterSpacing: 1 }}>{grupo.codigo}</Text>
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: THEME.space.xs }}>Comparte este código con tus vecinos</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: THEME.space.md, marginTop: THEME.space.lg }}>
                <View style={{ flex: 1, backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.lg, paddingVertical: THEME.space.lg, alignItems: 'center' }}>
                  <Text style={{ ...THEME.font.h1, color: THEME.color.ink }}>{grupo.miembros || 1}</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>Miembros</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.lg, paddingVertical: THEME.space.lg, alignItems: 'center' }}>
                  <Text style={{ ...THEME.font.h1, color: THEME.color.success }}>10%</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>Descuento</Text>
                </View>
              </View>
            </View>
          </FadeInUp>
        </View>
      ) : (
        <View style={{ padding: THEME.space.lg }}>
          {/* Tabs segmentadas */}
          <FadeInUp>
            <View style={{ flexDirection: 'row', backgroundColor: THEME.color.surfaceSunken, borderRadius: THEME.radius.md, padding: 4, marginBottom: THEME.space.lg }}>
              <TouchableOpacity
                onPress={() => setTab('join')}
                activeOpacity={0.85}
                accessibilityLabel="Unirme a un grupo"
                style={{
                  flex: 1, paddingVertical: 11, borderRadius: THEME.radius.sm, alignItems: 'center',
                  backgroundColor: tab === 'join' ? THEME.color.surface : 'transparent',
                  ...(tab === 'join' ? THEME.shadow.sm : {}),
                }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: tab === 'join' ? THEME.color.navy : THEME.color.inkMuted }}>Unirme</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTab('create')}
                activeOpacity={0.85}
                accessibilityLabel="Crear un grupo"
                style={{
                  flex: 1, paddingVertical: 11, borderRadius: THEME.radius.sm, alignItems: 'center',
                  backgroundColor: tab === 'create' ? THEME.color.surface : 'transparent',
                  ...(tab === 'create' ? THEME.shadow.sm : {}),
                }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: tab === 'create' ? THEME.color.navy : THEME.color.inkMuted }}>Crear grupo</Text>
              </TouchableOpacity>
            </View>
          </FadeInUp>

          {tab === 'join' ? (
            <FadeInUp delay={60}>
              <View style={{
                backgroundColor: THEME.color.surface,
                borderRadius: THEME.radius.xl,
                padding: THEME.space.xl,
                ...THEME.shadow.sm,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: THEME.radius.lg,
                  backgroundColor: THEME.color.infoBg, alignItems: 'center', justifyContent: 'center',
                  marginBottom: THEME.space.md,
                }}>
                  <Ionicons name="enter-outline" size={26} color={THEME.color.info} />
                </View>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Unirme a un grupo</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs, marginBottom: THEME.space.lg }}>
                  Ingresa el código que te compartió tu vecino
                </Text>
                <TextInput
                  placeholder="Ej: VEC-ABC12"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  style={{
                    backgroundColor: THEME.color.surfaceAlt,
                    borderRadius: THEME.radius.lg,
                    paddingVertical: THEME.space.md,
                    paddingHorizontal: THEME.space.lg,
                    ...THEME.font.h3,
                    color: THEME.color.ink,
                    textAlign: 'center',
                    letterSpacing: 1,
                    marginBottom: THEME.space.md,
                  }}
                  placeholderTextColor={THEME.color.inkMuted}
                />
                <PressableScale
                  onPress={joinGroup}
                  disabled={loading}
                  accessibilityLabel="Unirme al grupo"
                  style={{
                    backgroundColor: THEME.color.brand,
                    borderRadius: THEME.radius.lg,
                    height: 52,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs,
                    ...THEME.shadow.brand,
                  }}
                >
                  <Ionicons name="people" size={18} color={THEME.color.white} />
                  <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>{loading ? 'Buscando...' : 'Unirme al grupo'}</Text>
                </PressableScale>
              </View>
            </FadeInUp>
          ) : (
            <FadeInUp delay={60}>
              <View style={{
                backgroundColor: THEME.color.surface,
                borderRadius: THEME.radius.xl,
                padding: THEME.space.xl,
                ...THEME.shadow.sm,
              }}>
                <View style={{
                  width: 52, height: 52, borderRadius: THEME.radius.lg,
                  backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center',
                  marginBottom: THEME.space.md,
                }}>
                  <Ionicons name="add-circle-outline" size={26} color={THEME.color.brand} />
                </View>
                <Text style={{ ...THEME.font.h3, color: THEME.color.ink }}>Crear un grupo</Text>
                <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: THEME.space.xs, marginBottom: THEME.space.lg }}>
                  Registra tu edificio o condominio
                </Text>
                <TextInput
                  placeholder="Nombre del edificio"
                  value={nombre}
                  onChangeText={setNombre}
                  style={{
                    backgroundColor: THEME.color.surfaceAlt,
                    borderRadius: THEME.radius.lg,
                    paddingHorizontal: THEME.space.lg,
                    height: 52,
                    ...THEME.font.body,
                    color: THEME.color.ink,
                    marginBottom: THEME.space.md,
                  }}
                  placeholderTextColor={THEME.color.inkMuted}
                />
                <TextInput
                  placeholder="Dirección"
                  value={direccion}
                  onChangeText={setDireccion}
                  style={{
                    backgroundColor: THEME.color.surfaceAlt,
                    borderRadius: THEME.radius.lg,
                    paddingHorizontal: THEME.space.lg,
                    height: 52,
                    ...THEME.font.body,
                    color: THEME.color.ink,
                    marginBottom: THEME.space.md,
                  }}
                  placeholderTextColor={THEME.color.inkMuted}
                />
                <TextInput
                  placeholder="Tu WhatsApp"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: THEME.color.surfaceAlt,
                    borderRadius: THEME.radius.lg,
                    paddingHorizontal: THEME.space.lg,
                    height: 52,
                    ...THEME.font.body,
                    color: THEME.color.ink,
                    marginBottom: THEME.space.md,
                  }}
                  placeholderTextColor={THEME.color.inkMuted}
                />
                <PressableScale
                  onPress={createGroup}
                  disabled={loading}
                  accessibilityLabel="Crear grupo"
                  style={{
                    backgroundColor: THEME.color.brand,
                    borderRadius: THEME.radius.lg,
                    height: 52,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.xs,
                    ...THEME.shadow.brand,
                  }}
                >
                  <Ionicons name="add-circle" size={18} color={THEME.color.white} />
                  <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>{loading ? 'Creando...' : 'Crear grupo'}</Text>
                </PressableScale>
              </View>
            </FadeInUp>
          )}

          {/* Beneficio destacado */}
          <FadeInUp delay={120}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
              backgroundColor: THEME.color.successBg,
              borderRadius: THEME.radius.lg,
              padding: THEME.space.lg,
              marginTop: THEME.space.lg,
            }}>
              <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: THEME.color.success, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pricetag" size={20} color={THEME.color.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.label, color: THEME.color.ink }}>10% de descuento permanente</Text>
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 1 }}>Para todos los miembros del grupo, en cada servicio.</Text>
              </View>
            </View>
          </FadeInUp>
        </View>
      )}
    </ScrollView>
  )
}
