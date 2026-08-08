// Pestaña "Reseñas" del panel del técnico: lo que dicen sus clientes.

import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Resena } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { ErrorDeCarga } from './ErrorDeCarga'

export function PanelResenas({
  reviews,
  dashError,
  onReload,
}: {
  reviews: Resena[]
  dashError: boolean
  onReload: () => void
}) {
  return (
    <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink, marginBottom: 4 }}>Mis reseñas</Text>
      <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginBottom: THEME.space.md }}>Lo que dicen tus clientes</Text>
      {reviews.length === 0 && dashError ? (
        <ErrorDeCarga titulo="No pudimos cargar tus reseñas" onRetry={onReload} />
      ) : reviews.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: THEME.space.xxl }}>
          <Ionicons name="star-outline" size={32} color={THEME.color.warning} />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginTop: THEME.space.sm }}>Aún no tienes reseñas</Text>
          <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted, marginTop: 2, textAlign: 'center', lineHeight: 17 }}>
            Completa tus primeros trabajos y pide a tus clientes que te califiquen. Las reseñas te traen más clientes.
          </Text>
        </View>
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: 14, marginBottom: THEME.space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>{r.nombre_cliente}</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name="star" size={12} color={s <= r.calificacion ? THEME.color.warning : THEME.color.line} />
                ))}
              </View>
            </View>
            <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, fontStyle: 'italic' }}>"{r.comentario}"</Text>
            <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 4 }}>{r.servicio} · {new Date(r.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </View>
  )
}

export default PanelResenas
