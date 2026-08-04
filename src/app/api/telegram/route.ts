import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.app').replace(/\/$/, '')

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string; first_name?: string }
    from?: { id: number; first_name?: string; username?: string }
    text?: string
  }
}

const COMMANDS: Record<string, string> = {
  '/start': `🎉 *Welcome to Wewed!*

Wewed helps couples, planners and invited guests coordinate a wedding securely.

• /invite — how to open a digital invitation
• /rsvp — RSVP access help
• /planners — find a wedding planner
• /help — list all commands

Wewed: ${SITE_URL}`,
  '/invite': `💌 *Open your digital wedding invitation*

Use the private link or QR code sent directly to you. Each invitation is tied to one guest record and should not be forwarded.

Access help: ${SITE_URL}/guest-access-help`,
  '/rsvp': `✅ *RSVP securely*

Open the digital card or QR code you received, then choose *RSVP now*. Wewed removes the raw invitation credential from the address bar before showing your guest-scoped RSVP.

Access help: ${SITE_URL}/guest-access-help`,
  '/planners': `🗓 *Find a wedding planner*

Browse published planner profiles in the Wewed marketplace:
${SITE_URL}/planners`,
  '/help': `🛟 *Wewed bot commands*

• /start — platform overview
• /invite — digital invitation help
• /rsvp — RSVP access help
• /planners — planner marketplace
• /help — this list

Wewed: ${SITE_URL}`,
}

const FALLBACK_REPLY = `I didn't recognise that command.

Try /invite, /rsvp, /planners or /help.

Wewed: ${SITE_URL}`

async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, error: 'bot_token_not_configured' }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    })
    if (!response.ok) {
      return { ok: false, error: `telegram_api_${response.status}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'fetch_failed' }
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: { configured: Boolean(BOT_TOKEN) },
    commands: Object.keys(COMMANDS),
    privacy: 'Wedding invitations are guest-specific and are never exposed by the platform bot.',
  })
}

export async function POST(request: NextRequest) {
  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const message = update.message
  if (!message?.chat?.id) return NextResponse.json({ ok: true, ignored: true })
  const command = (message.text || '').trim().split(/\s+/)[0].toLowerCase()
  const reply = COMMANDS[command] || FALLBACK_REPLY
  const result = await sendTelegramMessage(message.chat.id, reply)

  if (!result.ok && result.error !== 'bot_token_not_configured') {
    console.error('[telegram webhook] delivery failed:', result.error)
    return NextResponse.json({ ok: false, error: 'delivery_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, delivered: result.ok, configured: Boolean(BOT_TOKEN) })
}
