import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import { logger } from '../lib/logger'
import {
  getAudioApi, refreshSignedUrl, formatAudioDuration,
  type ExpoSound, type PlaybackStatus,
} from '../lib/audioChat'

interface Props {
  url: string
  durationMs?: number
  mine: boolean
}

/**
 * Burbuja de nota de voz: play/pausa + barra de progreso + duración.
 * Si expo-av no está instalado, el play abre la signed URL en el navegador.
 */
export function AudioMessageBubble({ url, durationMs, mine }: Props) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [totalMs, setTotalMs] = useState(durationMs ?? 0)
  const soundRef = useRef<ExpoSound | null>(null)

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {})
      soundRef.current = null
    }
  }, [])

  function onStatus(status: PlaybackStatus) {
    if (!status.isLoaded) return
    setPositionMs(status.positionMillis ?? 0)
    if (status.durationMillis) setTotalMs(status.durationMillis)
    setPlaying(!!status.isPlaying)
    if (status.didJustFinish) {
      setPlaying(false)
      setPositionMs(0)
      soundRef.current?.setPositionAsync(0).catch(() => {})
    }
  }

  async function createSound(api: NonNullable<ReturnType<typeof getAudioApi>>, uri: string) {
    return api.Sound.createAsync({ uri }, { shouldPlay: true, progressUpdateIntervalMillis: 250 }, onStatus)
  }

  async function togglePlay() {
    const api = getAudioApi()
    if (!api) {
      // Fallback sin expo-av: reproducir la signed URL en el navegador
      Linking.openURL(url).catch((err) => logger.warn('Audio open error:', err))
      return
    }
    try {
      if (soundRef.current) {
        if (playing) await soundRef.current.pauseAsync()
        else await soundRef.current.playAsync()
        return
      }
      setLoading(true)
      await api.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
      let result
      try {
        result = await createSound(api, url)
      } catch {
        // Signed URL vencida (>7 días): re-firmar y reintentar una vez
        const fresh = await refreshSignedUrl(url)
        if (!fresh) throw new Error('audio-url-expired')
        result = await createSound(api, fresh)
      }
      soundRef.current = result.sound
      setPlaying(true)
    } catch (err) {
      logger.error('Audio play error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fg = mine ? '#fff' : COLORS.pri
  const track = mine ? 'rgba(255,255,255,0.35)' : COLORS.border
  const progress = totalMs > 0 ? Math.min(1, positionMs / totalMs) : 0
  const label = formatAudioDuration(playing || positionMs > 0 ? positionMs : totalMs)

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 170, paddingVertical: 2 }}>
      <TouchableOpacity
        onPress={togglePlay}
        disabled={loading}
        accessibilityLabel={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: mine ? 'rgba(255,255,255,0.25)' : COLORS.priLight,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color={fg} style={{ marginLeft: playing ? 0 : 2 }} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: fg, borderRadius: 2 }} />
        </View>
        <Text style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.85)' : COLORS.gray }}>
          {label}
        </Text>
      </View>
      <Ionicons name="mic" size={14} color={mine ? 'rgba(255,255,255,0.7)' : COLORS.gray2} />
    </View>
  )
}
