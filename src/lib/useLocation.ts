import { useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import { DISTRITOS } from './constants'
import { logger } from './logger'

export interface LocationState {
  distrito: string | null
  loading: boolean
  error: string | null
  coords: { latitude: number; longitude: number } | null
}

/**
 * Match a reverse-geocoded address against the DISTRITOS array.
 * Checks subLocality, city, and district fields (case-insensitive).
 */
function matchDistrito(address: Location.LocationGeocodedAddress): string | null {
  const candidates: string[] = []
  if (address.subregion) candidates.push(address.subregion)
  if (address.city) candidates.push(address.city)
  if (address.district) candidates.push(address.district)
  if (address.name) candidates.push(address.name)
  if (address.region) candidates.push(address.region)

  for (const candidate of candidates) {
    if (!candidate) continue
    const lower = candidate.toLowerCase().trim()
    for (const d of DISTRITOS) {
      if (d.toLowerCase() === lower) return d
      // Partial match: "Santiago de Surco" matches "Surco"
      if (lower.includes(d.toLowerCase()) || d.toLowerCase().includes(lower)) return d
    }
  }
  return null
}

export function useLocationDetection() {
  const [state, setState] = useState<LocationState>({
    distrito: null,
    loading: false,
    error: null,
    coords: null,
  })

  const detectLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setState((prev) => ({ ...prev, loading: false, error: 'permiso_denegado' }))
        return null
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      const { latitude, longitude } = location.coords
      setState((prev) => ({ ...prev, coords: { latitude, longitude } }))

      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude })
      if (address) {
        const matched = matchDistrito(address)
        setState((prev) => ({
          ...prev,
          distrito: matched,
          loading: false,
        }))
        return matched
      }

      setState((prev) => ({ ...prev, loading: false }))
      return null
    } catch (err) {
      logger.error('Error detecting location:', err)
      setState((prev) => ({ ...prev, loading: false, error: 'error_ubicacion' }))
      return null
    }
  }, [])

  return { ...state, detectLocation }
}
