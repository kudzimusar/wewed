# Notebook Live Transcription — Final Production Closure

**Stamp:** `WW-NOTEBOOK-LIVE-ASR-2026-08-20-01`  
**Status:** STAMPED — FINAL PRODUCTION CLOSURE  
**Baseline:** `713e0a59277cdb8629a1a1d2e662c38ada6c3a26`  
**Scope:** make Notebook `Record & transcribe` function with Wewed's actually configured private AI provider while preserving the original recording and all Notebook authority boundaries.

## Production finding

The earlier provider resolver was correct but Production still reported transcription unavailable. Production AI health proves the only configured model provider is Wewed's private Z.AI route; Groq is not configured. Therefore a Groq-only transcription fallback cannot make the feature operational.

Z.AI exposes OpenAI-compatible audio transcription with `glm-asr-2512`, but its direct upload contract is bounded to short WAV/MP3 audio. Wewed must not send a long browser WebM meeting recording to an endpoint whose documented input contract does not support that recording.

## Final operating design

1. Keep the original browser WebM recording as the canonical private audio evidence in the existing `wewed-notebook` private bucket.
2. Resolve an explicit Wewed speech-to-text override first; otherwise reuse the configured private Z.AI credential; use Groq only when it is actually configured and Z.AI is absent.
3. For Z.AI, capture microphone PCM alongside the preserved WebM and encode bounded WAV chunks during the meeting.
4. Transcribe each short WAV chunk server-side through the authenticated Notebook API. The browser never receives provider credentials.
5. Assemble chunk results in sequence and attach the combined transcript to the preserved recording after upload.
6. A failed chunk, provider outage, rate limit or transcript attachment failure never deletes or rolls back the saved recording.
7. Direct automatic transcription remains available for providers whose endpoint accepts the stored recording format and duration.
8. Manual transcript correction remains available. The transcript never becomes an approved budget, booking, payment or contract fact without the existing explicit governed action.

## Security and privacy boundaries

- Notebook authorization runs before audio leaves Wewed.
- Provider credentials remain server-only and never use `NEXT_PUBLIC_` variables.
- Private Notebook data follows Wewed's configured private provider route; no unapproved private fallback is introduced.
- Original audio stays private and recoverable even when transcription fails.
- No schema migration and no authorization broadening.

## Release gates

- Unit/source contracts prove Z.AI-first private provider resolution, provider capability limits, WAV encoding, live-chunk route authorization, recording-first preservation and transcript attachment.
- Notebook workflow and full executable Planner browser release gate pass on the exact PR head.
- All applicable repository workflows pass on that same head.
- Exact-head Vercel preview is READY.
- Current `main` is reconciled before merge.
- Production deployment is READY and `/planner/notebook` reports transcription configured.
