import { View, Text, Image } from 'react-native'
import { COLORS } from '../lib/constants'

type Props = {
  amount: number
  reference: string
  yapeNumber?: string
}

export function YapeQR({ amount, reference, yapeNumber = '904518343' }: Props) {
  const qrData = `Yape: ${yapeNumber} | S/${amount} | Ref: ${reference}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`

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

      <Text style={{ fontSize: 10, color: COLORS.gray2, textAlign: 'center', marginTop: 10 }}>
        Después de pagar, tu plan se activará en menos de 24 horas.
      </Text>
    </View>
  )
}
