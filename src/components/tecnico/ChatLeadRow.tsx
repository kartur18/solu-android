// Fila de la bandeja: un cliente que contactó al técnico.
//
// Tiene que responder tres preguntas de un vistazo, sin abrir nada: quién
// escribió, cuánto cuesta responderle y cuán urgente es. Antes solo mostraba
// el costo, así que un lead de emergencia esperando 3 horas se veía igual que
// uno frío de la semana pasada.

import { Ionicons } from '@expo/vector-icons'
import { View, Text } from 'react-native'
import { THEME } from '../../lib/theme'
import { PressableScale, Shimmer } from '../ui/Motion'
import {
  aSoles, alcanzaSaldo, capitalizar, esperando, formatCoins, hace, nivelUrgencia,
  nombreCliente, type ChatResumen, type PrecioLead,
} from './lead-utils'

export function ChatLeadRow({
  chat,
  precio,
  saldo,
  onPress,
}: {
  chat: ChatResumen
  precio: PrecioLead | null | undefined
  saldo: number | null
  onPress: () => void
}) {
  const nombre = nombreCliente(chat)
  const servicio = chat.servicio_buscado ? capitalizar(chat.servicio_buscado) : 'Servicio'
  const nuevos = chat.mensajes_nuevos > 0
  const urgencia = nivelUrgencia(precio?.urgencia)
  const espera = nuevos ? esperando(chat.ultimo_mensaje_at ?? chat.created_at) : ''
  const hayChips = !!urgencia || precio === undefined || (precio != null && precio.costo_coins != null)

  const etiquetaAccesible = [
    `Abrir chat con ${nombre}`,
    nuevos
      ? `${chat.mensajes_nuevos} ${chat.mensajes_nuevos === 1 ? 'mensaje' : 'mensajes'} sin leer, esperando ${espera}`
      : 'sin mensajes nuevos',
    urgencia === 'emergencia' ? 'emergencia' : urgencia === 'urgente' ? 'urgente' : '',
  ].filter(Boolean).join('. ')

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={etiquetaAccesible}
      style={{
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.lg,
        padding: THEME.space.lg,
        borderWidth: 1,
        borderColor: nuevos ? THEME.color.brandSoft : THEME.color.line,
        ...(nuevos ? THEME.shadow.md : THEME.shadow.sm),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md }}>
        <View style={{
          width: 44, height: 44, borderRadius: THEME.radius.full,
          backgroundColor: nuevos ? THEME.color.brand : THEME.color.surfaceSunken,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ ...THEME.font.h3, color: nuevos ? THEME.color.white : THEME.color.inkSoft }}>
            {nombre.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm }}>
            <Text numberOfLines={1} style={{ ...THEME.font.h3, color: THEME.color.ink, flexShrink: 1 }}>
              {nombre}
            </Text>
            {nuevos && (
              <View style={{
                backgroundColor: THEME.color.brand, borderRadius: THEME.radius.full,
                minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center',
              }}>
                <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.white }}>
                  {chat.mensajes_nuevos}
                </Text>
              </View>
            )}
          </View>

          <Text numberOfLines={1} style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, marginTop: 1 }}>
            {servicio}
            {chat.distrito ? ` · ${capitalizar(chat.distrito)}` : ''}
          </Text>

          <Text numberOfLines={1} style={{ ...THEME.font.bodySm, color: THEME.color.inkMuted, marginTop: 3 }}>
            {chat.ultimo_mensaje ?? 'Sin mensajes aún'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: THEME.space.xs, maxWidth: 96 }}>
          <Text
            numberOfLines={1}
            style={{
              ...THEME.font.caption,
              fontWeight: nuevos ? '800' : '500',
              color: nuevos ? THEME.color.brandDark : THEME.color.inkMuted,
            }}
          >
            {nuevos ? `espera ${espera}` : hace(chat.ultimo_mensaje_at ?? chat.created_at)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={THEME.color.inkMuted} />
        </View>
      </View>

      {/* Sin chips que mostrar no dejamos la fila con un hueco muerto abajo. */}
      {hayChips && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: THEME.space.sm, marginTop: THEME.space.md }}>
          {urgencia && <ChipUrgencia nivel={urgencia} />}
          <ChipCosto precio={precio} saldo={saldo} />
        </View>
      )}
    </PressableScale>
  )
}

// El endpoint de precio ya devolvía la urgencia del pedido; mostrarla es lo
// que le permite al técnico decidir a quién contesta primero.
function ChipUrgencia({ nivel }: { nivel: 'emergencia' | 'urgente' }) {
  const emergencia = nivel === 'emergencia'
  return (
    <Etiqueta
      icono={emergencia ? 'flash' : 'time'}
      color={emergencia ? THEME.color.danger : '#B45309'}
      fondo={emergencia ? THEME.color.dangerBg : THEME.color.warningBg}
      texto={emergencia ? 'Emergencia' : 'Urgente'}
    />
  )
}

// Costo visible en la lista: el técnico sabe cuánto vale responder antes de
// entrar, no después del descuento.
function ChipCosto({ precio, saldo }: { precio: PrecioLead | null | undefined; saldo: number | null }) {
  if (precio === undefined) {
    return <Shimmer style={{ height: 20, width: 150, borderRadius: THEME.radius.full }} />
  }
  if (precio === null || precio.costo_coins == null) return null

  if (precio.ya_pagado) {
    return (
      <Etiqueta
        icono="checkmark-circle"
        color={THEME.color.success}
        fondo={THEME.color.successBg}
        texto="Lead pagado · responder no cuesta"
      />
    )
  }

  if (precio.ilimitado) {
    return (
      <Etiqueta
        icono="infinite"
        color={THEME.color.info}
        fondo={THEME.color.infoBg}
        texto="Responder no consume saldo"
      />
    )
  }

  const costo = precio.costo_coins
  if (!alcanzaSaldo(precio, saldo)) {
    return (
      <Etiqueta
        icono="alert-circle"
        color={THEME.color.danger}
        fondo={THEME.color.dangerBg}
        texto={`Responder cuesta ${formatCoins(costo)} coins · te falta saldo`}
      />
    )
  }

  return (
    <Etiqueta
      icono="chatbubble-ellipses"
      color={THEME.color.brandDark}
      fondo={THEME.color.brandLight}
      texto={`Responder cuesta ${formatCoins(costo)} coins ≈ S/${aSoles(costo)}`}
    />
  )
}

export function Etiqueta({
  icono,
  color,
  fondo,
  texto,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name']
  color: string
  fondo: string
  texto: string
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: THEME.space.xs,
      alignSelf: 'flex-start',
      backgroundColor: fondo, borderRadius: THEME.radius.full,
      paddingHorizontal: THEME.space.md, paddingVertical: 5,
    }}>
      <Ionicons name={icono} size={13} color={color} />
      <Text style={{ ...THEME.font.caption, fontWeight: '700', color }}>{texto}</Text>
    </View>
  )
}

export default ChatLeadRow
