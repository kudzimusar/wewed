# Task 5-b — wewed AI Assistant (Guest + Couple)

> Agent: Z.ai (AI builder)
> Task ID: 5-b
> Date: Phase 5 — AI layer
> Status: ✅ COMPLETE

## Scope

Built the GLM 5.2 AI layer for the wewed wedding platform — two surfaces:
1. **Guest AI** — floating chat bubble on the public site (bottom-right gold circle, opens elegant champagne/gold panel)
2. **Couple AI** — a planner-integrated assistant tab with speech/vow generator, RSVP summarizer, budget advice, and checklist triage

All 6 files delivered, lint-clean, TypeScript-clean, and smoke-tested against the real GLM 5.2 backend (responses came back warm, culturally aware of Zimbabwean wedding context, properly formatted, within word limits).

## Files Delivered

### API Routes (3)

#### 1. `/src/app/api/ai/chat/route.ts` — AI chat endpoint
- **POST** body: `{ messages: Array<{role, content}>, context: 'guest' | 'couple' }`
- **Returns**: `{ reply: string, usage?: { prompt_tokens, completion_tokens } }`
- **System prompts**: exactly as specified (guest = 150 word limit, couple = 200 word limit, both with full wedding context: Dec 23 2026, Imba Manor, ceremony 14:00, reception 16:30, shuttle from Meikles Hotel 12:30, dress code, dietary options, Shona traditions, roora/magumo)
- **Auth**: `context: 'couple'` requires `wewed_admin_auth` cookie (16-hex nonce, same pattern as planner routes). `context: 'guest'` is public.
- **Rate limit**: 10 req/min per IP (in-memory Map, auto-pruned). Returns 429 with `Retry-After` header.
- **Graceful fallback**: if SDK throws or returns empty, returns a warm canned message (`GUEST_FALLBACK` / `COUPLE_FALLBACK`) instead of a 500 — guests always get a reply.
- **Token safety**: caps each message to 4000 chars, keeps only the last 10 turns, always prepends system prompt.
- **GET** handler returns a health probe `{ service, contexts, rateLimit }`.
- **Uses**: `import ZAI from 'z-ai-web-dev-sdk'` (server-side only — never imported in client components)
- **SDK call**: `zai.chat.completions.create({ messages, thinking: { type: 'disabled' } })`

#### 2. `/src/app/api/ai/speech/route.ts` — AI speech/vow generator
- **POST** body: `{ type: 'groom' | 'bride' | 'best_man' | 'maid_of_honor' | 'father_bride' | 'mother_groom', tone: 'heartfelt' | 'funny' | 'traditional', length: 'short' | 'medium' | 'long' }`
- **Returns**: `{ speech: string, meta: { type, tone, length, targetMinutes, wordCount } }`
- **Auth**: admin-gated (couple-only)
- **Rate limit**: 5 req/min per IP (heavier generation)
- **Length mapping**: short=2min (~280 words), medium=4min (~560 words), long=6min (~840 words)
- **System prompt**: "expert wedding speech writer" — warm, personal, culturally resonant, ready to speak aloud
- **Validation**: strict enum checks on type/tone/length, defaults applied for tone/length if invalid, but type MUST be valid (else 400)
- **Verified sample**: a "groom heartfelt short" speech returned a beautiful 203-word draft that referenced "this beautiful December evening at Imba Manor", addressed Charity by name, mentioned "In our Zimbabwean tradition, we know that marriage is not just between two people, but between two families", and closed with a toast.

#### 3. `/src/app/api/ai/summary/route.ts` — AI RSVP summary
- **POST** body: `{ rsvps: Array<{ name, attending, meal, plusOne, message }> }`
- **Returns**: `{ summary: string, stats: { total, confirmed, declined, pending, plusOnes, meals, messageCount, topMessages } }`
- **Auth**: admin-gated (couple-only)
- **Rate limit**: 5 req/min per IP
- **Local stats compute**: even if the AI call fails, returns a structured stats object + a warm local fallback summary built from the real numbers. The couple ALWAYS gets a useful summary.
- **Verified sample**: 4 sample RSVPs → "What wonderful news—three of your four guests have confirmed attendance with two plus-ones joining the celebration! Your meal selections are perfectly balanced with one guest each enjoying beef, chicken, and vegetarian options. Your loved ones are sending such warm wishes, with messages like 'So happy for you both!' and 'Will be there in spirit' showing their excitement for your special day at Imba Manor. Everything is coming together beautifully!"

### Components (3)

#### 4. `/src/components/wedding/ai-assistant.tsx` — Floating guest AI chat
- `'use client'` component, exports `AiAssistant` (named) + default
- **Floating bubble**: bottom-right, gold gradient circle (size-14 mobile / size-16 desktop) with `MessageCircle` icon, `Heart` accent badge (clay color, top-right), pulsing halo (motion.span scaling 1→1.4 with opacity fade, 2.2s loop), gentle float (y: 0→-3→0, 3.5s loop)
- **Dismissible**: optional `onDismiss` prop — when provided, a small `X` button appears bottom-left on hover (size-5 espresso circle) and calls the parent. The parent (`AiTrigger`) stores the dismissal in localStorage.
- **Panel** (opens on bubble click):
  - Position: absolute, bottom-20 right-3 left-3 on mobile (full-width minus margins); `sm:bottom-24 sm:right-5 sm:left-auto sm:w-[380px]` on desktop
  - Height: `min(72vh, 560px)`
  - Header: espresso bg with plum→gold radial overlay, AI avatar (gold circle with Sparkles), "wewed AI" serif heading, "Guest Concierge" uppercase tag, "Ask me anything about the wedding" subtext, X close button
  - Messages: scrollable area (`wewed-scroll` class for custom gold scrollbar), user messages right-aligned (espresso bubbles with champagne text), AI messages left-aligned (champagne/white bubbles with gold border, gold avatar circle to the left)
  - **6 quick suggestion chips** (only visible when conversation is empty): "What time should I arrive?", "What's the dress code?", "How do I get there?", "What food will be served?", "Can I bring my kids?", "Tell me about Shona traditions"
  - **Typing indicator**: 3 bouncing gold dots (motion.span with staggered delay 0/0.15/0.3s, y: 0→-4→0 + opacity 0.5→1→0.5)
  - Input: textarea (auto-rows max-h-24) + Send button (gold gradient, size-9), Enter to send / Shift+Enter newline
  - Footer: "Press Enter to send · Shift+Enter for new line" + "Powered by **GLM 5.2**" badge
  - Body scroll locked when open on mobile
- **framer-motion**: AnimatePresence with spring-eased open (opacity+y+scale), exit reverses
- **Auto-scroll**: scrolls to bottom on every new message / typing change
- **Ephemeral**: messages in component state only (not persisted) per spec
- **Errors**: network/AI failure → warm fallback message in chat

#### 5. `/src/components/wedding/ai-planner-assistant.tsx` — Couple's AI tab
- `'use client'` component, exports `AiPlannerAssistant` (named) + default
- **Designed to render as a tab inside `wedding-planner.tsx`** (lead agent wires this). Fills its container (`h-full flex flex-col`), espresso/gold theme to match the planner.
- **Header**: espresso→plum gradient card with gold sparkle avatar, "wewed AI" + "Planning Concierge" tag, "Your wedding co-pilot for Dec 23, 2026 · Imba Manor, Harare" subtext, "Powered by GLM 5.2" badge with pulsing dot (right side, desktop only)
- **5 quick action buttons** (responsive grid: 2 cols mobile / 3 cols sm / 5 cols lg), each with an icon in a distinct accent color:
  1. **Summarize my RSVPs** (`Users`, gold) → fetches `/api/planner/guests`, extracts RSVP rows, calls `/api/ai/summary`, displays the warm summary in chat
  2. **Write my vows** (`Heart`, clay-light) → opens the speech modal preset to groom/heartfelt/medium
  3. **Budget advice** (`DollarSign`, sage-light) → sends a couple-context chat prompt asking for 4-5 Zimbabwean-specific budget tips
  4. **What's due next?** (`ListTodo`, gold-light) → fetches `/api/planner/tasks`, filters open tasks, sends a structured prompt to AI with the top 12 open tasks, AI returns prioritized top-3 + urgent flags
  5. **Help with my speech** (`FileText`, plum-light) → opens the speech modal preset to best_man/heartfelt/medium
- **Chat area**: scrollable, espresso/40 bg, gold border, messages with markdown rendering
  - User messages: right-aligned, gold gradient bubbles, espresso text
  - AI messages: left-aligned, champagne/4% bg, gold border, **rendered with `react-markdown`** + custom component overrides (p, ul, ol, li, strong, em, h3, h4, code, blockquote, a) styled with brand tokens
  - AI avatar: gold gradient circle with `Bot` icon
  - "Save to notes" button on every AI message (except welcome): stores to `localStorage` key `wewed:ai-planner-notes` as an array of `{id, content, kind, ts}`, capped at 50 entries. Shows "Saved ✓" feedback for 2s.
- **Speech Generator Modal**: full Dialog (shadcn/ui) with:
  - Title: "AI Speech & Vows Generator" with Wand2 icon + "Crafted for Charity & Kudzie · Dec 23, 2026 · Imba Manor" subtitle
  - 3 Select dropdowns (speaker / tone / length) with proper labels
  - Generate / Regenerate button (gold gradient)
  - Result area: scrollable (max-h-72), monospace-friendly, with Copy + Save buttons in the header
  - Word count + estimated spoken minutes shown below
  - Loading state: "Writing your speech…"
- **Auth handling**: if AI returns 401 (cookie expired), displays a friendly message telling the couple to reopen the planner via the Plan button
- **Toast notifications** via `useToast` hook (already in `/src/hooks/use-toast.ts`)

#### 6. `/src/components/wedding/ai-trigger.tsx` — Invisible trigger for guest AI
- `'use client'` component, exports `AiTrigger` (named) + default
- **Renders** `<AiAssistant onDismiss={handleDismiss} />` — or `null` when dismissed
- **24h dismissal** via localStorage key `wewed:ai-assistant-dismissed` storing a timestamp
- **Implemented with `useSyncExternalStore`** (React 19 blessed pattern for external state):
  - `subscribe`: listens to both `storage` events (cross-tab) and a custom `wewed:ai-dismiss-change` event (same-tab, dispatched after writing to localStorage)
  - `getSnapshot`: returns `true` if visible (not dismissed in last 24h), `false` if dismissed; auto-cleans stale timestamps
  - `getServerSnapshot`: returns `false` (SSR/initial hydration renders null → no hydration mismatch; bubble appears only after hydration on the client)
- **No `setState` in `useEffect`** — this pattern avoids the `react-hooks/set-state-in-effect` lint error that the simpler "mounted" pattern would trigger

## Smoke Test Results (real GLM 5.2 calls)

All 3 API routes verified against the live SDK:

### /api/ai/chat
- ✅ GET returns `{ service: 'wewed AI chat', contexts: ['guest','couple'], rateLimit: '10 requests per minute per IP' }`
- ✅ POST guest context → real AI reply in 1.5–3s, e.g. *"The ceremony begins at 14:00 at Imba Manor. We recommend arriving by 13:30 to find parking, get settled, and enjoy the traditional Zimbabwean welcome. Shuttles depart from Meikles Hotel at 12:30..."* (with usage stats)
- ✅ POST couple context without admin cookie → 401 Unauthorized
- ✅ POST couple context WITH `wewed_admin_auth=abcdef0123456789` cookie → real AI reply with roora/magumo references, December peak season advice, Imba Manor package deals, all under 200 words
- ✅ POST invalid body → 400 "No messages provided"
- ✅ Rate limit enforced: 10 successful 200s, then 429s with `Retry-After` header; window resets after 60s

### /api/ai/speech
- ✅ GET returns `{ types: [...6 types], tones: [...3 tones], lengths: [...3 lengths], adminRequired: true }`
- ✅ POST without admin → 401
- ✅ POST with admin, type=groom/tone=heartfelt/length=short → 203-word speech in 2.9s, returned with `meta: { wordCount: 203, targetMinutes: 2 }`. The speech opened with "Good evening, everyone", referenced "this beautiful December evening at Imba Manor", spoke directly to Charity, mentioned "In our Zimbabwean tradition, we know that marriage is not just between two people, but between two families", and closed with a toast.

### /api/ai/summary
- ✅ GET returns `{ service: 'wewed AI RSVP summary', adminRequired: true }`
- ✅ POST without admin → 401
- ✅ POST with admin + 4 sample RSVPs → warm 4-sentence summary + structured `stats` object (total, confirmed, declined, pending, plusOnes, meals breakdown, messageCount, topMessages). AI correctly counted 3 confirmed, 1 declined, 2 plus-ones, quoted 2 of the 3 messages.

## Compliance Checklist

- ✅ All 6 files use `'use client'` where applicable (3 components)
- ✅ `z-ai-web-dev-sdk` imported ONLY in API routes (3 server-side files), NEVER in client components
- ✅ API routes use Next.js 16 route handlers with `NextRequest`/`NextResponse`
- ✅ Tailwind custom color tokens (espresso, champagne, gold, gold-light, gold-muted, clay, clay-light, plum, plum-light, sage, sage-light) used throughout
- ✅ `font-serif` via `wewed-heading` class for all headings; `font-sans` for body
- ✅ framer-motion for animations (bubble pulse, panel open/close, message fade-in, typing dots, modal result reveal)
- ✅ All components mobile-first responsive (panel goes full-width on mobile, fixed 380px on desktop)
- ✅ Proper TypeScript types throughout (no `any`)
- ✅ Lucide icons only: Sparkles, Heart, Send, X, MessageCircle, Copy, Check, Bot, Wand2, FileText, DollarSign, ListTodo, Users, Save
- ✅ Did NOT modify `page.tsx` or `layout.tsx`
- ✅ Did NOT create new page routes
- ✅ Lint: zero errors in any of the 6 AI files (2 pre-existing errors in `share-section.tsx` / `whatsapp-rsvp.tsx` are out of scope — owned by other agents)
- ✅ TypeScript: zero errors in any of the 6 AI files
- ✅ All 3 API routes return 200/401/400/429 as expected
- ✅ Real GLM 5.2 calls succeed — responses are warm, culturally aware, within word limits

## Integration Notes for Lead Agent

### Guest AI — wire once anywhere in the tree:
```tsx
import { AiTrigger } from '@/components/wedding/ai-trigger'
// Then render once high in the tree (e.g. in layout.tsx or page.tsx):
<AiTrigger />
```
This handles the floating bubble, dismissal state, and 24h re-appearance automatically. No props needed.

### Couple AI — wire as a new tab in `wedding-planner.tsx`:
```tsx
import { AiPlannerAssistant } from '@/components/wedding/ai-planner-assistant'

// In the TabsList, add:
<PlannerTabTrigger value="ai" icon={<Sparkles className="size-3.5" />} label="AI" />

// In the TabsContent area, add:
<TabsContent value="ai" className="mt-0 h-full">
  <AiPlannerAssistant />
</TabsContent>
```
The component is self-contained — it fetches its own guest/task data when needed (no props required). It only renders meaningfully when the planner is open AND the admin cookie is set (otherwise the AI endpoints return 401, which the component handles gracefully).

### Speech generator access:
The speech generator is built INTO the AiPlannerAssistant — it opens as a modal when the couple clicks "Write my vows" or "Help with my speech". No separate wiring needed.

### Save-to-notes:
Notes are stored in `localStorage` under `wewed:ai-planner-notes` as a JSON array of `{id, content, kind, ts}`. A future "Notes" tab in the planner could read and display these.

## Cultural Awareness Verification

The GLM 5.2 responses (verified live) correctly referenced:
- **Roora / Lobola** — bride price tradition (mentioned in couple-context budget tips and Shona traditions query)
- **Magumo** — traditional ceremony (mentioned in couple-context budget tips)
- **Kurova guva** — ancestral ceremony (mentioned in Shona traditions query)
- **Kugara nhaka** — inheritance ritual (mentioned in Shona traditions query)
- **Imba Manor, Borrowdale, Harare** — venue correctly identified
- **December 23, 2026** — date correctly referenced
- **"Marriage is not just between two people, but between two families"** — Zimbabwean communal view of marriage (in groom's speech)
- **Meikles Hotel** — shuttle pickup correctly referenced (in guest timing query)

The AI genuinely feels like a warm, culturally-aware concierge — not a generic chatbot.

## What Was NOT Done (per task rules)

- Did NOT modify `page.tsx` or `layout.tsx` — lead agent wires everything
- Did NOT modify `wedding-planner.tsx` — lead agent adds the new AI tab
- Did NOT create new page routes
- Did NOT touch existing wedding components (other than reading them for style reference)
- Did NOT create new mini-services (the AI runs as Next.js API routes, not a separate service)
- Did NOT install new packages (all deps already in package.json: z-ai-web-dev-sdk, react-markdown, framer-motion, lucide-react, shadcn/ui components)

## Status: ✅ COMPLETE — awaiting lead agent wiring
