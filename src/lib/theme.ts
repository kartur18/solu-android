// ════════════════════════════════════════════════════════════════════
// SOLU Design System — tokens modernos (2026 redesign)
// ════════════════════════════════════════════════════════════════════
// Fuente única de verdad del diseño. Reemplaza el COLORS plano viejo por
// una escala completa con jerarquía, sombras y espaciado consistentes.
// COLORS legacy se mantiene en constants.ts por compatibilidad — las
// pantallas nuevas/rediseñadas usan THEME.

export const THEME = {
  color: {
    // Brand — naranja SOLU con escala completa
    brand: '#F26B21',
    brandDark: '#D9551A',
    brandLight: '#FFF1E8',
    brandSoft: '#FFE0CC',

    // Navy — color de soporte (headers oscuros, dashboards)
    navy: '#0F1B2D',
    navy700: '#1E2A3F',
    navy500: '#334155',

    // Neutros — base de toda la UI
    ink: '#0F172A', // texto principal
    inkSoft: '#475569', // texto secundario
    inkMuted: '#94A3B8', // texto terciario / placeholder
    line: '#E9EDF2', // bordes / divisores
    lineSoft: '#F1F5F9',
    surface: '#FFFFFF', // cards
    surfaceAlt: '#F7F9FC', // fondo de pantalla
    surfaceSunken: '#EEF2F7',

    // Semánticos
    success: '#16A34A',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    info: '#2563EB',
    infoBg: '#EFF6FF',

    // Tiers loyalty
    bronce: '#CD7F32',
    plata: '#9CA3AF',
    oro: '#F59E0B',
    platino: '#6366F1',

    white: '#FFFFFF',
    black: '#000000',
  },

  // Espaciado en escala de 4 — usar SIEMPRE estos valores
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },

  // Radios consistentes
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 },

  // Tipografía — tamaños + pesos canónicos
  font: {
    display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
    h1: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
    h2: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.2 },
    h3: { fontSize: 17, fontWeight: '700' as const },
    body: { fontSize: 15, fontWeight: '500' as const },
    bodySm: { fontSize: 13, fontWeight: '500' as const },
    label: { fontSize: 12, fontWeight: '600' as const },
    caption: { fontSize: 11, fontWeight: '500' as const },
  },

  // Sombras — sutiles, modernas (elevación por capas)
  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    },
    brand: {
      shadowColor: '#F26B21',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 6,
    },
  },

  // Duraciones de animación (ms)
  motion: { fast: 150, base: 250, slow: 400 },
} as const

export type Theme = typeof THEME
