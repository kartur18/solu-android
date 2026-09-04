// Invitación al testing cerrado de SOLU en Play Store.
//
// Google exige 12 testers opted-in durante 14 días seguidos antes de habilitar
// producción, así que el reclutamiento vive dentro del panel del técnico. El
// dato que se pide NO es el email con el que se registró en SOLU (varios están
// con Hotmail): Play Store solo admite la cuenta de Google con la que el
// celular tiene sesión, y el copy tiene que dejarlo clarísimo.

import { useState } from 'react'
import { ActivityIndicator, Linking, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ENV, fetchWithTimeout } from '../../../lib/env'
import { getTechToken } from '../../../lib/tech-session'
import { logger } from '../../../lib/logger'
import { THEME } from '../../../lib/theme'

const LINK_TESTING = 'https://play.google.com/apps/testing/pe.solu.app'

// Validación laxa a propósito: acepta Workspace (@miempresa.com) porque también
// son cuentas de Google. Solo bloquea lo que ni siquiera parece un correo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function InvitacionPlayTester({
  emailGuardado,
  emailSugerido,
}: {
  // Lo que ya está en tecnicos.play_tester_email (llega vía /api/tecnico/me).
  emailGuardado?: string | null
  // Email de registro: se precarga SOLO si ya es de Google, para no empujar al
  // técnico a repetir su Hotmail, que es justo el error que rompe el testing.
  emailSugerido?: string | null
}) {
  const sugerido = emailSugerido && /@(gmail|googlemail)\.com$/i.test(emailSugerido.trim()) ? emailSugerido.trim() : ''
  const [email, setEmail] = useState(sugerido)
  const [guardadoLocal, setGuardadoLocal] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anotado = guardadoLocal ?? emailGuardado ?? null

  // El tester tiene que instalar desde Play Store: en iOS la tarjeta solo sería ruido.
  if (Platform.OS !== 'android') return null

  async function guardar() {
    const limpio = email.trim().toLowerCase()
    if (!EMAIL_RE.test(limpio)) {
      setError('Escribe un correo válido, por ejemplo tucorreo@gmail.com')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const bearer = await getTechToken()
      if (!bearer) throw new Error('sin_sesion')
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/tecnico/play-tester`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ email: limpio }),
        timeout: 15000,
      })
      if (!res.ok) throw new Error(res.status === 429 ? 'rate' : `http_${res.status}`)
      setGuardadoLocal(limpio)
      setEditando(false)
    } catch (err) {
      logger.error('play-tester save failed:', err)
      const causa = err instanceof Error ? err.message : ''
      setError(
        causa === 'sin_sesion'
          ? 'Tu sesión venció. Vuelve a entrar y prueba de nuevo.'
          : causa === 'rate'
            ? 'Muchos intentos seguidos. Espera un minuto y prueba de nuevo.'
            : 'No pudimos guardar tu correo. Revisa tu conexión e inténtalo de nuevo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  const mostrandoFormulario = !anotado || editando

  return (
    <View
      style={{
        backgroundColor: THEME.color.surface,
        borderRadius: THEME.radius.lg,
        padding: THEME.space.lg,
        borderWidth: 1,
        borderColor: THEME.color.brandSoft,
        ...THEME.shadow.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.md, marginBottom: THEME.space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: THEME.radius.md, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="logo-google-playstore" size={22} color={THEME.color.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>
            {anotado ? 'Ya estás en la lista de testers' : 'Ayúdanos a publicar SOLU en Play Store'}
          </Text>
          <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2 }}>
            {anotado
              ? 'Falta un paso tuyo para que cuentes'
              : 'Google nos pide 12 técnicos probando la app'}
          </Text>
        </View>
      </View>

      {mostrandoFormulario ? (
        <>
          <Text style={{ ...THEME.font.bodySm, color: THEME.color.inkSoft, lineHeight: 19, marginBottom: THEME.space.md }}>
            Déjanos tu cuenta de Google y recibes SOLU por Play Store, con actualizaciones automáticas.
          </Text>

          <View style={{ backgroundColor: THEME.color.warningBg, borderRadius: THEME.radius.md, padding: THEME.space.md, flexDirection: 'row', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
            <Ionicons name="alert-circle" size={18} color={THEME.color.warning} />
            <Text style={{ flex: 1, ...THEME.font.caption, color: THEME.color.ink, lineHeight: 16 }}>
              Ojo: no es el correo con el que te registraste en SOLU. Tiene que ser la cuenta de Google
              con la que tu celular tiene sesión en Play Store (casi siempre termina en @gmail.com).
            </Text>
          </View>

          <Text style={{ ...THEME.font.label, color: THEME.color.ink, marginBottom: 6 }}>
            Tu cuenta de Google
          </Text>
          <TextInput
            value={email}
            onChangeText={(t) => { setEmail(t); if (error) setError(null) }}
            placeholder="tucorreo@gmail.com"
            placeholderTextColor={THEME.color.inkMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            editable={!enviando}
            accessibilityLabel="Cuenta de Google de tu celular"
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: error ? THEME.color.danger : THEME.color.line,
              borderRadius: THEME.radius.md,
              paddingHorizontal: THEME.space.md,
              backgroundColor: THEME.color.surfaceAlt,
              ...THEME.font.body,
              color: THEME.color.ink,
            }}
          />

          {error ? (
            <Text accessibilityRole="alert" style={{ ...THEME.font.caption, color: THEME.color.danger, marginTop: 6 }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={() => { void guardar() }}
            disabled={enviando}
            accessibilityLabel="Anotarme como tester de la app"
            style={{
              marginTop: THEME.space.md,
              minHeight: 48,
              borderRadius: THEME.radius.md,
              backgroundColor: enviando ? THEME.color.brandSoft : THEME.color.brand,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: THEME.space.sm,
            }}
          >
            {enviando ? (
              <ActivityIndicator size="small" color={THEME.color.brand} />
            ) : (
              <Ionicons name="rocket" size={16} color={THEME.color.white} />
            )}
            <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: enviando ? THEME.color.brandDark : THEME.color.white }}>
              {enviando ? 'Guardando...' : 'Quiero probar la app'}
            </Text>
          </TouchableOpacity>

          {anotado && editando ? (
            <TouchableOpacity
              onPress={() => { setEditando(false); setError(null) }}
              accessibilityLabel="Cancelar el cambio de correo"
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
            >
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft }}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <>
          <View style={{ backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.md, padding: THEME.space.md, flexDirection: 'row', gap: THEME.space.sm, marginBottom: THEME.space.md }}>
            <Ionicons name="checkmark-circle" size={18} color={THEME.color.success} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...THEME.font.caption, fontWeight: '800', color: THEME.color.ink }}>Anotamos {anotado}</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginTop: 2, lineHeight: 16 }}>
                Último paso: abre el enlace desde este celular y toca "Convertirme en tester" con esa misma cuenta.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => { void Linking.openURL(LINK_TESTING) }}
            accessibilityLabel="Abrir el enlace del testing en Play Store"
            style={{
              minHeight: 48,
              borderRadius: THEME.radius.md,
              backgroundColor: THEME.color.brand,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: THEME.space.sm,
            }}
          >
            <Ionicons name="open-outline" size={16} color={THEME.color.white} />
            <Text style={{ ...THEME.font.bodySm, fontWeight: '800', color: THEME.color.white }}>Abrir el enlace de Play Store</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setEmail(anotado); setEditando(true) }}
            accessibilityLabel="Cambiar la cuenta de Google que diste"
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
          >
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.inkSoft }}>
              ¿Te equivocaste? Cambia tu correo
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

export default InvitacionPlayTester
