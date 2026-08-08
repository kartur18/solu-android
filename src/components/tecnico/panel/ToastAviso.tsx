// Toast del panel del técnico: reemplaza los Alert.alert INFORMATIVOS
// ("Guardado", "Foto actualizada", errores de red) por un aviso no bloqueante
// con los tokens del THEME. Los Alert de confirmación destructiva siguen
// siendo Alert: ahí sí hay una decisión que tomar.

import { useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FadeInUp } from '../../ui/Motion'
import { THEME } from '../../../lib/theme'

export type TipoAviso = 'ok' | 'error'

export interface Aviso {
  texto: string
  tipo: TipoAviso
}

// Los errores duran más: el técnico tiene que llegar a leerlos completos.
const DURACION_OK_MS = 3200
const DURACION_ERROR_MS = 5000

export function ToastAviso({ aviso, onOcultar }: { aviso: Aviso | null; onOcultar: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // En ref: el caller pasa un arrow inline y no queremos rearmar el timer
  // (alargando el toast) en cada render del padre.
  const onOcultarRef = useRef(onOcultar)
  onOcultarRef.current = onOcultar

  useEffect(() => {
    if (!aviso) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onOcultarRef.current(), aviso.tipo === 'error' ? DURACION_ERROR_MS : DURACION_OK_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [aviso])

  if (!aviso) return null

  const esError = aviso.tipo === 'error'
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: THEME.space.lg, right: THEME.space.lg, bottom: THEME.space.xxl }}>
      <FadeInUp>
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: THEME.space.sm,
            backgroundColor: THEME.color.navy, borderRadius: THEME.radius.lg,
            paddingHorizontal: THEME.space.lg, paddingVertical: THEME.space.md,
            borderLeftWidth: 4, borderLeftColor: esError ? THEME.color.danger : THEME.color.success,
            ...THEME.shadow.lg,
          }}
        >
          <Ionicons
            name={esError ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color={esError ? THEME.color.danger : THEME.color.success}
            style={{ marginTop: 1 }}
          />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.white, flex: 1, lineHeight: 19 }}>
            {aviso.texto}
          </Text>
        </View>
      </FadeInUp>
    </View>
  )
}

export default ToastAviso
