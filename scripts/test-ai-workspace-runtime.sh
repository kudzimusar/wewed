#!/usr/bin/env bash
set -euo pipefail

PORT="${AI_RUNTIME_PORT:-3100}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_FILE="${RUNNER_TEMP:-/tmp}/wewed-ai-runtime.log"

PORT="$PORT" HOSTNAME="127.0.0.1" NODE_ENV=production \
  bun .next/standalone/server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl -fsS "$BASE_URL/api/ai/health" >/tmp/wewed-ai-health.json; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$LOG_FILE"
    exit 1
  fi
  sleep 1
done

curl -fsS "$BASE_URL/api/ai/health" >/tmp/wewed-ai-health.json
curl -fsS "$BASE_URL/api/ai/chat" >/tmp/wewed-ai-chat-service.json
curl -fsS "$BASE_URL/api/ai/context/health?slug=ci-ai-wedding" >/tmp/wewed-ai-context-health.json
curl -fsS \
  -X POST "$BASE_URL/api/ai/chat" \
  -H 'Content-Type: application/json' \
  -d '{
    "context": "guest",
    "weddingSlug": "ci-ai-wedding",
    "messages": [
      {"role": "user", "content": "What time is the wedding ceremony?"}
    ]
  }' >/tmp/wewed-ai-guest-chat.json

DOCUMENT_STATUS=$(curl -sS -o /tmp/wewed-ai-documents-unauthorized.json -w '%{http_code}' "$BASE_URL/api/ai/documents")
WORKSPACE_STATUS=$(curl -sS -o /tmp/wewed-ai-workspace.html -w '%{http_code}' "$BASE_URL/planner/ai-workspace")

python3 - <<'PY'
import json
from pathlib import Path


def load(name: str):
    return json.loads(Path(name).read_text())

health = load('/tmp/wewed-ai-health.json')
assert health['success'] is True
assert health['service'] == 'wewed AI provider router'

service = load('/tmp/wewed-ai-chat-service.json')
assert service['success'] is True
assert set(service['areas']) == {
    'guest_concierge',
    'planner_copilot',
    'template_intelligence',
    'communication_assistant',
}
assert 'indexed documents' in service['grounding']

context = load('/tmp/wewed-ai-context-health.json')
assert context['success'] is True
assert context['privacy'] == 'link_only'
assert context['grounding']['publishedContentItems'] == 1
assert context['grounding']['programmeItems'] == 1
assert context['grounding']['publicDocumentChunks'] == 1
assert context['grounding']['privateDocumentChunksExcluded'] == 1
assert context['boundaries']['guestUsesPrivatePlannerData'] is False

chat = load('/tmp/wewed-ai-guest-chat.json')
assert chat['success'] is True
assert chat['area'] == 'guest_concierge'
assert chat['weddingId'] == 'ci-ai-wedding'
assert chat.get('fallback') is True
assert chat.get('error') == 'AI provider unavailable'

unauthorized = load('/tmp/wewed-ai-documents-unauthorized.json')
assert unauthorized['success'] is False
assert unauthorized['error']
PY

if [[ "$DOCUMENT_STATUS" != "401" ]]; then
  echo "Expected unauthenticated document API status 401, got $DOCUMENT_STATUS"
  cat /tmp/wewed-ai-documents-unauthorized.json
  exit 1
fi

if [[ "$WORKSPACE_STATUS" != "200" ]]; then
  echo "Expected AI workspace page status 200, got $WORKSPACE_STATUS"
  cat "$LOG_FILE"
  exit 1
fi

echo "Wewed AI built-runtime smoke test passed."
