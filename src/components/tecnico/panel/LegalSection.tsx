// Bloque legal + soporte + baja de cuenta. Se muestra tanto en el login como
// al pie del panel del técnico.

import { Linking, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { useRouter } from 'expo-router'
import { waLink, SUPPORT_PHONE } from '../../../lib/constants'
import { APP_VERSION_LABEL } from '../../../lib/appVersion'
import { THEME } from '../../../lib/theme'
import { PressableScale } from '../../ui/Motion'

export function LegalSection({ router }: { router: ReturnType<typeof useRouter> }) {
  // "Eliminar mi cuenta" iba pegado debajo de "Soporte por WhatsApp" y la
  // gente terminaba escribiéndole al soporte para pedir la baja, que la
  // app ya hace sola. Se aclara el destino de cada uno y el de borrado
  // queda al final, separado.
  const items: { icon: string; label: string; sub?: string; route: string | null; danger?: boolean }[] = [
    { icon: 'shield-checkmark-outline', label: 'Política de Privacidad', route: '/privacidad' },
    { icon: 'document-text-outline', label: 'Términos y Condiciones', route: '/terminos' },
    { icon: 'chatbubble-ellipses-outline', label: 'Soporte por WhatsApp', sub: 'Dudas sobre leads, coins o pagos', route: null },
    { icon: 'trash-outline', label: 'Eliminar mi cuenta', sub: 'Inmediato, sin escribirle a nadie', route: '/eliminar-cuenta', danger: true },
  ]
  return (
    <View style={{ margin: THEME.space.lg, marginBottom: 40 }}>
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, overflow: 'hidden', ...THEME.shadow.sm }}>
        {items.map((item, i) => {
          const tint = item.danger ? THEME.color.danger : THEME.color.inkSoft
          return (
            <PressableScale
              key={i}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- las rutas legales no están en el union tipado del router
              onPress={() => item.route ? router.push(item.route as any) : Linking.openURL(waLink(SUPPORT_PHONE, 'Hola, necesito soporte con SOLU'))}
              accessibilityLabel={item.label}
              style={{ flexDirection: 'row', alignItems: 'center', padding: THEME.space.lg, minHeight: 48, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: THEME.color.lineSoft }}
            >
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={tint} />
              <View style={{ flex: 1, marginLeft: THEME.space.md }}>
                <Text style={{ ...THEME.font.bodySm, fontWeight: '600', color: tint }}>{item.label}</Text>
                {item.sub && (
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 1 }}>{item.sub}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={14} color={THEME.color.inkMuted} />
            </PressableScale>
          )
        })}
        <View style={{ padding: THEME.space.lg, alignItems: 'center' }}>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>SOLU {APP_VERSION_LABEL} · CITYLAND GROUP E.I.R.L.</Text>
        </View>
      </View>
    </View>
  )
}

export default LegalSection
