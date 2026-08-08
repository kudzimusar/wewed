export const WEWED_EMAIL_ADDRESSES = {
  hello: 'hello@wewed.pro',
  support: 'support@wewed.pro',
  billing: 'billing@wewed.pro',
  privacy: 'privacy@wewed.pro',
  legal: 'legal@wewed.pro',
  security: 'security@wewed.pro',
  notifications: 'notifications@updates.wewed.pro',
} as const

export type WewedEmailAddressKey = keyof typeof WEWED_EMAIL_ADDRESSES

export const WEWED_INBOUND_ALIASES = [
  WEWED_EMAIL_ADDRESSES.hello,
  WEWED_EMAIL_ADDRESSES.support,
  WEWED_EMAIL_ADDRESSES.billing,
  WEWED_EMAIL_ADDRESSES.privacy,
  WEWED_EMAIL_ADDRESSES.legal,
  WEWED_EMAIL_ADDRESSES.security,
] as const

export const WEWED_OUTBOUND_DOMAIN = 'updates.wewed.pro'
