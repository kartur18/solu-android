import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Modal, FlatList, Animated, Dimensions,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import { supabase } from '../lib/supabase'
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
}

export default function NotificationCenter({ visible, onClose, techId }: Props) {
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(false)
  const [slideAnim] = useState(new Animated.Value(SCREEN_WIDTH))

  const unreadCount = notifications.filter(n => !n.leido).length

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('tecnico_id', techId)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data || [])
    } catch {}
    setLoading(false)
  }, [techId])

  useEffect(() => {
    if (visible) {
      fetchNotifications()
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
    } else {
      slideAnim.setValue(SCREEN_WIDTH)
    }
  }, [visible])

  async function markAsRead(notifId: number) {
    try {
      await supabase.from('notificaciones').update({ leido: true }).eq('id', notifId)
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, leido: true } : n))
    } catch {}
  }

  async function markAllAsRead() {
    try {
      const unreadIds = notifications.filter(n => !n.leido).map(n => n.id)
      if (unreadIds.length === 0) return
      await supabase.from('notificaciones').update({ leido: true }).eq('tecnico_id', techId).eq('leido', false)
      setNotifications(prev => prev.map(n => ({ ...n, leido: true })))
    } catch {}
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
              style={{
                width: 36, height: 36, borderRadius: 18,
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
                gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
              }}
            >
              <Ionicons name="checkmark-done" size={16} color="#2563EB" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
                Marcar todas como leidas
              </Text>
            </TouchableOpacity>
          )}

          {/* Content */}
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.pri} />
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
                No tienes notificaciones
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.gray2, textAlign: 'center' }}>
                Aqui apareceran las notificaciones de tus servicios
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
