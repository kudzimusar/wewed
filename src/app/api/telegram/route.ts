import { NextRequest, NextResponse } from 'next/server';

/* ============================================================
   wewed — Telegram Bot Webhook API
   ------------------------------------------------------------
   Endpoint: /api/telegram

   GET  — returns webhook status + bot info (for the admin
          dashboard's "is the bot alive?" check).
   POST — receives Telegram webhook updates, parses incoming
          messages, and replies via the Telegram Bot API.

   Supported commands (set by the Telegram BotFather):
     /start  — welcome + command list
     /info   — wedding details (date, venue, time, dress code)
     /rsvp   — link to the RSVP section
     /song   — link to the songbook
     /help   — full command list

   ───────────────────────────────────────────────────────────
   SETUP INSTRUCTIONS (for the couple / admin):
   1. Create a bot with @BotFather on Telegram → copy the token.
   2. Set it as an env var on the hosting provider:
        TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   3. Register this endpoint as the webhook:
        curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
             -d "url=https://wewed.app/api/telegram"
      (use a long-ish `max_connections` and `drop_pending_updates`
       for production).
   4. Optional: set the bot's commands with @BotFather's
      `/setcommands` so Telegram autocompletes them.
   5. To verify: open this route in a browser (GET) — you should
      see `{ status: "ok", webhook: { configured: true } }`.
   ───────────────────────────────────────────────────────────
   ============================================================ */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEDDING_URL = 'https://wewed.app/charity-and-kudzie';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; first_name?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
  };
}

/* ── Command responses ──────────────────────────────────────
   Each command returns a Markdown-formatted reply. Keep copy
   warm, on-brand, and short enough to read on a phone. */

const COMMANDS: { cmd: string; reply: string }[] = [
  {
    cmd: '/start',
    reply: `🎉 *Welcome to wewed!*

Charity & Kudzie are getting married on *December 23, 2026* at Imba Manor, Harare, Zimbabwe.

Here's how to follow along:

• /info — wedding details
• /rsvp — RSVP link
• /song — request a song for the dance floor
• /help — list all commands

Share the joy: ${WEDDING_URL}`,
  },
  {
    cmd: '/info',
    reply: `💍 *Charity & Kudzie — Wedding Details*

📅 Date: Saturday, December 23, 2026
🕰 Time: 14:00 (2 PM)
📍 Venue: Imba Manor, Harare, Zimbabwe
👗 Dress code: Garden-party elegance — earth tones, gold accents
🚗 Travel & stay: ${WEDDING_URL}#travel

Full programme: ${WEDDING_URL}#the-day`,
  },
  {
    cmd: '/rsvp',
    reply: `💌 *RSVP for Charity & Kudzie's wedding*

Tap below to confirm your seat — it takes less than a minute:

👉 ${WEDDING_URL}#rsvp

Prefer WhatsApp? Reply here and we'll send you the quick-RSVP link.`,
  },
  {
    cmd: '/song',
    reply: `🎵 *Suggest a song for the dance floor*

Help shape the soundtrack of our night — request your favourite tracks here:

👉 ${WEDDING_URL}#songbook

Every request goes into the live songbook that guests vote on.`,
  },
  {
    cmd: '/help',
    reply: `🛟 *wewed bot commands*

• /start — welcome message
• /info — wedding details (date, venue, dress code)
• /rsvp — link to RSVP
• /song — request a dance-floor song
• /help — this list

Website: ${WEDDING_URL}`,
  },
];

const FALLBACK_REPLY = `I didn't recognise that command 🤔

Try one of these:
• /info — wedding details
• /rsvp — RSVP link
• /song — request a song
• /help — full list

Or visit ${WEDDING_URL}`;

/* ── Telegram Bot API helpers ─────────────────────────────── */

async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'bot_token_not_configured' };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `telegram_api_${res.status}: ${errBody}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  }
}

async function getBotInfo(): Promise<{
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  if (!BOT_TOKEN) return { ok: false, error: 'bot_token_not_configured' };
  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`);
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  }
}

async function getWebhookInfo(): Promise<{
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}> {
  if (!BOT_TOKEN) return { ok: false, error: 'bot_token_not_configured' };
  try {
    const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  }
}

/* ── POST /api/telegram — webhook receiver ────────────────── */

export async function POST(request: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json_body' },
      { status: 400 }
    );
  }

  // Telegram sends a webhook ping with no message sometimes.
  if (!update?.message?.text || !update.message.chat?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chatId = update.message.chat.id;
  const rawText = update.message.text.trim();
  // Pull the first token ("/cmd" or "/cmd@botname") and lowercase it.
  const firstToken = rawText.split(/\s+/)[0].toLowerCase();
  const command = firstToken.split('@')[0]; // strip @botname suffix

  const matched = COMMANDS.find((c) => c.cmd === command);
  const reply = matched?.reply ?? FALLBACK_REPLY;

  const sendResult = await sendTelegramMessage(chatId, reply);

  return NextResponse.json({
    ok: sendResult.ok,
    handled: true,
    command,
    chat_id: chatId,
    replied: sendResult.ok,
    error: sendResult.error,
    timestamp: new Date().toISOString(),
  });
}

/* ── GET /api/telegram — webhook + bot status ─────────────── */

export async function GET() {
  const configured = !!BOT_TOKEN;

  if (!configured) {
    return NextResponse.json({
      status: 'ok',
      webhook: { configured: false },
      bot: null,
      commands: COMMANDS.map((c) => c.cmd),
      message:
        'TELEGRAM_BOT_TOKEN not set. Configure it to enable the webhook.',
      setup: 'See route comments for BotFather + setWebhook instructions.',
    });
  }

  const [botInfo, webhookInfo] = await Promise.all([
    getBotInfo(),
    getWebhookInfo(),
  ]);

  return NextResponse.json({
    status: 'ok',
    webhook: {
      configured: true,
      info: webhookInfo.result ?? null,
      webhookError: webhookInfo.error,
    },
    bot: botInfo.result ?? null,
    commands: COMMANDS.map((c) => c.cmd),
    endpoint: '/api/telegram',
  });
}
