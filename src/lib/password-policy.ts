// Espeja la política de contraseñas del servidor (solu-app-clone →
// src/lib/validation.ts, `passwordPolicy`). Validar acá evita que la persona
// llegue al PUT final, reciba un 400 y ya haya quemado su código de 15 min.
export const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 200

/** Devuelve el mensaje de error, o null si la contraseña cumple la política. */
export function validarPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return 'La contraseña es demasiado larga'
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra'
  }
  if (!/\d/.test(password)) {
    return 'La contraseña debe incluir al menos un número'
  }
  return null
}
