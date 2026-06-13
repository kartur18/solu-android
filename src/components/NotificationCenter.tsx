import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Modal, FlatList, Animated, Dimensions,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import {
  fetchNotifications as apiFetchNotifications,
  markNotifRead as apiMarkNotifRead,
  markAllNotifRead as apiMarkAllNotifRead,
} from '../lib/notif-api'
import type { Notificacion } from '../lib/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const NOTIF_ICONS: Record<string, string> = {
  nueva_solicitud: 'notifications',
  pago_recibido: 'cash',
  plan_vencimiento: 'warning',
  nueva_resena: 'star',
}

const NOTIF_COLORS: Record<string, string> = {
  nueva_solicitud: '#2563EB',
  pago_recibido: '#10B981',
  plan_vencimiento: '#F59E0B',
  nueva_resena: '#F59E0B',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  return `hace ${Math.floor(days / 30)} mes`
}

interface Props {
  visible: boolean
  onClose: () => void
  techId: number
  token: string | null
}

// Polling cada ~3s mientras el panel está abierto (los endpoints no tienen
// realtime, igual que la web).
const POLL_MS = 3000

export default function NotificationCenter({ visible, onClose, techId, token }: Props) {
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [slideAnim] = useState(new Animated.Value(SCREEN_WIDTH))

  const unreadCount = notifications.filter(n => !n.leido).length

  // `silent` evita el spinner en los refrescos del polling (solo la carga
  // inicial muestra "Cargando...").
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setLoadError(false)
    }
    try {
      const data = await apiFetchNotifications(token, 20, techId)
      setNotifications(data)
      setLoadError(false)
    } catch {
      if (!silent) setLoadError(true)
    }
    if (!silent) setLoading(false)
  }, [techId, token])

  useEffect(() => {
    if (visible) {
      fetchNotifications()
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
      const id = setInterval(() => { fetchNotifications(true) }, POLL_MS)
      return () => clearInterval(id)
    } else {
      slideAnim.setValue(SCREEN_WIDTH)
    }
  }, [visible, fetchNotifications])

  async function markAsRead(notifId: number) {
    // Optimista: marca en UI y revierte si el server falla.
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, leido: true } : n))
    const ok = await apiMarkNotifRead(token, techId, notifId)
    if (!ok) {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, leido: false } : n))
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) return
    const prevState = notifications
    setNotifications(prev => prev.map(n => ({ ...n, leido: true })))
    const ok = await apiMarkAllNotifRead(token, techId)
    if (!ok) {
      setNotifications(prevState)
    }
  }

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose())
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: SCREEN_WIDTH * 0.88,
            backgroundColor: '#fff',
            transform: [{ translateX: slideAnim }],
            shadowColor: '#000',
            shadowOffset: { width: -4, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
          }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.dark }}>Notificaciones</Text>
              {unreadCount > 0 && (
                <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 2 }}>
                  {unreadCount} sin leer
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityLabel="Cerrar notificaciones"
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
              }}
            >
              <Ionicons name="checkmark-done" size={16} color="#2563EB" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
                Marcar todas como leídas
              </Text>
            </TouchableOpacity>
          )}

          {/* Content */}
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="large" color={COLORS.pri} />
              <Text style={{ fontSize: 12, color: COLORS.gray2 }}>Cargando tus notificaciones...</Text>
            </View>
          ) : loadError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Ionicons name="cloud-offline-outline" size={36} color={COLORS.gray2} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.dark, marginTop: 12, marginBottom: 4 }}>
                No pudimos cargar tus notificaciones
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.gray2, textAlign: 'center', marginBottom: 16 }}>
                Revisa tu conexión a internet e intenta de nuevo
              </Text>
              <TouchableOpacity
                onPress={() => fetchNotifications()}
                style={{
                  backgroundColor: COLORS.pri, borderRadius: 12,
                  paddingHorizontal: 20, paddingVertical: 12, minHeight: 44, justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Ionicons name="notifications-off-outline" size={36} color={COLORS.gray2} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.dark, marginBottom: 4 }}>
                Sin notificaciones por ahora
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.gray2, textAlign: 'center', lineHeight: 17 }}>
                Aquí aparecerán los avisos de tus trabajos, pagos y reseñas
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const iconName = NOTIF_ICONS[item.tipo] || 'notifications'
                const iconColor = NOTIF_COLORS[item.tipo] || COLORS.gray
                const isUnread = !item.leido
                return (
                  <TouchableOpacity
                    onPress={() => { if (isUnread) markAsRead(item.id) }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      backgroundColor: isUnread ? '#F8FAFF' : '#fff',
                      borderLeftWidth: isUnread ? 3 : 0,
                      borderLeftColor: isUnread ? '#2563EB' : 'transparent',
                      borderBottomWidth: 1,
                      borderBottomColor: '#F1F5F9',
                    }}
                  >
                    <View style={{
                      width: 42, height: 42, borderRadius: 12,
                      backgroundColor: iconColor + '15',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={iconName as any} size={20} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{
                          fontSize: 13, fontWeight: isUnread ? '800' : '600',
                          color: COLORS.dark, flex: 1,
                        }}>
                          {item.titulo}
                        </Text>
                        <Text style={{ fontSize: 10, color: COLORS.gray2 }}>
                          {timeAgo(item.created_at)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 3, lineHeight: 17 }}>
                        {item.mensaje}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}
