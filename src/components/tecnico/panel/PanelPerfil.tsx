// Pestaña "Perfil" del panel del técnico: foto, datos editables, oficios y
// zonas, documentos de verificación, galería de trabajos y cierre de sesión.
// Es el momento de más ansiedad del técnico (acá sube su DNI y antecedentes):
// todo lo tocable mide 44px o más.

import { useState } from 'react'
import { ActivityIndicator, Alert, Image, ScrollView, Share, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { DISTRITOS, OFICIOS_LIST } from '../../../lib/constants'
import { ENV, fetchWithTimeout } from '../../../lib/env'
import { getTechAuthToken } from '../../../lib/tech-auth'
import { fetchMyTechProfile } from '../../../lib/tech-profile'
import type { Tecnico } from '../../../lib/types'
import { THEME } from '../../../lib/theme'
import { PressableScale } from '../../ui/Motion'
import type { Aviso } from './ToastAviso'

// /api/tecnico/me devuelve el row completo; estas columnas no están en el
// tipo compartido.
type TecnicoConDocs = Tecnico & {
  antecedentes_penales_estado?: string | null
  antecedentes_policiales_estado?: string | null
  certificado_estudios_estado?: string | null
}

type TipoDoc = 'antecedentes_penales' | 'antecedentes_policiales' | 'certificado_estudios'

export function PanelPerfil({
  tech,
  authToken,
  editing,
  onEditingChange,
  editDesc,
  onEditDesc,
  editPrecio,
  onEditPrecio,
  editDisponible,
  onEditDisponible,
  editOficios,
  onEditOficios,
  editZonas,
  onEditZonas,
  savingProfile,
  onGuardar,
  galleryImages,
  uploadingImage,
  maxPhotos,
  uploadingDoc,
  onSubirFotoPerfil,
  onSubirFotoGaleria,
  onEliminarFoto,
  onSubirDoc,
  onTechChange,
  onCerrarSesion,
  onAviso,
}: {
  tech: Tecnico
  authToken: string | null
  editing: boolean
  onEditingChange: (v: boolean) => void
  editDesc: string
  onEditDesc: (v: string) => void
  editPrecio: string
  onEditPrecio: (v: string) => void
  editDisponible: boolean
  onEditDisponible: (v: boolean) => void
  editOficios: string[]
  onEditOficios: (v: string[]) => void
  editZonas: string[]
  onEditZonas: (v: string[]) => void
  savingProfile: boolean
  onGuardar: () => void
  galleryImages: string[]
  uploadingImage: boolean
  maxPhotos: number
  uploadingDoc: string | null
  onSubirFotoPerfil: () => void
  onSubirFotoGaleria: () => void
  onEliminarFoto: (url: string) => void
  onSubirDoc: (tipo: TipoDoc) => void
  onTechChange: (t: Tecnico) => void
  onCerrarSesion: () => void
  onAviso: (aviso: Aviso) => void
}) {
  const [showOficiosPicker, setShowOficiosPicker] = useState(false)
  const [showZonasPicker, setShowZonasPicker] = useState(false)
  const [zonaSearch, setZonaSearch] = useState('')
  const docsTech = tech as TecnicoConDocs

  // Subida rápida de documento desde el modo edición (sin allowsEditing:
  // el certificado se manda entero, no recortado).
  async function subirDocInline(tipo: TipoDoc) {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      onAviso({ tipo: 'error', texto: 'Necesitamos acceso a tus archivos.' })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return
    try {
      const asset = result.assets[0]
      // El endpoint exige auth_token en el FormData (verifica ownership) o devuelve 401.
      const docToken = authToken ?? (await getTechAuthToken())
      if (!docToken) {
        onAviso({ tipo: 'error', texto: 'Sesión expirada. Inicia sesión de nuevo para subir documentos.' })
        return
      }
      const formData = new FormData()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FormData de RN acepta {uri,name,type} pero el tipo DOM no lo sabe
      formData.append('file', { uri: asset.uri, name: `${tipo}_${tech.id}.jpg`, type: 'image/jpeg' } as any)
      formData.append('tipo', tipo)
      formData.append('tecnicoId', String(tech.id))
      formData.append('auth_token', docToken)
      const res = await fetchWithTimeout(`${ENV.API_BASE_URL}/upload-doc`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        onAviso({ tipo: 'ok', texto: 'Documento subido. Lo revisaremos pronto y te notificaremos.' })
        const fresh = await fetchMyTechProfile(authToken)
        if (fresh) onTechChange(fresh)
      } else {
        onAviso({ tipo: 'error', texto: data.error || 'No se pudo subir' })
      }
    } catch {
      onAviso({ tipo: 'error', texto: 'Error de conexión' })
    }
  }

  return (
    <View style={{ gap: THEME.space.md }}>
      {/* Profile photo */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, alignItems: 'center' }}>
        <TouchableOpacity onPress={onSubirFotoPerfil} accessibilityLabel="Cambiar foto de perfil" style={{ alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.color.brandLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: THEME.space.sm }}>
            {tech.foto_url ? (
              <Image source={{ uri: tech.foto_url }} style={{ width: 80, height: 80 }} />
            ) : (
              <Text style={{ fontSize: 32, fontWeight: '900', color: THEME.color.brand }}>{tech.nombre?.[0]}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="camera-outline" size={14} color={THEME.color.info} />
            <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.info }}>Cambiar foto de perfil</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.space.md }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Mi perfil</Text>
          {!editing ? (
            <TouchableOpacity
              onPress={() => onEditingChange(true)}
              accessibilityLabel="Editar mi perfil"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: THEME.color.infoBg, paddingHorizontal: 14, minHeight: 44, borderRadius: THEME.radius.sm }}
            >
              <Ionicons name="create-outline" size={14} color={THEME.color.info} />
              <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.info }}>Editar</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => onEditingChange(false)}
                accessibilityLabel="Cancelar la edición"
                style={{ backgroundColor: THEME.color.lineSoft, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: THEME.radius.sm }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.inkSoft }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onGuardar}
                disabled={savingProfile}
                accessibilityLabel="Guardar mi perfil"
                style={{ backgroundColor: THEME.color.navy, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: THEME.radius.sm }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.white }}>{savingProfile ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <InfoRow label="Nombre" value={tech.nombre} />
        <InfoRow label="Oficio" value={tech.oficio} />
        <InfoRow label="Distrito" value={tech.distrito} />
        <InfoRow label="WhatsApp" value={tech.whatsapp} />
        <InfoRow label="Email" value={tech.email || 'No registrado'} />
        <InfoRow label="Verificado" value={tech.verificado ? 'Sí ✅' : 'Pendiente ⏳'} />

        {/* Editable fields */}
        {editing ? (
          <View style={{ marginTop: THEME.space.md }}>
            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.ink, marginBottom: 4 }}>Descripción</Text>
            <TextInput
              value={editDesc}
              onChangeText={onEditDesc}
              multiline
              numberOfLines={3}
              placeholder="Ej: Gasfitero con 10 años de experiencia..."
              style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, padding: THEME.space.md, fontSize: 13, marginBottom: THEME.space.md, textAlignVertical: 'top', minHeight: 70, color: THEME.color.ink }}
              placeholderTextColor={THEME.color.inkMuted}
            />

            <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.ink, marginBottom: 4 }}>Precio base (S/)</Text>
            <TextInput
              value={editPrecio}
              onChangeText={onEditPrecio}
              keyboardType="numeric"
              placeholder="60"
              style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, padding: THEME.space.md, fontSize: 13, marginBottom: THEME.space.md, color: THEME.color.ink }}
              placeholderTextColor={THEME.color.inkMuted}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: THEME.space.sm }}>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '600', color: THEME.color.ink }}>Disponible para trabajar</Text>
              <Switch
                value={editDisponible}
                onValueChange={onEditDisponible}
                trackColor={{ false: THEME.color.line, true: '#86EFAC' }}
                thumbColor={editDisponible ? THEME.color.success : THEME.color.inkMuted}
              />
            </View>

            {/* Oficios editor */}
            <View style={{ marginTop: THEME.space.md, borderTopWidth: 1, borderTopColor: THEME.color.lineSoft, paddingTop: THEME.space.md }}>
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.ink, marginBottom: 6 }}>Mis servicios/oficios</Text>
              {editOficios.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: THEME.space.sm }}>
                  {editOficios.map((o, i) => (
                    <TouchableOpacity
                      key={o}
                      onPress={() => onEditOficios(editOficios.filter((_, idx) => idx !== i))}
                      accessibilityLabel={`Quitar el oficio ${o}`}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: i === 0 ? THEME.color.navy : THEME.color.infoBg, borderRadius: THEME.radius.full, paddingHorizontal: 10, paddingVertical: 5 }}
                    >
                      <Text style={{ ...THEME.font.caption, fontWeight: '600', color: i === 0 ? THEME.color.white : THEME.color.navy }}>{o}</Text>
                      <Ionicons name="close-circle" size={12} color={i === 0 ? 'rgba(255,255,255,0.7)' : THEME.color.navy} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowOficiosPicker(!showOficiosPicker)}
                accessibilityLabel={editOficios.length === 0 ? 'Seleccionar oficio' : 'Agregar otro oficio'}
                style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, padding: THEME.space.md, minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted }}>{editOficios.length === 0 ? 'Seleccionar oficio' : '+ Agregar oficio'}</Text>
              </TouchableOpacity>
              {showOficiosPicker && (
                <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.md, marginTop: 4, maxHeight: 180, borderWidth: 1, borderColor: THEME.color.line }}>
                  <ScrollView nestedScrollEnabled>
                    {OFICIOS_LIST.filter(o => !editOficios.includes(o)).map(o => (
                      <TouchableOpacity
                        key={o}
                        onPress={() => { onEditOficios([...editOficios, o]); setShowOficiosPicker(false) }}
                        style={{ padding: 10, minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}
                      >
                        <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.ink }}>{o}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Zonas editor */}
            <View style={{ marginTop: THEME.space.md }}>
              <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.ink, marginBottom: 6 }}>Zonas de cobertura</Text>
              {editZonas.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: THEME.space.sm }}>
                  {editZonas.map((z, i) => (
                    <TouchableOpacity
                      key={z}
                      onPress={() => onEditZonas(editZonas.filter((_, idx) => idx !== i))}
                      accessibilityLabel={`Quitar la zona ${z}`}
                      hitSlop={{ top: 8, bottom: 8 }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: i === 0 ? THEME.color.navy : THEME.color.infoBg, borderRadius: THEME.radius.full, paddingHorizontal: 10, paddingVertical: 5 }}
                    >
                      <Text style={{ ...THEME.font.caption, fontWeight: '600', color: i === 0 ? THEME.color.white : THEME.color.navy }}>{z}</Text>
                      <Ionicons name="close-circle" size={12} color={i === 0 ? 'rgba(255,255,255,0.7)' : THEME.color.navy} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowZonasPicker(!showZonasPicker)}
                accessibilityLabel={editZonas.length === 0 ? 'Seleccionar distrito' : 'Agregar otro distrito'}
                style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, padding: THEME.space.md, minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkMuted }}>{editZonas.length === 0 ? 'Seleccionar distrito' : '+ Agregar distrito'}</Text>
              </TouchableOpacity>
              {showZonasPicker && (
                <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.md, marginTop: 4, maxHeight: 220, borderWidth: 1, borderColor: THEME.color.line }}>
                  <TextInput placeholder="Buscar distrito..." placeholderTextColor={THEME.color.inkMuted} value={zonaSearch} onChangeText={setZonaSearch} style={{ padding: 10, fontSize: 13, borderBottomWidth: 1, borderBottomColor: THEME.color.line, color: THEME.color.ink }} autoFocus />
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}>
                    {DISTRITOS.filter(d => !editZonas.includes(d) && (!zonaSearch || d.toLowerCase().includes(zonaSearch.toLowerCase()))).map(d => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => { onEditZonas([...editZonas, d]); setZonaSearch(''); setShowZonasPicker(false) }}
                        style={{ padding: 10, minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}
                      >
                        <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.ink }}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                    {zonaSearch.trim() && !DISTRITOS.some(d => d.toLowerCase() === zonaSearch.toLowerCase()) && (
                      <TouchableOpacity
                        onPress={() => { onEditZonas([...editZonas, zonaSearch.trim()]); setZonaSearch(''); setShowZonasPicker(false) }}
                        style={{ padding: 10, minHeight: 44, justifyContent: 'center', backgroundColor: THEME.color.infoBg }}
                      >
                        <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.info }}>+ Agregar "{zonaSearch.trim()}"</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Documentos de verificación */}
            <View style={{ marginTop: THEME.space.lg, borderTopWidth: 1, borderTopColor: THEME.color.lineSoft, paddingTop: THEME.space.lg }}>
              <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink, marginBottom: 4 }}>Documentos de verificación</Text>
              <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginBottom: THEME.space.md }}>Sube tus documentos para generar más confianza</Text>
              {([
                { key: 'antecedentes_penales' as const, label: 'Antecedentes Penales (INPE)', icon: '🔍', field: 'antecedentes_penales_estado' as const },
                { key: 'antecedentes_policiales' as const, label: 'Antecedentes Policiales (PNP)', icon: '🛡️', field: 'antecedentes_policiales_estado' as const },
                { key: 'certificado_estudios' as const, label: 'Certificado de Estudios', icon: '📜', field: 'certificado_estudios_estado' as const },
              ]).map(doc => {
                const estado = docsTech[doc.field] || 'no_subido'
                return (
                  <View key={doc.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.md, padding: THEME.space.md, marginBottom: THEME.space.sm, borderWidth: 1, borderColor: THEME.color.line }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Text style={{ fontSize: 18 }}>{doc.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.ink }}>{doc.label}</Text>
                        <Text style={{ ...THEME.font.caption, fontWeight: '600', color: estado === 'verificado' ? THEME.color.success : estado === 'pendiente' ? THEME.color.warning : THEME.color.inkMuted }}>
                          {estado === 'verificado' ? '✅ Verificado' : estado === 'pendiente' ? '⏳ En revisión' : 'No subido'}
                        </Text>
                      </View>
                    </View>
                    {estado !== 'verificado' && (
                      <TouchableOpacity
                        onPress={() => { void subirDocInline(doc.key) }}
                        accessibilityLabel={`${estado === 'pendiente' ? 'Resubir' : 'Subir'} ${doc.label}`}
                        style={{ backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }}
                      >
                        <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>{estado === 'pendiente' ? 'Resubir' : 'Subir'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })}
            </View>

            {/* Gallery section */}
            <View style={{ marginTop: THEME.space.lg, borderTopWidth: 1, borderTopColor: THEME.color.lineSoft, paddingTop: THEME.space.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: THEME.space.md }}>
                <View>
                  <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.ink }}>Galería de trabajos</Text>
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted }}>{galleryImages.length}/{maxPhotos} fotos</Text>
                </View>
                <TouchableOpacity
                  onPress={onSubirFotoGaleria}
                  disabled={uploadingImage}
                  accessibilityLabel="Subir una foto a mi galería"
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: THEME.color.infoBg, paddingHorizontal: 14, minHeight: 44, borderRadius: THEME.radius.sm }}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={THEME.color.info} />
                  ) : (
                    <Ionicons name="camera-outline" size={16} color={THEME.color.info} />
                  )}
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>
                    {uploadingImage ? 'Subiendo...' : 'Subir foto'}
                  </Text>
                </TouchableOpacity>
              </View>

              {galleryImages.length > 0 ? (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {galleryImages.map((url, i) => (
                      <View key={i} style={{ marginRight: 10, position: 'relative' }}>
                        <Image
                          source={{ uri: url }}
                          style={{ width: 140, height: 105, borderRadius: THEME.radius.md, backgroundColor: THEME.color.lineSoft }}
                        />
                        <TouchableOpacity
                          onPress={() => onEliminarFoto(url)}
                          accessibilityLabel="Eliminar esta foto"
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ position: 'absolute', top: -6, right: -6, backgroundColor: THEME.color.danger, borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="close" size={12} color={THEME.color.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => Share.share({ message: `Mira mis trabajos en SOLU: https://www.solu.pe/tecnico/${tech.id}` })}
                    accessibilityLabel="Compartir mi portafolio con clientes"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, backgroundColor: THEME.color.infoBg, borderRadius: THEME.radius.sm, padding: 10, minHeight: 44 }}
                  >
                    <Ionicons name="share-social-outline" size={14} color={THEME.color.info} />
                    <Text style={{ ...THEME.font.caption, fontWeight: '700', color: THEME.color.info }}>Compartir portafolio con clientes</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ backgroundColor: THEME.color.surfaceAlt, borderRadius: THEME.radius.sm, padding: THEME.space.xl, alignItems: 'center' }}>
                  <Ionicons name="images-outline" size={28} color={THEME.color.inkMuted} />
                  <Text style={{ ...THEME.font.caption, color: THEME.color.inkMuted, marginTop: 6 }}>Sube fotos de tus trabajos para atraer más clientes</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: THEME.space.sm }}>
            <InfoRow label="Descripción" value={tech.descripcion || 'Sin descripción'} />
            <InfoRow label="Precio desde" value={tech.precio_desde ? `S/${tech.precio_desde}` : 'No especificado'} />
            <InfoRow label="Disponible" value={tech.disponible ? 'Sí ✅' : 'No ❌'} />
            {tech.zonas && tech.zonas.length > 0 && (
              <InfoRow label="Zonas" value={tech.zonas.join(', ')} />
            )}
          </View>
        )}
      </View>

      {/* ─── DOCUMENTOS DE VERIFICACIÓN ─── */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: THEME.space.sm, marginBottom: 6 }}>
          <Ionicons name="shield-checkmark" size={18} color={THEME.color.success} />
          <Text style={{ fontSize: 14, fontWeight: '800', color: THEME.color.ink }}>Documentos de seguridad</Text>
        </View>
        <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft, marginBottom: 14, lineHeight: 16 }}>
          Sube tus documentos para que los clientes vean que eres un profesional confiable y verificado por SOLU.
        </Text>

        {([
          { tipo: 'antecedentes_penales' as const, label: 'Antecedentes Penales', sub: 'Certificado INPE', icon: 'document-text' as const, field: 'antecedentes_penales_estado' as const },
          { tipo: 'antecedentes_policiales' as const, label: 'Antecedentes Policiales', sub: 'Certificado PNP', icon: 'shield' as const, field: 'antecedentes_policiales_estado' as const },
          { tipo: 'certificado_estudios' as const, label: 'Certificado de Estudios', sub: 'Título técnico', icon: 'school' as const, field: 'certificado_estudios_estado' as const },
        ]).map((doc) => {
          const estado = docsTech[doc.field] || 'sin_subir'
          const estadoColors: Record<string, string> = {
            sin_subir: THEME.color.inkMuted, pendiente: THEME.color.warning, verificado: THEME.color.success, rechazado: THEME.color.danger,
          }
          const estadoLabels: Record<string, string> = {
            sin_subir: 'Sin subir', pendiente: '⏳ En revisión', verificado: '✅ Verificado', rechazado: '❌ Rechazado',
          }
          const isUploading = uploadingDoc === doc.tipo
          return (
            <View key={doc.tipo} style={{
              flexDirection: 'row', alignItems: 'center', gap: THEME.space.md,
              paddingVertical: THEME.space.md, borderTopWidth: 1, borderTopColor: THEME.color.lineSoft,
            }}>
              <View style={{ width: 40, height: 40, borderRadius: THEME.radius.md, backgroundColor: estadoColors[estado] + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={doc.icon} size={18} color={estadoColors[estado]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.ink }}>{doc.label}</Text>
                <Text style={{ ...THEME.font.caption, color: THEME.color.inkSoft }}>{doc.sub}</Text>
                <Text style={{ ...THEME.font.caption, fontWeight: '600', color: estadoColors[estado], marginTop: 2 }}>
                  {estadoLabels[estado]}
                </Text>
              </View>
              {estado !== 'verificado' && (
                <TouchableOpacity
                  onPress={() => onSubirDoc(doc.tipo)}
                  disabled={isUploading}
                  accessibilityLabel={`${estado === 'rechazado' ? 'Volver a subir' : 'Subir'} ${doc.label}`}
                  style={{
                    backgroundColor: isUploading ? THEME.color.lineSoft : THEME.color.brand,
                    borderRadius: THEME.radius.sm, paddingHorizontal: 14, minHeight: 44,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={THEME.color.brand} />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={14} color={THEME.color.white} />
                  )}
                  <Text style={{ ...THEME.font.caption, fontWeight: '700', color: isUploading ? THEME.color.inkSoft : THEME.color.white }}>
                    {isUploading ? 'Subiendo...' : estado === 'rechazado' ? 'Volver a subir' : 'Subir'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })}

        <View style={{ backgroundColor: THEME.color.successBg, borderRadius: THEME.radius.sm, padding: 10, marginTop: THEME.space.sm }}>
          <Text style={{ ...THEME.font.caption, color: '#065F46', lineHeight: 14 }}>
            🔒 Tus documentos son revisados manualmente por el equipo de SOLU antes de mostrarse. Los clientes solo ven los badges de verificación, no el documento.
          </Text>
        </View>
      </View>

      {/* Danger zone */}
      <View style={{ backgroundColor: THEME.color.surface, borderRadius: THEME.radius.lg, padding: THEME.space.lg, ...THEME.shadow.sm }}>
        <Text style={{ ...THEME.font.label, fontWeight: '700', color: THEME.color.inkSoft, marginBottom: THEME.space.md }}>Cuenta</Text>
        <PressableScale
          // Confirmación destructiva: acá el Alert nativo es el patrón correcto.
          onPress={() => Alert.alert('Cerrar sesión', '¿Seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: onCerrarSesion },
          ])}
          accessibilityLabel="Cerrar sesión"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.space.sm, minHeight: 48, borderRadius: THEME.radius.md, backgroundColor: THEME.color.dangerBg }}
        >
          <Ionicons name="log-out-outline" size={18} color={THEME.color.danger} />
          <Text style={{ ...THEME.font.bodySm, fontWeight: '700', color: THEME.color.danger }}>Cerrar sesión</Text>
        </PressableScale>
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.color.lineSoft }}>
      <Text style={{ ...THEME.font.label, fontWeight: '500', color: THEME.color.inkSoft, flex: 1 }}>{label}</Text>
      <Text style={{ ...THEME.font.label, fontWeight: '600', color: THEME.color.ink, flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

export default PanelPerfil
