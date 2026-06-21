import { getTechToken } from './tech-session'

// Lee el Bearer del técnico desde el almacenamiento seguro (SecureStore).
// Reexporta getTechToken de tech-session para los call sites que ya usaban
// getTechAuthToken (appointments, upload-doc, LeadRow, etc.).
export async function getTechAuthToken(): Promise<string | null> {
  return getTechToken()
}
