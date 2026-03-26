import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'

interface RatingBreakdownProps {
  reviews: { calificacion: number }[]
  averageRating: number
  totalReviews: number
}

/**
 * Visual rating breakdown with bar chart (5★ to 1★).
 * Premium design like Thumbtack/TaskRabbit.
 */
export function RatingBreakdown({ reviews, averageRating, totalReviews }: RatingBreakdownProps) {
  // Count reviews per star level
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.calificacion === star).length,
  }))

  const maxCount = Math.max(...counts.map((c) => c.count), 1)

  return (
    <View style={{
      backgroundColor: '#fff', borderRadius: 16, padding: 20,
      flexDirection: 'row', gap: 20, elevation: 1,
    }}>
      {/* Left: Big rating number */}
      <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 80 }}>
        <Text style={{ fontSize: 42, fontWeight: '900', color: COLORS.dark }}>{averageRating.toFixed(1)}</Text>
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= Math.round(averageRating) ? 'star' : 'star-outline'}
              size={14}
              color="#F59E0B"
            />
          ))}
        </View>
        <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 4 }}>
          {totalReviews} reseña{totalReviews !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Right: Bar chart */}
      <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
        {counts.map(({ star, count }) => {
          const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
          return (
            <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.gray, width: 14, textAlign: 'right' }}>{star}</Text>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <View style={{ flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                <View style={{
                  width: `${percentage}%`,
                  height: '100%',
                  backgroundColor: star >= 4 ? '#10B981' : star === 3 ? '#F59E0B' : '#EF4444',
                  borderRadius: 4,
                }} />
              </View>
              <Text style={{ fontSize: 10, color: COLORS.gray2, width: 24, textAlign: 'right' }}>{count}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
