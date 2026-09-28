export const colors = {
  espresso: '#1A1410',
  champagne: '#FBF6EE',
  ivory: '#F7F1E7',
  white: '#FFFFFF',
  gold: '#BF9B5F',
  goldLight: '#D8BC7E',
  goldMuted: '#A68B4B',
  clay: '#C0633F',
  clayLight: '#D4805E',
  plum: '#6B2D3A',
  plumLight: '#8B4558',
  sage: '#7C7A52',
  sageLight: '#9D9B78',
  inkMuted: '#6B6560',
  border: '#E5DDD0',
  surfaceMuted: '#F0E9DC',
  danger: '#A64334',
  success: '#55734F',
} as const

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const

export const shadow = {
  card: {
    shadowColor: '#1A1410',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
} as const

export const minimumTouchTarget = 48
