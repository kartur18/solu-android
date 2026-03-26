import { useState, useEffect } from 'react'
import { Alert, Linking } from 'react-native'
import Constants from 'expo-constants'
import { ENV } from './env'

interface VersionInfo {
  currentVersion: string
  minimumVersion: string
  updateUrl: string
  message: string
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
  }
  return 0
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    checkForUpdate()
  }, [])

  async function checkForUpdate() {
    try {
      const res = await fetch(`${ENV.API_BASE_URL}/app-version`, { method: 'GET' })
      if (!res.ok) return

      const info: VersionInfo = await res.json()
      const appVersion = Constants.expoConfig?.version || '1.0.0'

      // Force update if below minimum
      if (compareVersions(appVersion, info.minimumVersion) < 0) {
        Alert.alert(
          'Actualización requerida',
          'Hay una nueva versión de SOLU que debes instalar para continuar.',
          [{ text: 'Actualizar', onPress: () => Linking.openURL(info.updateUrl) }],
          { cancelable: false }
        )
        return
      }

      // Optional update if below current
      if (compareVersions(appVersion, info.currentVersion) < 0) {
        setUpdateAvailable(true)
      }
    } catch {
      // Silent fail - don't block app usage
    }
  }

  return { updateAvailable }
}
