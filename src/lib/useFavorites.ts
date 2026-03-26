import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const FAVORITES_KEY = 'solu_favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>([])

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(stored => {
      if (stored) setFavorites(JSON.parse(stored))
    })
  }, [])

  const toggleFavorite = useCallback(async (techId: number) => {
    setFavorites(prev => {
      const next = prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isFavorite = useCallback((techId: number) => favorites.includes(techId), [favorites])

  return { favorites, toggleFavorite, isFavorite }
}
