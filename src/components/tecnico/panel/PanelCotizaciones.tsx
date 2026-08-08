// Pestaña "Cotizaciones" del panel del técnico: presupuestos enviados y el
// formulario para crear uno nuevo.

import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ENV } from '../../../lib/env'
import { fetchMyTechDashboard } from '../../../lib/tech-profile'
import type { Cliente, Cotizacion, Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { PressableScale } from '../../ui/Motion'
import { ErrorDeCarga } from './ErrorDeCarga'
import { ToastAviso, type Aviso } from './ToastAviso'

export function PanelCotizaciones({
  tech,
  leads,
  cotizaciones,
  dashError,
  authToken,
  onReload,
  onCotizacionesChange,
  onAviso,
}: {
  tech: Tecnico
  leads: Cliente[]
  cotizaciones: Cotizacion[]
  dashError: boolean
  authToken: string | null
  onReload: () => void
  onCotizacionesChange: (cotizaciones: Cotizacion[]) => void
  onAviso: (aviso: Aviso) => void
}) {
  const [showNewCotizacion, setShowNewCotizacion] = useState(false)
  const [cotLeadId, setCotLeadId] = useState('')
  const [cotMonto, setCotMonto] = useState('')
  const [cotDescripcion, setCotDescripcion] = useState('')
  const [cotServicio, setCotServicio] = useState('')
  const [savingCotizacion, setSavingCotizacion] = useState(false)
  // Avisos disparados con el modal abierto: el toast del hub queda DETRÁS del
  // Modal nativo, así que estos se muestran dentro del propio modal.
  const [avisoModal, setAvisoModal] = useState<Aviso | null>(null)

  async function createCotizacion() {
    if (!cotLeadId || !cotMonto || !cotDescripcion) {
      setAvisoModal({ tipo: 'error', texto: 'Completa todos los campos' })
      return
    }
    const selectedLead = leads.find(l => l.id === parseInt(cotLeadId))
    if (!selectedLead) {
      setAvisoModal({ tipo: 'error', texto: 'Selecciona un lead válido' })
      return
    }

    setSavingCotizacion(true)
    try {
      // El insert con la key anon fallaba SIEMPRE (`cotizaciones` está en
      // deny-all para anon): ahora va por el endpoint server-side con
      // Bearer, que además valida que el servicio sea de este técnico.
      const res = await fetch(`${ENV.API_BASE_URL}/tecnico/cotizaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          codigo_solicitud: selectedLead.codigo,
          servicio: cotServicio || selectedLead.servicio,
          descripcion: cotDescripcion,
          monto: parseFloat(cotMonto),
          cliente_id: selectedLead.id,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'No se pudo crear la cotización')
      }

      // Auto-notify client via WhatsApp
      const waMsg = `Hola ${selectedLead.nombre}, soy ${tech.nombre} de SOLU. Te envío una cotización por ${cotServicio || selectedLead.servicio}:\n\n💰 Monto: S/${cotMonto}\n📝 ${cotDescripcion}\n\nCódigo: ${selectedLead.codigo}\n\n¿Aceptas la cotización?`
      Linking.openURL(`https://wa.me/51${selectedLead.whatsapp}?text=${encodeURIComponent(waMsg)}`)

      onAviso({ tipo: 'ok', texto: 'Cotización enviada. Se abrió WhatsApp para notificar al cliente.' })
      setShowNewCotizacion(false)
      setCotLeadId('')
      setCotMonto('')
      setCotDescripcion('')
      setCotServicio('')
      // Recargar desde el dashboard server-side (la lectura anon también
      // estaba bloqueada y devolvía vacío).
      const dash = await fetchMyTechDashboard(authToken)
      if (dash?.cotizaciones) onCotizacionesChange(dash.cotizaciones)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intenta de nuevo'
      setAvisoModal({ tipo: 'error', texto: 'No se pudo crear: ' + msg })
    } finally {
      setSavingCotizacion(false)
    }
  }

  return (
    <View style={{ gap: THEME.space.md }}>
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.space.md }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Mis cotizaciones</Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>Presupuestos enviados a clientes</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowNewCotizacion(true)}
            accessibilityLabel="Crear una cotización nueva"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: THEME.color.navy, paddingHorizontal: 14, minHeight: 44, borderRadius: THEME.radius.sm }}
          >
            <Ionicons name="add" size={16} color={THEME.color.white} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>Nueva</Text>
          </TouchableOpacity>
        </View>

        {cotizaciones.length === 0 && dashError ? (
          <ErrorDeCarga titulo="No pudimos cargar tus cotizaciones" onRetry={onReload} />
        ) : cotizaciones.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: THEME.space.xl }}>
            <Ionicons name="document-text-outline" size={32} color={THEME.color.inkMuted} />
            <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.sm }}>No tienes cotizaciones aún</Text>
            <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center', lineHeight: 17 }}>
              Envía un presupuesto claro y cierra el trabajo más rápido.
            </Text>
            <TouchableOpacity
              onPress={() => setShowNewCotizacion(true)}
              accessibilityLabel="Crear mi primera cotización"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.md, paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md, minHeight: 44, marginTop: THEME.space.md }}
            >
              <Ionicons name="add" size={16} color={THEME.color.info} />
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.info }}>Crear mi primera cotización</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cotizaciones.map((cot) => {
            const statusColors: Record<string, string> = { pendiente: THEME.color.warning, aceptada: THEME.color.success, rechazada: THEME.color.danger }
            const color = statusColors[cot.estado] || THEME.color.inkSoft
            return (
              <View key={cot.id} style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: 14, marginBottom: THEME.space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>{cot.cliente_nombre || 'Cliente'}</Text>
                  <View style={{ backgroundColor: color + '15', borderRadius: 6, paddingHorizontal: THEME.space.sm, paddingVertical: 3 }}>
                    <Text style={{ ...THEME.font.caption, fontWeight: '700', color }}>{cot.estado}</Text>
                  </View>
                </View>
                <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft }}>{cot.servicio}</Text>
                {cot.descripcion ? <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 2 }}>{cot.descripcion}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: THEME.space.sm }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: THEME.color.navy }}>S/{cot.monto}</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>{new Date(cot.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
            )
          })
        )}
      </View>

      {/* New cotizacion form modal.
          Iba sin onRequestClose (el botón atrás de Android no cerraba
          nada) y sin scroll: el formulario mide ~530px contra un tope
          de 80% de pantalla, así que en celulares chicos —y siempre
          con el teclado abierto— el botón "Enviar cotización" quedaba
          cortado y no había forma de mandarla. */}
      <Modal visible={showNewCotizacion} transparent animationType="slide" onRequestClose={() => setShowNewCotizacion(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <View style={{ backgroundColor: THEME.color.surface, borderTopLeftRadius: THEME.radius.xxl, borderTopRightRadius: THEME.radius.xxl, paddingHorizontal: THEME.space.xxl, paddingTop: THEME.space.xxl, paddingBottom: THEME.space.xxl, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.space.xl }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: THEME.color.ink }}>Nueva cotización</Text>
              <TouchableOpacity
                onPress={() => setShowNewCotizacion(false)}
                accessibilityLabel="Cerrar"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={THEME.color.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink, marginBottom: 6 }}>Seleccionar cliente</Text>
            {leads.length === 0 && (
              <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginBottom: THEME.space.md }}>
                Primero acepta un trabajo para poder cotizarle a un cliente.
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: THEME.space.md, maxHeight: 44 }}>
              {leads.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => { setCotLeadId(String(l.id)); setCotServicio(l.servicio) }}
                  accessibilityLabel={`Cotizarle a ${l.nombre}`}
                  style={{
                    paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: THEME.radius.sm, marginRight: 6,
                    backgroundColor: cotLeadId === String(l.id) ? THEME.color.navy : THEME.color.lineSoft,
                  }}
                >
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: cotLeadId === String(l.id) ? THEME.color.white : THEME.color.ink }}>
                    {l.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink, marginBottom: 6 }}>Servicio</Text>
            <TextInput
              value={cotServicio}
              onChangeText={setCotServicio}
              placeholder="Ej: Reparación de tubería"
              style={{ backgroundColor: THEME.color.lineSoft, borderRadius: THEME.radius.md, padding: 14, fontSize: 14, marginBottom: THEME.space.md, color: THEME.color.ink }}
              placeholderTextColor={THEME.color.inkMuted}
            />

            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink, marginBottom: 6 }}>Monto (S/)</Text>
            <TextInput
              value={cotMonto}
              onChangeText={setCotMonto}
              placeholder="150"
              keyboardType="numeric"
              style={{ backgroundColor: THEME.color.lineSoft, borderRadius: THEME.radius.md, padding: 14, fontSize: 14, marginBottom: THEME.space.md, color: THEME.color.ink }}
              placeholderTextColor={THEME.color.inkMuted}
            />

            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink, marginBottom: 6 }}>Descripción</Text>
            <TextInput
              value={cotDescripcion}
              onChangeText={setCotDescripcion}
              placeholder="Detalle del trabajo y materiales..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: THEME.color.lineSoft, borderRadius: THEME.radius.md, padding: 14, fontSize: 14, marginBottom: THEME.space.lg, textAlignVertical: 'top', minHeight: 80, color: THEME.color.ink }}
              placeholderTextColor={THEME.color.inkMuted}
            />

            <PressableScale
              onPress={createCotizacion}
              disabled={savingCotizacion}
              accessibilityLabel="Enviar cotización"
              style={{ backgroundColor: THEME.color.brand, borderRadius: THEME.radius.lg, height: 52, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: THEME.space.sm, ...THEME.shadow.brand }}
            >
              {savingCotizacion && <ActivityIndicator size="small" color={THEME.color.white} />}
              <Text style={{ ...THEME.font.body, color: THEME.color.white, fontWeight: '800' }}>
                {savingCotizacion ? 'Enviando...' : 'Enviar cotización'}
              </Text>
            </PressableScale>
            </ScrollView>
          </View>
          <ToastAviso aviso={avisoModal} onOcultar={() => setAvisoModal(null)} />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

export default PanelCotizaciones
