import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { COLORS } from '../lib/constants'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error: string }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: COLORS.light }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.dark, marginBottom: 8, textAlign: 'center' }}>
            Algo salió mal
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'center', marginBottom: 20 }}>
            Ocurrió un error inesperado. Por favor intenta de nuevo.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: '' })}
            style={{ backgroundColor: COLORS.pri, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}
