import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../lib/constants'
import { formatAudioDuration } from '../lib/audioChat'

interface Props {
  input: string
  onChangeInput: (text: string) => void
  onSend: () => void
  sending: boolean
  audioAvailable: boolean
  recording: boolean
  recordingMs: number
  sendingAudio: boolean
  micError: string | null
  onDismissMicError: () => void
  onStartRecording: () => void
  onCancelRecording: () => void
  onSendRecording: () => void
}

/** Barra inferior del chat: input de texto + grabación de notas de voz. */
export function ChatInputBar({
  input, onChangeInput, onSend, sending, audioAvailable,
  recording, recordingMs, sendingAudio, micError,
  onDismissMicError, onStartRecording, onCancelRecording, onSendRecording,
}: Props) {
  return (
    <>
      {micError && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FEF2F2', borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <Ionicons name="mic-off-outline" size={16} color={COLORS.red} />
          <Text style={{ flex: 1, fontSize: 11, color: COLORS.red, lineHeight: 15 }}>{micError}</Text>
          <TouchableOpacity onPress={onDismissMicError} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      )}
      {recording ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white }}>
          <TouchableOpacity
            onPress={onCancelRecording}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.gray} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.red }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.dark }}>
              Grabando… {formatAudioDuration(recordingMs)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onSendRecording}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.pri, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white }}>
          <TextInput
            value={input}
            onChangeText={onChangeInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={COLORS.gray2}
            style={{ flex: 1, backgroundColor: COLORS.light, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.border }}
            multiline
            maxLength={500}
            onSubmitEditing={onSend}
          />
          {/* Sin texto: micrófono (tap para grabar). Con texto: enviar. */}
          {audioAvailable && !input.trim() ? (
            <TouchableOpacity
              onPress={onStartRecording}
              disabled={sendingAudio}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pri,
                alignItems: 'center', justifyContent: 'center',
                opacity: sendingAudio ? 0.5 : 1,
              }}
            >
              {sendingAudio ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="mic" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onSend}
              disabled={!input.trim() || sending}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pri,
                alignItems: 'center', justifyContent: 'center',
                opacity: !input.trim() || sending ? 0.5 : 1,
              }}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  )
}
