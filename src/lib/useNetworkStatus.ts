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
        // www.solu.pe sirve directo; el host sin-www hace un 301 extra.
        await fetch('https://www.solu.pe/api/health', {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeout)
        setIsConnected(true)
      } catch {
        setIsConnected(false)
      }
    }

    // Re-arma el chequeo periódico (idempotente: limpia el anterior).
    function startInterval() {
      clearInterval(intervalId)
      intervalId = setInterval(checkConnection, checkIntervalMs)
    }

    // Check immediately
    checkConnection()

    // Check periodically when app is active
    startInterval()

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // Al volver a foreground: chequeo inmediato + re-arma el intervalo.
        checkConnection()
        startInterval()
      } else if (nextState.match(/inactive|background/)) {
        // En background pausamos el polling para no drenar datos/batería.
        clearInterval(intervalId)
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
