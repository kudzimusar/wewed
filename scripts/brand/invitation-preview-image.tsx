import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import {
  WEWED_BRAND_NAME,
  WEWED_BRAND_PAYOFF,
  WEWED_INVITATION_PREVIEW_TITLE,
} from '@/lib/wewed-brand'

export const alt = 'Wewed private wedding invitation'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function InvitationOpenGraphImage() {
  // The real Wewed mark (W, heart and rings) — the same artwork as the app icon.
  const logo = await readFile(join(process.cwd(), 'public', 'icon-512.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
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
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '680px' }}>
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
            <div style={{ display: 'flex', marginTop: 34, fontSize: 54, lineHeight: 1.08 }}>
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
            <div style={{ display: 'flex', marginTop: 28, fontSize: 28, color: '#d6cec5', fontStyle: 'italic' }}>
              {`${WEWED_BRAND_NAME} — ${WEWED_BRAND_PAYOFF}`}
            </div>
            <div style={{ display: 'flex', marginTop: 26, fontSize: 22, color: '#a99d91' }}>
              wewed.pro
            </div>
          </div>

          <div
            style={{
              width: '240px',
              height: '240px',
              borderRadius: '52px',
              background: '#fbf6ee',
              border: '3px solid rgba(214,183,124,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 22px 60px rgba(0,0,0,0.35)',
            }}
          >
            <img src={logoSrc} width={212} height={212} alt="Wewed" />
          </div>
        </div>
      </div>
    ),
    size,
  )
}
