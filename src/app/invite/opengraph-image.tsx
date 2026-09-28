import { ImageResponse } from 'next/og'
import {
  WEWED_BRAND_NAME,
  WEWED_BRAND_PAYOFF,
  WEWED_INVITATION_PREVIEW_TITLE,
} from '@/lib/wewed-brand'

export const alt = 'Wewed private wedding invitation'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function InvitationOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#17130f',
          color: '#fbf5e9',
          padding: '64px',
          fontFamily: 'serif',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '2px solid rgba(191,155,95,0.45)',
            borderRadius: '44px',
            padding: '58px 64px',
            background: 'linear-gradient(135deg, #211b16 0%, #17130f 72%)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '760px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 28,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#d6b77c',
              }}
            >
              {WEWED_BRAND_NAME}
            </div>
            <div style={{ marginTop: 34, fontSize: 58, lineHeight: 1.08 }}>
              {WEWED_INVITATION_PREVIEW_TITLE.replace('Wewed · ', '')}
            </div>
            <div
              style={{
                marginTop: 28,
                width: '180px',
                height: '2px',
                background: '#b3833f',
              }}
            />
            <div style={{ marginTop: 28, fontSize: 28, color: '#d6cec5', fontStyle: 'italic' }}>
              {WEWED_BRAND_NAME} — {WEWED_BRAND_PAYOFF}
            </div>
            <div style={{ marginTop: 26, fontSize: 22, color: '#a99d91' }}>
              wewed.pro
            </div>
          </div>

          <div
            style={{
              width: '190px',
              height: '190px',
              borderRadius: '46px',
              background: '#2d2d2d',
              border: '4px solid rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 22px 60px rgba(0,0,0,0.25)',
            }}
          >
            <svg viewBox="0 0 30 30" width="142" height="142" aria-hidden="true">
              <path
                fill="#ffffff"
                d="M15.47 7.1l-1.3 1.85c-.2.29-.54.47-.9.47h-7.1V7.1h9.3z"
              />
              <polygon fill="#ffffff" points="24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1" />
              <path
                fill="#ffffff"
                d="M14.53 22.91l1.31-1.86c.2-.29.54-.47.9-.47h7.09v2.33h-9.3z"
              />
            </svg>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
