import { useState, useEffect, useRef } from 'react'
import { View, Text, Modal, TouchableOpacity, Dimensions, Animated } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SLIDES = [
  {
    icon: 'construct' as const,
    title: 'Encuentra profesionales verificados',
    subtitle: 'Con DNI validado en RENIEC y reseñas reales',
  },
  {
    icon: 'logo-whatsapp' as const,
    title: 'Contacta directo por WhatsApp',
    subtitle: 'Sin intermediarios, tú decides',
  },
  {
    icon: 'star' as const,
    title: 'Califica y comparte tu experiencia',
    subtitle: 'Ayuda a otros a encontrar a los mejores',
  },
]

export function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    AsyncStorage.getItem('solu_onboarding_done').then((value) => {
      if (!value) setVisible(true)
    })
  }, [])

  function animateTransition(nextSlide: number) {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentSlide(nextSlide)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start()
    })
  }

  function handleNext() {
    if (currentSlide < SLIDES.length - 1) {
      animateTransition(currentSlide + 1)
    }
  }

  async function handleClose() {
    await AsyncStorage.setItem('solu_onboarding_done', 'true')
    setVisible(false)
  }

  if (!visible) return null

  const slide = SLIDES[currentSlide]
  const isLast = currentSlide === SLIDES.length - 1

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={{
        flex: 1,
        backgroundColor: '#1E3A5F',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
      }}>
        {/* Skip button */}
        {!isLast && (
          <TouchableOpacity
            onPress={handleClose}
            accessibilityLabel="Saltar introducción"
            style={{ position: 'absolute', top: 52, right: 16, zIndex: 10, padding: 12, minHeight: 44, justifyContent: 'center' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' }}>Saltar</Text>
          </TouchableOpacity>
        )}

        {/* Slide content */}
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}>
            <Ionicons name={slide.icon} size={56} color={COLORS.pri} accessibilityElementsHidden />
          </View>
          <Text style={{
            fontSize: 26,
            fontWeight: '900',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 14,
            lineHeight: 34,
          }}>
            {slide.title}
          </Text>
          <Text style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
            lineHeight: 24,
          }}>
            {slide.subtitle}
          </Text>
        </Animated.View>

        {/* Bottom controls */}
        <View style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingHorizontal: 40,
        }}>
          {/* Dot indicators */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 32 }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentSlide ? 28 : 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: i === currentSlide ? COLORS.pri : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </View>

          {/* Action button */}
          <TouchableOpacity
            onPress={isLast ? handleClose : handleNext}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{
              backgroundColor: COLORS.pri,
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 48,
              width: '100%',
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>
              {isLast ? 'Empezar' : 'Siguiente'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
