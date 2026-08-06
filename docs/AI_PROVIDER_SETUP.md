# wewed AI provider setup

This project now has one server-side AI router for Groq, Gemini, and Z.AI.
The existing chat, RSVP summary, and speech routes use the router without
exposing provider keys to the browser.

## Routing policy

| Data profile | Default provider | Automatic fallback |
| --- | --- | --- |
| Private wedding/client data | Groq (`openai/gpt-oss-120b`) | Disabled by default |
| Explicitly anonymized work | Gemini (`gemini-3.6-flash`) | Z.AI, then Groq |
| Free fallback | Z.AI (`glm-4.7-flash`) | N/A |

`AI_ALLOW_PRIVATE_FALLBACK=false` is the safe production default. Do not turn
it on for real client data unless you have reviewed and accepted every
fallback provider's data-handling terms.

## 1. Check out the implementation

```bash
git fetch origin
git checkout feature/ai-provider-router
bun install
```

No new AI SDK dependency is required. The router uses server-side HTTP calls.

## 2. Create the local environment file

Preserve an existing `.env.local` if it already contains database or Supabase
credentials. Otherwise:

```bash
cp .env.example .env.local
```

Open the file:

```bash
nano .env.local
```

Or use your normal editor:

```bash
code .env.local
```

## 3. Create provider keys

### Groq — required first

1. Sign in at https://console.groq.com/keys
2. Create an API key.
3. In Groq Data Controls, enable Zero Data Retention before testing real
   wedding data.
4. Add the key to `.env.local`:

```dotenv
GROQ_API_KEY="paste-the-key-here"
GROQ_MODEL="openai/gpt-oss-120b"
```

### Gemini — quality provider for anonymized data

1. Sign in to Google AI Studio at https://aistudio.google.com/apikey
2. Create a new Gemini API key. Use the current authorization-key flow rather
   than an old unrestricted standard key.
3. Add it to `.env.local`:

```dotenv
GEMINI_API_KEY="paste-the-key-here"
GEMINI_MODEL="gemini-3.6-flash"
```

The unpaid Gemini tier may use prompts and responses to improve Google
products. Never send unredacted client names, contacts, budgets, contracts,
addresses, or private notes through the anonymized profile.

### Z.AI — optional free fallback

1. Sign in at https://z.ai/manage-apikey/apikey-list
2. Create an API key.
3. Add it to `.env.local`:

```dotenv
ZAI_API_KEY="paste-the-key-here"
ZAI_MODEL="glm-4.7-flash"
ZAI_BASE_URL="https://api.z.ai/api/paas/v4"
```

Use the API key from the Open Platform. A separate coding-plan subscription
quota is not a general-purpose application API key.

## 4. Confirm routing values

Keep these values for the first test:

```dotenv
AI_ENABLED="true"
AI_PRIVATE_PROVIDER="groq"
AI_QUALITY_PROVIDER="gemini"
AI_FALLBACK_PROVIDER="zai"
AI_ALLOW_PRIVATE_FALLBACK="false"
AI_REQUEST_TIMEOUT_MS="30000"
AI_MAX_OUTPUT_TOKENS="2048"
```

Never use `NEXT_PUBLIC_`, `VITE_`, or `REACT_APP_` in an AI key name.

## 5. Run the provider smoke test

```bash
bun run ai:test
```

Expected shape:

```text
wewed AI provider smoke test
routing private=groq quality=gemini fallback=zai
PASS groq    model=openai/gpt-oss-120b ...
PASS gemini  model=gemini-3.6-flash ...
PASS zai     model=glm-4.7-flash ...
All configured AI providers responded successfully.
```

Only providers with a key are tested. The test sends synthetic text and never
reads the planner database.

If a key fails, verify the copied value, model ID, account quota, and provider
console. Restart the development server after changing `.env.local`.

## 6. Start the app and inspect health

```bash
bun run dev
```

In another terminal:

```bash
curl -s http://localhost:3000/api/ai/health | python -m json.tool
```

The endpoint reports provider configuration booleans and model IDs. It never
returns keys and does not consume provider quota.

## 7. Test the public chat route

```bash
curl -s -X POST http://localhost:3000/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "context": "guest",
    "messages": [
      {"role": "user", "content": "What time is the ceremony?"}
    ]
  }' | python -m json.tool
```

A successful response includes `success`, `reply`, `provider`, and `model`.
The guest route is deliberately treated as private because a guest may type
personal data into a public chat box.

## 8. Test planner-only AI in the UI

Sign in as an authorized planner/admin and test:

1. Planner/couple chat
2. RSVP summary generation
3. Wedding speech generation

The existing API response fields are preserved. Provider and model metadata
are added for diagnostics.

## 9. Production deployment

Add the same variables to the deployment platform's server-side environment
settings, then redeploy. Do not commit `.env.local`.

At minimum, production requires:

```dotenv
AI_PRIVATE_PROVIDER="groq"
AI_ALLOW_PRIVATE_FALLBACK="false"
GROQ_API_KEY="..."
GROQ_MODEL="openai/gpt-oss-120b"
```

Gemini and Z.AI can be added later without changing application code.

## Failure behavior

- Chat returns its existing friendly fallback rather than a server error.
- RSVP summaries fall back to deterministic statistics computed by the app.
- Speech generation reports a retryable failure.
- Provider errors are logged without prompts, API keys, or response bodies.
- The AI router never writes directly to Prisma/Supabase.
