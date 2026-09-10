export type InvitationMotionPreset =
  | 'tri-fold'
  | 'envelope-letter'
  | 'gate-fold'
  | 'book-open'
  | 'single-card-lift'
  | 'floral-reveal'
  | 'sleeve-pull'

export type InvitationAtmospherePreset =
  | 'champagne-glow'
  | 'soft-bokeh'
  | 'petals'
  | 'candlelight'
  | 'stars'
  | 'watercolour-bloom'
  | 'minimal'

export interface InvitationThemeDefinition {
  id: string
  name: string
  description: string
  category: 'classic' | 'romantic' | 'modern' | 'evening' | 'cultural'
  motion: InvitationMotionPreset
  atmosphere: InvitationAtmospherePreset
  palette: {
    stage: string
    paper: string
    ink: string
    primary: string
    accent: string
    muted: string
  }
  featured?: boolean
}

/**
 * Premium invitation registry.
 *
 * `botanical`, `editorial` and `midnight` deliberately remain stable ids so
 * weddings and personal invitation links created before the premium motion
 * engine continue to resolve without migration or broken URLs.
 */
export const INVITATION_CARD_STYLES = [
  {
    id: 'ivory-floral-gold',
    name: 'Ivory Floral Gold',
    description: 'Sculpted ivory stationery, champagne-gold light and an elegant tri-fold reveal.',
    category: 'classic',
    motion: 'tri-fold',
    atmosphere: 'champagne-glow',
    palette: { stage: '#17130f', paper: '#fbf5e9', ink: '#42372f', primary: '#b3833f', accent: '#d6b77c', muted: '#7a6d62' },
    featured: true,
  },
  {
    id: 'midnight',
    name: 'Midnight Gold',
    description: 'Deep midnight stationery with restrained warm metallic detail and a gate-fold reveal.',
    category: 'evening',
    motion: 'gate-fold',
    atmosphere: 'stars',
    palette: { stage: '#070b13', paper: '#101827', ink: '#fff8e8', primary: '#d4af67', accent: '#f0d99b', muted: '#b8bdc8' },
  },
  {
    id: 'botanical',
    name: 'Garden Romance',
    description: 'Soft ivory, garden greens and botanical detail revealed with a gentle floral bloom.',
    category: 'romantic',
    motion: 'floral-reveal',
    atmosphere: 'petals',
    palette: { stage: '#e9eadf', paper: '#fbf7ef', ink: '#2f392e', primary: '#718167', accent: '#b99a62', muted: '#6d7668' },
  },
  {
    id: 'royal-emerald',
    name: 'Royal Emerald',
    description: 'Rich emerald, ivory and champagne-gold stationery presented from a formal envelope.',
    category: 'classic',
    motion: 'envelope-letter',
    atmosphere: 'soft-bokeh',
    palette: { stage: '#071b16', paper: '#f8f1e3', ink: '#15382e', primary: '#a98545', accent: '#d4bd88', muted: '#668078' },
  },
  {
    id: 'classic-white',
    name: 'Classic White',
    description: 'Formal white stationery with fine blind-emboss styling and an understated book-open reveal.',
    category: 'classic',
    motion: 'book-open',
    atmosphere: 'minimal',
    palette: { stage: '#e8e5df', paper: '#fffdf9', ink: '#282521', primary: '#8b806f', accent: '#c8bda9', muted: '#77716a' },
  },
  {
    id: 'blush-romance',
    name: 'Blush Romance',
    description: 'Blush, champagne and floral softness with a personal letter emerging from its envelope.',
    category: 'romantic',
    motion: 'envelope-letter',
    atmosphere: 'soft-bokeh',
    palette: { stage: '#ead8d2', paper: '#fff7f1', ink: '#543b38', primary: '#b68b79', accent: '#d8b992', muted: '#8d716b' },
  },
  {
    id: 'african-luxe',
    name: 'African Luxe',
    description: 'Contemporary African-inspired geometry, warm metallic detail and an elegant ceremonial gate fold.',
    category: 'cultural',
    motion: 'gate-fold',
    atmosphere: 'candlelight',
    palette: { stage: '#1b130e', paper: '#f5e9d3', ink: '#36251b', primary: '#a76d2b', accent: '#d4a55b', muted: '#786253' },
  },
  {
    id: 'editorial',
    name: 'Modern Editorial',
    description: 'High-fashion typography, strong spacing and a clean single-card lift.',
    category: 'modern',
    motion: 'single-card-lift',
    atmosphere: 'minimal',
    palette: { stage: '#dedbd5', paper: '#f3efe7', ink: '#191714', primary: '#191714', accent: '#9b8b72', muted: '#706b65' },
  },
  {
    id: 'black-tie',
    name: 'Black Tie',
    description: 'Minimal black and warm ivory with a crisp formal gate-fold presentation.',
    category: 'evening',
    motion: 'gate-fold',
    atmosphere: 'candlelight',
    palette: { stage: '#070707', paper: '#f8f3e8', ink: '#15120f', primary: '#b89b68', accent: '#e2d1aa', muted: '#736b61' },
  },
  {
    id: 'watercolour-garden',
    name: 'Watercolour Garden',
    description: 'Painterly garden colour that softly blooms around the invitation as it is revealed.',
    category: 'romantic',
    motion: 'floral-reveal',
    atmosphere: 'watercolour-bloom',
    palette: { stage: '#e7ebe4', paper: '#fffaf2', ink: '#344339', primary: '#789178', accent: '#c58f83', muted: '#708076' },
  },
  {
    id: 'sunset-terracotta',
    name: 'Sunset Terracotta',
    description: 'Warm earth, champagne and sunset tones revealed from a modern stationery sleeve.',
    category: 'modern',
    motion: 'sleeve-pull',
    atmosphere: 'soft-bokeh',
    palette: { stage: '#3c2119', paper: '#fbebdc', ink: '#4a2b23', primary: '#b76549', accent: '#d6a665', muted: '#886d61' },
  },
  {
    id: 'celestial',
    name: 'Celestial',
    description: 'Moonlit navy, fine stars and warm metallic type opening into a quiet night-sky celebration.',
    category: 'evening',
    motion: 'book-open',
    atmosphere: 'stars',
    palette: { stage: '#050912', paper: '#101728', ink: '#f8f1df', primary: '#c5a45f', accent: '#e0cf9c', muted: '#abb3c5' },
  },
] as const satisfies readonly InvitationThemeDefinition[]

export type InvitationCardStyle = (typeof INVITATION_CARD_STYLES)[number]['id']

const STYLE_IDS = new Set<string>(INVITATION_CARD_STYLES.map((style) => style.id))

export function normalizeInvitationCardStyle(value: unknown): InvitationCardStyle {
  return typeof value === 'string' && STYLE_IDS.has(value)
    ? (value as InvitationCardStyle)
    : 'botanical'
}

export function getInvitationCardStyleDefinition(
  style: InvitationCardStyle,
): (typeof INVITATION_CARD_STYLES)[number] {
  return INVITATION_CARD_STYLES.find((definition) => definition.id === style) ?? INVITATION_CARD_STYLES[2]
}

export function buildDigitalInvitationUrl({
  siteUrl,
  weddingSlug,
  token,
  style,
}: {
  siteUrl: string
  weddingSlug: string
  token: string
  style: InvitationCardStyle
}): string {
  const origin = siteUrl.replace(/\/$/, '')
  const query = new URLSearchParams({ rsvp: token, card: style })
  return `${origin}/w/${encodeURIComponent(weddingSlug)}?${query.toString()}`
}

export function buildDigitalInvitationMessage({
  guestName,
  weddingTitle,
  invitationUrl,
}: {
  guestName: string
  weddingTitle: string
  invitationUrl: string
}): string {
  return `Dear ${guestName},\n\nYou are warmly invited to ${weddingTitle}. Open your private digital wedding card and RSVP here:\n${invitationUrl}\n\nThis link is personal to you. Please do not forward it.`
}
