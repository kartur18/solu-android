import { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { iniciarChatLead, openTechWhatsapp } from './contacto'
import { useClientProfile } from './useClientProfile'
import { haptics } from '../components/ui/Motion'
import type { Tecnico } from './types'

// Orquesta el contacto PRIMARIO in-app: crea el lead vía POST /api/contactos
// (cobra coin al técnico, queda registrado) y navega al chat del cliente.
// Si falta nombre o WhatsApp del perfil, abre un modal para capturarlos
// antes de continuar. WhatsApp queda como respaldo si el POST falla.

const WHATSAPP_RE = /^9\d{8}$/

export function useContactLead() {
  const router = useRouter()
  const { profile, save } = useClientProfile()
  // Técnico pendiente: si está seteado, el modal de perfil está abierto.
  const [pendingTech, setPendingTech] = useState<Tecnico | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Crea el lead y navega al chat. Si falla, ofrece WhatsApp de respaldo.
  const crearYNavegar = useCallback(
    async (tech: Tecnico, nombre: string, whatsapp: string, distrito?: string) => {
      setEnviando(true)
      try {
        const lead = await iniciarChatLead(tech, { nombre, whatsapp, distrito })
        if (!lead) {
          Alert.alert(
            'No pudimos abrir el chat',
            'Hubo un problema al contactar al técnico. ¿Quieres intentarlo por WhatsApp?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'WhatsApp', onPress: () => { openTechWhatsapp(tech.id, tech.nombre) } },
            ],
          )
          return
        }
        haptics.success()
        router.push(`/chat-pedido/${lead.codigo}?as=cliente&token=${encodeURIComponent(lead.chatToken)}`)
      } finally {
        setEnviando(false)
      }
    },
    [router],
  )

  // Acción primaria "Contactar". Si el perfil está completo va directo;
  // si falta data abre el modal para capturarla.
  const contactar = useCallback(
    (tech: Tecnico) => {
      const nombre = profile?.nombre?.trim()
      const whatsapp = profile?.whatsapp?.replace(/\D/g, '')
      if (nombre && whatsapp && WHATSAPP_RE.test(whatsapp)) {
        void crearYNavegar(tech, nombre, whatsapp, profile?.distrito)
        return
      }
      setPendingTech(tech)
    },
    [profile, crearYNavegar],
  )

  // Confirmación del modal: guarda el perfil y continúa con el lead.
  const confirmarModal = useCallback(
    async (nombre: string, whatsapp: string) => {
      const tech = pendingTech
      if (!tech) return
      const wa = whatsapp.replace(/\D/g, '')
      await save({ nombre: nombre.trim(), whatsapp: wa })
      setPendingTech(null)
      await crearYNavegar(tech, nombre.trim(), wa, profile?.distrito)
    },
    [pendingTech, save, crearYNavegar, profile?.distrito],
  )

  const cerrarModal = useCallback(() => setPendingTech(null), [])

  return {
    contactar,
    enviando,
    modalVisible: pendingTech !== null,
    confirmarModal,
    cerrarModal,
    // Pre-llenado del modal desde el perfil existente.
    initialNombre: profile?.nombre ?? '',
    initialWhatsapp: profile?.whatsapp ?? '',
  }
}
