// ════════════════════════════════════════════════════════════════════
// Motion — primitivos de animación reutilizables (SOLU redesign 2026)
// ════════════════════════════════════════════════════════════════════
// Componentes base para micro-interacciones modernas: entrada con
// fade+slide, press con scale + haptics, skeleton shimmer. Construidos
// sobre react-native-reanimated 4 + expo-haptics.

import React, { useEffect } from 'react'
import { Pressable, ViewStyle, StyleProp, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated'

// ── FadeInUp: entra con fade + slide hacia arriba. delay para stagger. ──
export function FadeInUp({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode
  delay?: number
  distance?: number
  style?: StyleProp<ViewStyle>
}) {
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }))
  }, [delay, p])
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: interpolate(p.value, [0, 1], [distance, 0]) }],
  }))
  return <Animated.View style={[anim, style]}>{children}</Animated.View>
}

// ── PressableScale: botón/card que se hunde al tocar + haptic. ──
export function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.96,
  haptic = true,
  disabled = false,
  accessibilityLabel,
}: {
  children: React.ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  scaleTo?: number
  haptic?: boolean
  disabled?: boolean
  accessibilityLabel?: string
}) {
  const s = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  return (
    <Pressable
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        s.value = withSpring(scaleTo, { mass: 0.4, damping: 14 })
      }}
      onPressOut={() => {
        s.value = withSpring(1, { mass: 0.4, damping: 12 })
      }}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress?.()
      }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[anim, style]}>{children}</Animated.View>
    </Pressable>
  )
}

// ── Shimmer: skeleton de carga con barrido animado. ──
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, false)
  }, [p])
  const anim = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.5, 1], [0.4, 0.8, 0.4]) }))
  return <Animated.View style={[{ backgroundColor: '#E9EDF2', borderRadius: 12 }, style, anim]} />
}

// ── Pulse: punto/badge que late (ej. "disponible ahora"). ──
export function PulseDot({ color = '#16A34A', size = 8 }: { color?: string; size?: number }) {
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false)
  }, [p])
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.5, 0]),
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 2.4]) }],
  }))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  )
}

// Re-export del haptic para usos puntuales (success al cerrar acciones).
export const haptics = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
}
