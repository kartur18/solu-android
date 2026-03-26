import { View, Text, Image, TouchableOpacity, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, waLink, SUPPORT_PHONE } from '../lib/constants'
import { ENV } from '../lib/env'

type Props = {
  amount: number
  reference: string
  yapeNumber?: string
  onConfirm?: () => void
}

export function YapeQR({ amount, reference, yapeNumber = ENV.YAPE_NUMBER, onConfirm }: Props) {
  const qrData = `Yape: ${yapeNumber} | S/${amount} | Ref: ${reference}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`

  function handleConfirm() {
    const msg = `Hola, ya realicé el pago por Yape.\n\nMonto: S/${amount}\nReferencia: ${reference}\nNúmero Yape: ${yapeNumber}\n\nPor favor activar mi plan.`
    Linking.openURL(waLink(SUPPORT_PHONE, msg))
    onConfirm?.()
  }

  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: '#6C2EB9', alignItems: 'center' }}>
      <Text style={{ fontSize: 28, marginBottom: 8 }}>💜</Text>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#6C2EB9', marginBottom: 4 }}>Pagar con Yape</Text>
      <Text style={{ fontSize: 11, color: COLORS.gray, marginBottom: 12 }}>Escanea el QR o transfiere manualmente</Text>

      <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
        <Image source={{ uri: qrUrl }} style={{ width: 160, height: 160 }} />
      </View>

      <View style={{ backgroundColor: '#F3EAFF', borderRadius: 10, padding: 12, width: '100%', gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: COLORS.gray }}>Número Yape</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6C2EB9' }}>{yapeNumber}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: COLORS.gray }}>Monto exacto</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#6C2EB9' }}>S/{amount}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: COLORS.gray }}>Referencia</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#6C2EB9' }}>{reference}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={handleConfirm} style={{ backgroundColor: '#25D366', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%', marginTop: 12 }}>
        <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
        <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>Ya pagué, confirmar por WhatsApp</Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 10, color: COLORS.gray2, textAlign: 'center', marginTop: 8 }}>
        Tu plan se activará una vez confirmemos el pago.
      </Text>
    </View>
  )
}
