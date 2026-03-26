import { useEffect, useRef } from 'react'
import { View, Animated, ViewStyle } from 'react-native'

/**
 * Shimmer skeleton loader - premium loading state.
 * Use instead of ActivityIndicator for card/list loading.
 */
function ShimmerBlock({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [])

  return (
    <Animated.View style={[{ backgroundColor: '#E2E8F0', borderRadius: 8, opacity }, style]} />
  )
}

/** Skeleton for a TechCard in search results */
export function TechCardSkeleton() {
  return (
    <View style={{
      backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
      flexDirection: 'row', gap: 12, elevation: 1,
    }}>
      {/* Avatar */}
      <ShimmerBlock style={{ width: 56, height: 56, borderRadius: 14 }} />
      {/* Content */}
      <View style={{ flex: 1, gap: 8 }}>
        <ShimmerBlock style={{ width: '60%', height: 14 }} />
        <ShimmerBlock style={{ width: '40%', height: 10 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <ShimmerBlock style={{ width: 50, height: 10 }} />
          <ShimmerBlock style={{ width: 70, height: 10 }} />
          <ShimmerBlock style={{ width: 40, height: 10 }} />
        </View>
      </View>
    </View>
  )
}

/** Skeleton for the home screen tech list */
export function HomeTechSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2].map((i) => <TechCardSkeleton key={i} />)}
    </View>
  )
}

/** Skeleton for a tech profile page */
export function ProfileSkeleton() {
  return (
    <View style={{ padding: 20, gap: 16 }}>
      {/* Header */}
      <View style={{ alignItems: 'center', gap: 12 }}>
        <ShimmerBlock style={{ width: 96, height: 96, borderRadius: 48 }} />
        <ShimmerBlock style={{ width: 180, height: 20 }} />
        <ShimmerBlock style={{ width: 120, height: 12 }} />
      </View>
      {/* Stats */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
        <ShimmerBlock style={{ width: 60, height: 40, borderRadius: 10 }} />
        <ShimmerBlock style={{ width: 60, height: 40, borderRadius: 10 }} />
        <ShimmerBlock style={{ width: 60, height: 40, borderRadius: 10 }} />
      </View>
      {/* Description */}
      <View style={{ gap: 8, marginTop: 8 }}>
        <ShimmerBlock style={{ width: '100%', height: 12 }} />
        <ShimmerBlock style={{ width: '90%', height: 12 }} />
        <ShimmerBlock style={{ width: '75%', height: 12 }} />
      </View>
      {/* Reviews */}
      <ShimmerBlock style={{ width: 140, height: 16, marginTop: 12 }} />
      {[0, 1].map((i) => (
        <View key={i} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ShimmerBlock style={{ width: 32, height: 32, borderRadius: 16 }} />
            <View style={{ gap: 6, flex: 1 }}>
              <ShimmerBlock style={{ width: '50%', height: 12 }} />
              <ShimmerBlock style={{ width: '30%', height: 10 }} />
            </View>
          </View>
          <ShimmerBlock style={{ width: '100%', height: 10 }} />
          <ShimmerBlock style={{ width: '80%', height: 10 }} />
        </View>
      ))}
    </View>
  )
}

/** Skeleton for search results */
export function SearchSkeleton() {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {[0, 1, 2, 3, 4].map((i) => <TechCardSkeleton key={i} />)}
    </View>
  )
}

/** Generic content skeleton */
export function ContentSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ gap: 10, padding: 20 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock key={i} style={{ width: `${90 - i * 10}%`, height: 12 }} />
      ))}
    </View>
  )
}
