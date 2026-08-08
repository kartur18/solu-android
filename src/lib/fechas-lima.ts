// Fechas en hora de Lima. Perú es UTC-5 fijo (sin horario de verano), así
// que restar 5 horas y leer la fecha UTC equivale al día calendario de Lima.
// toISOString() crudo da la fecha UTC: desde las ~19:00 de Lima ya va un día
// adelante y la "Agenda de hoy" mostraba el día siguiente.

/** Fecha YYYY-MM-DD en Lima del instante dado. Devuelve '' si es inválido. */
export function fechaLima(instante: Date | string | number): string {
  const d = instante instanceof Date ? instante : new Date(instante)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10)
}

/** Fecha YYYY-MM-DD de HOY en Lima. */
export function hoyLima(): string {
  return fechaLima(new Date())
}
