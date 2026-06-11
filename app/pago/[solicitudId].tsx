// Pantalla "Coordinar pago" — V3.1.
//
// CAMBIO DE MODELO 2026-05-13: SOLU eliminó el escrow. El cliente paga
// DIRECTO al técnico (Yape/Plin/efectivo/tarjeta), SOLU no procesa esa
// transacción. La monetización ahora es solo la venta de SoluCoins al
// técnico (lado opuesto del marketplace).
//
// Esta pantalla antes corría el flujo de escrow Culqi en webview; ahora
// muestra info clara sobre cómo coordinar el pago con el técnico y un
// botón para abrir WhatsApp directo. Mantiene la ruta /pago/[solicitudId]
// para no romper deep links viejos que puedan estar circulando.

import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../src/lib/constants'

export default function CoordinarPagoScreen() {
  const router = useRouter()
  const { solicitudId } = useLocalSearchParams<{ solicitudId: string }>()

  const abrirWhatsApp = () => {
    // El cliente coordina con el técnico por WhatsApp (canal donde ya
    // están hablando). El número del técnico lo tiene en /tracking.
    Linking.openURL('https://solu.pe/tracking/' + (solicitudId ?? ''))
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.light }} contentContainerStyle={{ padding: 20 }}>
      <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 24 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: COLORS.pri + '15',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Ionicons name="cash-outline" size={44} color={COLORS.pri} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.dark, textAlign: 'center' }}>
          Coordina el pago con tu técnico
        </Text>
      </View>

      <View style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16, padding: 20, marginBottom: 16,
        borderWidth: 1, borderColor: '#E2E8F0',
      }}>
        <Text style={{ fontSize: 15, color: COLORS.dark, lineHeight: 22, marginBottom: 12 }}>
          En SOLU el pago se hace <Text style={{ fontWeight: '700' }}>directamente al técnico</Text>,
          como cuando contratas a un especialista de confianza.
        </Text>
        <Text style={{ fontSize: 14, color: '#64748B', lineHeight: 20 }}>
          Acuerda con tu técnico el medio de pago que prefieras:
        </Text>
        <View style={{ marginTop: 12, gap: 8 }}>
          {['💜 Yape', '💚 Plin', '💵 Efectivo', '💳 Tarjeta'].map((m) => (
            <View key={m} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F8FAFC', borderRadius: 10,
              paddingVertical: 10, paddingHorizontal: 14,
            }}>
              <Text style={{ fontSize: 15, color: COLORS.dark, fontWeight: '500' }}>{m}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{
        backgroundColor: '#FFFBEB',
        borderRadius: 12, padding: 14, marginBottom: 24,
        borderWidth: 1, borderColor: '#FCD34D',
        flexDirection: 'row', gap: 10,
      }}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 }}>
          Si algo no sale bien, SOLU media gratis entre tú y el técnico.
          Garantía 30 días.
        </Text>
      </View>

      <TouchableOpacity
        onPress={abrirWhatsApp}
        style={{
          backgroundColor: COLORS.pri,
          paddingVertical: 16, borderRadius: 14,
          alignItems: 'center', flexDirection: 'row',
          justifyContent: 'center', gap: 8,
          marginBottom: 12,
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
          Ver detalles y contactar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          paddingVertical: 14, borderRadius: 14,
          alignItems: 'center',
          borderWidth: 1, borderColor: '#CBD5E1',
        }}
        activeOpacity={0.85}
      >
        <Text style={{ color: COLORS.dark, fontSize: 15, fontWeight: '600' }}>
          Volver
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
