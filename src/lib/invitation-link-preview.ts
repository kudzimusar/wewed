import { WEWED_BRAND_PAYOFF, WEWED_INVITATION_PREVIEW_TITLE } from './wewed-brand'

/**
 * Link-preview crawlers (WhatsApp, Messenger/Instagram, iMessage, Telegram, Slack, X, LinkedIn,
 * Discord, …) fetch a shared personal invitation URL to build the chat card. They do not keep the
 * pending-invitation cookie across our redirect, so without special handling they end on the
 * generic private-wedding gateway and show "Private wedding | Wewed".
 *
 * The preview they receive must identify only the wedding — never the guest — and must not depend
 * on the RSVP credential in any way (no validation, no cookie, no difference between a valid and an
 * invalid token), so a preview can never be used to test whether a credential exists.
 */
const LINK_PREVIEW_CRAWLER =
  /(facebookexternalhit|Facebot|meta-externalagent|Twitterbot|TelegramBot|Slackbot|Slack-ImgProxy|LinkedInBot|Discordbot|SkypeUriPreview|Iframely|Embedly|redditbot|Pinterestbot|vkShare|Google-PageRenderer)/i

// WhatsApp's unfurler identifies as a bare `WhatsApp/<version>`. In-app browsers append the same
// token to a full browser UA, and a real Guest must never be stopped on the preview page, so only
// the bare form counts. App names that in-app browsers carry (Snapchat, Viber, …) are never matched.
const WHATSAPP_PREVIEW_FETCHER = /^WhatsApp\//i

export function isLinkPreviewCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return WHATSAPP_PREVIEW_FETCHER.test(userAgent.trim()) || LINK_PREVIEW_CRAWLER.test(userAgent)
}

export const INVITATION_PREVIEW_IMAGE_PATH = '/og/wewed-private-invitation.png'

export function invitationPreviewDescription(wedding: { title: string; date: Date } | null): string {
  if (!wedding) return `A secure private wedding invitation from Wewed — ${WEWED_BRAND_PAYOFF}`
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(wedding.date)
  return `${wedding.title} · ${date}. Open your secure Wewed digital invitation and RSVP.`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderInvitationLinkPreview({
  origin,
  wedding,
}: {
  origin: string
  wedding: { title: string; date: Date } | null
}): string {
  const title = escapeHtml(WEWED_INVITATION_PREVIEW_TITLE)
  const description = escapeHtml(invitationPreviewDescription(wedding))
  const image = escapeHtml(`${origin.replace(/\/$/, '')}${INVITATION_PREVIEW_IMAGE_PATH}`)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="noindex, nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wewed">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Wewed private wedding invitation">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body><p>${title}</p><p>${description}</p></body>
</html>`
}
