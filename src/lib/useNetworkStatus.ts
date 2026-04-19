import { useState, useEffect, useRef } from 'react'
import { AppState } from 'react-native'

/**
 * Hook that tracks network connectivity by periodically checking
 * a lightweight endpoint. More reliable than NetInfo on Android.
 */
export function useNetworkStatus(checkIntervalMs = 15000): boolean {
  const [isConnected, setIsConnected] = useState(true)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>

    async function checkConnection() {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        await fetch('https://solu.pe/api/health', {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeout)
        setIsConnected(true)
      } catch {
        setIsConnected(false)
      }
    }

    // Check immediately
    checkConnection()

    // Check periodically when app is active
    intervalId = setInterval(checkConnection, checkIntervalMs)

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkConnection()
      }
      appState.current = nextState
    })

    return () => {
      clearInterval(intervalId)
      subscription.remove()
    }
  }, [checkIntervalMs])

  return isConnected
}
