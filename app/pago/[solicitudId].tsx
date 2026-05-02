// Pantalla de pago en app nativa — Fase 1.E.
//
// La app abre el checkout web (https://solu.pe/pago/[solicitudId]) en
// expo-web-browser. Esa página corre Culqi.js V4 con 3DS, tokeniza la
// tarjeta del cliente, y llama POST /api/pagos/escrow/iniciar.
//
// Cuando el cliente cierra el browser, volvemos a esta pantalla y
// chequeamos el estado del escrow vía /api/pagos/escrow/status (proxy
// que verifica el estado actual). Si está RETENIDO, mostramos éxito;
// si no, dejamos al usuario reintentar.
//
// Esta arquitectura evita lidiar con Culqi.js dentro de WebView nativo
// (más complejo, peor UX) y reusa el mismo flujo que web móvil.

import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'
import { ENV, fetchWithTimeout } from '../../src/lib/env'

interface SolicitudData {
  solicitud_id: number
  tecnico_id: number
  tecnico_nombre: string
  monto_bruto_cent: number
  cliente_email: string
  cliente_whatsapp: string
  descripcion: string
}

export default function PagoScreen() {
  const { solicitudId } = useLocalSearchParams<{ solicitudId: string }>()
  const router = useRouter()
  const [data, setData] = useState<SolicitudData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [ultimoIntento, setUltimoIntento] = useState<number>(0)

  useEffect(() => {
    cargarSolicitud()
  }, [solicitudId])

  async function cargarSolicitud() {
    if (!solicitudId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/pagos/solicitud-info/${solicitudId}`, { timeout: 10000 })
      if (!res.ok) {
        // Endpoint todavía no existe en backend — mostramos info mínima
        // del solicitudId con valores placeholder. En backend debería
        // venir el monto, técnico, email, etc. Por ahora dejamos que
        // el usuario los ingrese manualmente como fallback.
        setData(null)
      } else {
        const body = await res.json()
        setData(body.solicitud ?? null)
      }
    } catch (err) {
      setError('No se pudo cargar la solicitud. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function abrirCheckout() {
    if (!data) return
    setOpening(true)
    setUltimoIntento(Date.now())

    const params = new URLSearchParams({
      monto: String(data.monto_bruto_cent),
      tecnico: String(data.tecnico_id),
      email: data.cliente_email,
      whatsapp: data.cliente_whatsapp,
      desc: data.descripcion,
    })
    const url = `https://solu.pe/pago/${data.solicitud_id}?${params.toString()}`

    try {
      // openAuthSessionAsync espera un redirect a custom scheme. Si
      // queremos detectar éxito automático, deberíamos hacer redirect a
      // solu://pago/exito desde la página /pago/exito. Por ahora usamos
      // openBrowserAsync que solo abre y devuelve cuando el user cierra.
      const result = await WebBrowser.openBrowserAsync(url, {
        controlsColor: '#EA580C',
        toolbarColor: '#FFFFFF',
        showTitle: true,
        enableBarCollapsing: false,
      })
      // result.type === 'cancel' o 'opened'. No sabemos si pagó o no.
      // Verificamos vía API.
      await verificarEstado()
    } catch (err) {
      Alert.alert('Error', 'No se pudo abrir el checkout. Intenta de nuevo.')
    } finally {
      setOpening(false)
    }
  }

  async function verificarEstado() {
    if (!data) return
    try {
      const res = await fetchWithTimeout(
        `${ENV.API_BASE_URL}/pagos/escrow/by-solicitud/${data.solicitud_id}`,
        { timeout: 10000 },
      )
      if (!res.ok) return
      const body = await res.json() as { escrow?: { id: number; estado: string } }
      if (body.escrow && (body.escrow.estado === 'RETENIDO' || body.escrow.estado === 'LIBERADO')) {
        Alert.alert(
          '✅ Pago confirmado',
          `Tu pago está retenido en SOLU. El técnico ya recibió notificación.`,
          [
            {
              text: 'Ir a tracking',
              onPress: () => router.replace(`/tracking/${data.solicitud_id}`),
            },
          ],
        )
      }
    } catch {
      // Silencioso — el user volverá a esta pantalla y puede reintentar
    }
  }

  function fmtSoles(cent: number): string {
    return `S/${(cent / 100).toFixed(2)}`
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: '#666' }}>Cargando…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#dc2626', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        <TouchableOpacity
          onPress={cargarSolicitud}
          style={{ backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Sin endpoint backend (fallback): permitir al user pagar igual con
  // valores que tendrían que venir desde la pantalla anterior via params.
  // Por ahora mostramos pantalla de placeholder.
  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="card-outline" size={64} color="#999" />
        <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          Pago no disponible
        </Text>
        <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>
          La solicitud #{solicitudId} no tiene datos de pago todavía.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24 }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>← Volver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const TAKE_RATE = 12
  const comisionEst = Math.floor((data.monto_bruto_cent * TAKE_RATE) / 100)
  const netoTec = data.monto_bruto_cent - comisionEst

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ padding: 20 }}>
        {/* Header */}
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4 }}>Pago seguro</Text>
        <Text style={{ color: '#666', marginBottom: 24 }}>{data.descripcion}</Text>

        {/* Resumen */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 8 }}>Detalle del pago</Text>
          <Row label="Servicio" value={fmtSoles(netoTec)} />
          <Row label={`Plataforma SOLU (${TAKE_RATE}%)`} value={fmtSoles(comisionEst)} muted />
          <View style={{ borderTopWidth: 1, borderColor: '#e5e7eb', marginTop: 8, paddingTop: 8 }}>
            <Row label="Total" value={fmtSoles(data.monto_bruto_cent)} bold />
          </View>
        </View>

        {/* Trust */}
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
            🔒 Tu pago queda retenido en SOLU hasta que confirmes el servicio. Si hay un problema, puedes solicitar reembolso.
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={abrirCheckout}
          disabled={opening}
          style={{
            backgroundColor: opening ? '#9ca3af' : COLORS.primary,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          {opening ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Pagar {fmtSoles(data.monto_bruto_cent)}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 16 }}>
          Aceptamos Visa, Mastercard, Amex, Diners y Yape
        </Text>

        {ultimoIntento > 0 && (
          <TouchableOpacity onPress={verificarEstado} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: COLORS.primary, fontSize: 14 }}>
              ¿Ya pagaste? Verificar estado
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: muted ? '#666' : '#111827', fontSize: 14, fontWeight: bold ? '700' : '400' }}>
        {label}
      </Text>
      <Text style={{ color: muted ? '#666' : '#111827', fontSize: 14, fontWeight: bold ? '700' : '500', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  )
}
