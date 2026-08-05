#!/usr/bin/env bash
set -euo pipefail

PORT="${AI_RUNTIME_PORT:-3100}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_FILE="${RUNNER_TEMP:-/tmp}/wewed-ai-runtime.log"
CURL_TIMEOUT="${AI_RUNTIME_CURL_TIMEOUT:-20}"
SESSION_SECRET="${WEWED_SESSION_SECRET:?WEWED_SESSION_SECRET is required}"

PORT="$PORT" HOSTNAME="127.0.0.1" NODE_ENV=production \
  bun .next/standalone/server.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  STATUS=$(curl -sS --max-time 2 -o /tmp/wewed-ai-chat-service.json -w '%{http_code}' "$BASE_URL/api/ai/chat" || true)
  if [[ "$STATUS" == "200" ]]; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$LOG_FILE"
    exit 1
  fi
  sleep 1
done

SESSION_TOKEN=$(python3 - "$SESSION_SECRET" <<'PY'
import base64
import hashlib
import hmac
import json
import sys
import time

secret = sys.argv[1].encode()
payload = {
    'version': 2,
    'userId': 'ci-ai-user',
    'authUserId': 'ci-ai-auth-user',
    'email': 'ai-runtime@wewed.test',
    'role': 'planner',
    'coupleId': 'ci-ai-couple',
    'activeWeddingId': 'ci-ai-wedding',
    'expiresAt': int(time.time() * 1000) + 60 * 60 * 1000,
}
encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(',', ':')).encode()).decode().rstrip('=')
signature = base64.urlsafe_b64encode(hmac.new(secret, encoded.encode(), hashlib.sha256).digest()).decode().rstrip('=')
print(f'{encoded}.{signature}')
PY
)
AUTH_HEADER="Cookie: wewed_admin_auth=${SESSION_TOKEN}"

request_json() {
  local method="$1"
  local url="$2"
  local output="$3"
  local body_file="${4:-}"
  if [[ -n "$body_file" ]]; then
    curl -sS --max-time "$CURL_TIMEOUT" \
      -o "$output" \
      -w '%{http_code}' \
      -X "$method" "$url" \
      -H 'Content-Type: application/json' \
      -H "$AUTH_HEADER" \
      --data-binary "@$body_file"
  else
    curl -sS --max-time "$CURL_TIMEOUT" \
      -o "$output" \
      -w '%{http_code}' \
      -X "$method" "$url" \
      -H "$AUTH_HEADER"
  fi
}

json_value() {
  local file="$1"
  local expression="$2"
  python3 - "$file" "$expression" <<'PY'
import json
import sys
from pathlib import Path

value = json.loads(Path(sys.argv[1]).read_text())
for part in sys.argv[2].split('.'):
    value = value[int(part)] if part.isdigit() else value[part]
print(value)
PY
}

HEALTH_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-health.json -w '%{http_code}' "$BASE_URL/api/ai/health")
CHAT_SERVICE_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-chat-service.json -w '%{http_code}' "$BASE_URL/api/ai/chat")
CONTEXT_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-context-health.json -w '%{http_code}' "$BASE_URL/api/ai/context/health?slug=ci-ai-wedding")
GUEST_CHAT_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" \
  -o /tmp/wewed-ai-guest-chat.json \
  -w '%{http_code}' \
  -X POST "$BASE_URL/api/ai/chat" \
  -H 'Content-Type: application/json' \
  -d '{
    "context": "guest",
    "weddingSlug": "ci-ai-wedding",
    "messages": [
      {"role": "user", "content": "What time is the wedding ceremony?"}
    ]
  }')

DOCUMENT_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-documents-unauthorized.json -w '%{http_code}' "$BASE_URL/api/ai/documents")
WORKSPACE_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-workspace.html -w '%{http_code}' -H "$AUTH_HEADER" "$BASE_URL/planner/ai-workspace")

cat >/tmp/wewed-ai-planner-chat-body.json <<'JSON'
{
  "context": "couple",
  "area": "planner_copilot",
  "useDocuments": false,
  "messages": [
    {"role": "user", "content": "What needs attention today?"}
  ]
}
JSON
PLANNER_CHAT_STATUS=$(request_json POST "$BASE_URL/api/ai/chat" /tmp/wewed-ai-planner-chat.json /tmp/wewed-ai-planner-chat-body.json)

for endpoint in templates drafts actions documents; do
  STATUS=$(request_json GET "$BASE_URL/api/ai/$endpoint" "/tmp/wewed-ai-$endpoint-list.json")
  if [[ "$STATUS" != "200" ]]; then
    echo "Expected authenticated $endpoint list status 200, got $STATUS"
    cat "/tmp/wewed-ai-$endpoint-list.json"
    cat "$LOG_FILE"
    exit 1
  fi
done

cat >/tmp/wewed-ai-template-body.json <<'JSON'
{
  "action": "save_version",
  "name": "CI Complete Wedding Template",
  "description": "Runtime validation template",
  "anonymized": true,
  "createdFrom": "ai",
  "content": "Draft template\n```json\n{\"items\":[{\"type\":\"task\",\"title\":\"Confirm CI transport\",\"category\":\"transport\",\"priority\":\"high\",\"offsetDays\":-14},{\"type\":\"timeline\",\"title\":\"CI supplier arrival\",\"time\":\"08:00\",\"duration\":\"30 min\",\"location\":\"North gate\"},{\"type\":\"reminder\",\"title\":\"CI RSVP reminder\",\"subject\":\"Confirm attendance\",\"body\":\"Please confirm your attendance.\",\"audience\":\"pending\",\"offsetDays\":-30}]}\n```"
}
JSON
TEMPLATE_STATUS=$(request_json POST "$BASE_URL/api/ai/templates" /tmp/wewed-ai-template-created.json /tmp/wewed-ai-template-body.json)
TEMPLATE_VERSION_ID=$(json_value /tmp/wewed-ai-template-created.json data.id)
TEMPLATE_ITEM_COUNT=$(json_value /tmp/wewed-ai-template-created.json data.value.items | wc -w | tr -d ' ' || true)

python3 - "$TEMPLATE_VERSION_ID" <<'PY' >/tmp/wewed-ai-template-proposal-body.json
import json, sys
print(json.dumps({
    'action': 'propose_apply',
    'versionId': sys.argv[1],
    'name': 'CI Complete Wedding Template',
    'itemCount': 3,
}))
PY
TEMPLATE_PROPOSAL_STATUS=$(request_json POST "$BASE_URL/api/ai/templates" /tmp/wewed-ai-template-proposal.json /tmp/wewed-ai-template-proposal-body.json)
TEMPLATE_PROPOSAL_ID=$(json_value /tmp/wewed-ai-template-proposal.json data.id)

python3 - "$TEMPLATE_PROPOSAL_ID" <<'PY' >/tmp/wewed-ai-approve-body.json
import json, sys
print(json.dumps({'id': sys.argv[1], 'status': 'approved'}))
PY
TEMPLATE_APPROVE_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-template-approved.json /tmp/wewed-ai-approve-body.json)
python3 - "$TEMPLATE_PROPOSAL_ID" <<'PY' >/tmp/wewed-ai-execute-body.json
import json, sys
print(json.dumps({'id': sys.argv[1], 'status': 'executed'}))
PY
TEMPLATE_EXECUTE_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-template-executed.json /tmp/wewed-ai-execute-body.json)
TEMPLATE_REPEAT_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-template-repeat.json /tmp/wewed-ai-execute-body.json)

cat >/tmp/wewed-ai-draft-body.json <<'JSON'
{
  "action": "create",
  "title": "CI RSVP follow-up",
  "audience": "Pending guests",
  "channel": "email",
  "subject": "Please confirm your attendance",
  "body": "Draft\n\nPlease confirm your attendance before the RSVP deadline."
}
JSON
DRAFT_STATUS=$(request_json POST "$BASE_URL/api/ai/drafts" /tmp/wewed-ai-draft-created.json /tmp/wewed-ai-draft-body.json)
DRAFT_ID=$(json_value /tmp/wewed-ai-draft-created.json data.id)
python3 - "$DRAFT_ID" <<'PY' >/tmp/wewed-ai-draft-proposal-body.json
import json, sys
print(json.dumps({'action': 'propose_reminder', 'draftId': sys.argv[1], 'audience': 'pending'}))
PY
DRAFT_PROPOSAL_STATUS=$(request_json POST "$BASE_URL/api/ai/drafts" /tmp/wewed-ai-draft-proposal.json /tmp/wewed-ai-draft-proposal-body.json)
DRAFT_PROPOSAL_ID=$(json_value /tmp/wewed-ai-draft-proposal.json data.id)
python3 - "$DRAFT_PROPOSAL_ID" <<'PY' >/tmp/wewed-ai-draft-approve-body.json
import json, sys
print(json.dumps({'id': sys.argv[1], 'status': 'approved'}))
PY
DRAFT_APPROVE_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-draft-approved.json /tmp/wewed-ai-draft-approve-body.json)
python3 - "$DRAFT_PROPOSAL_ID" <<'PY' >/tmp/wewed-ai-draft-execute-body.json
import json, sys
print(json.dumps({'id': sys.argv[1], 'status': 'executed'}))
PY
DRAFT_EXECUTE_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-draft-executed.json /tmp/wewed-ai-draft-execute-body.json)

cat >/tmp/wewed-ai-document-body.json <<'JSON'
{
  "action": "ingest",
  "title": "CI Venue Operations Manual",
  "kind": "venue_manual",
  "visibility": "private",
  "sourceUrl": "https://example.test/ci-venue-manual",
  "text": "Supplier access starts at 08:00 through the north loading gate. The operations manager must confirm all vehicle registrations before arrival. This text is long enough to create and search an indexed workspace document."
}
JSON
DOCUMENT_CREATE_STATUS=$(request_json POST "$BASE_URL/api/ai/documents" /tmp/wewed-ai-document-created.json /tmp/wewed-ai-document-body.json)
DOCUMENT_ID=$(json_value /tmp/wewed-ai-document-created.json data.documentId)
DOCUMENT_SEARCH_STATUS=$(request_json GET "$BASE_URL/api/ai/documents?q=supplier%20access%20north%20gate" /tmp/wewed-ai-document-search.json)
python3 - "$DOCUMENT_ID" <<'PY' >/tmp/wewed-ai-document-proposal-body.json
import json, sys
print(json.dumps({'action': 'propose_publish', 'documentId': sys.argv[1]}))
PY
DOCUMENT_PROPOSAL_STATUS=$(request_json POST "$BASE_URL/api/ai/documents" /tmp/wewed-ai-document-proposal.json /tmp/wewed-ai-document-proposal-body.json)
DOCUMENT_PROPOSAL_ID=$(json_value /tmp/wewed-ai-document-proposal.json data.id)
python3 - "$DOCUMENT_PROPOSAL_ID" <<'PY' >/tmp/wewed-ai-document-approve-body.json
import json, sys
print(json.dumps({'id': sys.argv[1], 'status': 'approved'}))
PY
DOCUMENT_APPROVE_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-document-approved.json /tmp/wewed-ai-document-approve-body.json)
python3 - "$DOCUMENT_PROPOSAL_ID" <<'PY' >/tmp/wewed-ai-document-execute-body.json
import json, sys
print(json.dumps({'id': sys.argv[1], 'status': 'executed'}))
PY
DOCUMENT_EXECUTE_STATUS=$(request_json PATCH "$BASE_URL/api/ai/actions" /tmp/wewed-ai-document-executed.json /tmp/wewed-ai-document-execute-body.json)
POST_PUBLISH_CONTEXT_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-context-published.json -w '%{http_code}' "$BASE_URL/api/ai/context/health?slug=ci-ai-wedding")
python3 - "$DOCUMENT_ID" <<'PY' >/tmp/wewed-ai-document-delete-body.json
import json, sys
print(json.dumps({'documentId': sys.argv[1]}))
PY
DOCUMENT_DELETE_STATUS=$(request_json DELETE "$BASE_URL/api/ai/documents" /tmp/wewed-ai-document-deleted.json /tmp/wewed-ai-document-delete-body.json)
POST_DELETE_CONTEXT_STATUS=$(curl -sS --max-time "$CURL_TIMEOUT" -o /tmp/wewed-ai-context-deleted.json -w '%{http_code}' "$BASE_URL/api/ai/context/health?slug=ci-ai-wedding")

python3 - <<'PY'
import json
from pathlib import Path


def load(name: str):
    return json.loads(Path(name).read_text())

health = load('/tmp/wewed-ai-health.json')
assert health['success'] is False
assert health['service'] == 'wewed AI provider router'
assert health['enabled'] is False

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

for path, area in [
    ('/tmp/wewed-ai-guest-chat.json', 'guest_concierge'),
    ('/tmp/wewed-ai-planner-chat.json', 'planner_copilot'),
]:
    chat = load(path)
    assert chat['success'] is True
    assert chat['area'] == area
    assert chat['weddingId'] == 'ci-ai-wedding'
    assert chat.get('fallback') is True
    assert chat.get('error') == 'AI provider unavailable'

unauthorized = load('/tmp/wewed-ai-documents-unauthorized.json')
assert unauthorized['success'] is False
assert unauthorized['error']

template = load('/tmp/wewed-ai-template-created.json')
assert template['success'] is True
assert len(template['data']['value']['items']) == 3
assert template['data']['value']['anonymized'] is True

template_execution = load('/tmp/wewed-ai-template-executed.json')
assert template_execution['success'] is True
assert template_execution['data']['status'] == 'executed'
assert template_execution['result']['tasksCreated'] == 1
assert template_execution['result']['timelineCreated'] == 1
assert template_execution['result']['remindersCreated'] == 1
assert template_execution['result']['duplicatesSkipped'] == 0

repeat = load('/tmp/wewed-ai-template-repeat.json')
assert repeat['success'] is False
assert 'cannot move' in repeat['error']

draft_execution = load('/tmp/wewed-ai-draft-executed.json')
assert draft_execution['success'] is True
assert draft_execution['data']['status'] == 'executed'
assert draft_execution['result']['duplicateSkipped'] is False
assert 'not sent' in draft_execution['result']['delivery']

document_search = load('/tmp/wewed-ai-document-search.json')
assert document_search['success'] is True
assert document_search['data'][0]['title'] == 'CI Venue Operations Manual'
assert document_search['data'][0]['visibility'] == 'private'

document_execution = load('/tmp/wewed-ai-document-executed.json')
assert document_execution['success'] is True
assert document_execution['result']['visibility'] == 'public'

published = load('/tmp/wewed-ai-context-published.json')
assert published['grounding']['publicDocumentChunks'] == 2
assert published['grounding']['privateDocumentChunksExcluded'] == 1

deleted = load('/tmp/wewed-ai-document-deleted.json')
assert deleted['success'] is True
assert deleted['data']['deletedChunks'] == 1

after_delete = load('/tmp/wewed-ai-context-deleted.json')
assert after_delete['grounding']['publicDocumentChunks'] == 1
assert after_delete['grounding']['privateDocumentChunksExcluded'] == 1
PY

expect_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  local file="$4"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $label status $expected, got $actual"
    cat "$file"
    cat "$LOG_FILE"
    exit 1
  fi
}

expect_status "$HEALTH_STATUS" 503 'disabled AI health' /tmp/wewed-ai-health.json
expect_status "$CHAT_SERVICE_STATUS" 200 'chat service' /tmp/wewed-ai-chat-service.json
expect_status "$CONTEXT_STATUS" 200 'context health' /tmp/wewed-ai-context-health.json
expect_status "$GUEST_CHAT_STATUS" 200 'guest chat' /tmp/wewed-ai-guest-chat.json
expect_status "$PLANNER_CHAT_STATUS" 200 'planner chat' /tmp/wewed-ai-planner-chat.json
expect_status "$DOCUMENT_STATUS" 401 'unauthenticated document API' /tmp/wewed-ai-documents-unauthorized.json
expect_status "$WORKSPACE_STATUS" 200 'AI workspace page' /tmp/wewed-ai-workspace.html
expect_status "$TEMPLATE_STATUS" 201 'template create' /tmp/wewed-ai-template-created.json
expect_status "$TEMPLATE_PROPOSAL_STATUS" 201 'template proposal' /tmp/wewed-ai-template-proposal.json
expect_status "$TEMPLATE_APPROVE_STATUS" 200 'template approval' /tmp/wewed-ai-template-approved.json
expect_status "$TEMPLATE_EXECUTE_STATUS" 200 'template execution' /tmp/wewed-ai-template-executed.json
expect_status "$TEMPLATE_REPEAT_STATUS" 409 'template repeat protection' /tmp/wewed-ai-template-repeat.json
expect_status "$DRAFT_STATUS" 201 'draft create' /tmp/wewed-ai-draft-created.json
expect_status "$DRAFT_PROPOSAL_STATUS" 201 'draft proposal' /tmp/wewed-ai-draft-proposal.json
expect_status "$DRAFT_APPROVE_STATUS" 200 'draft approval' /tmp/wewed-ai-draft-approved.json
expect_status "$DRAFT_EXECUTE_STATUS" 200 'draft execution' /tmp/wewed-ai-draft-executed.json
expect_status "$DOCUMENT_CREATE_STATUS" 201 'document ingest' /tmp/wewed-ai-document-created.json
expect_status "$DOCUMENT_SEARCH_STATUS" 200 'document search' /tmp/wewed-ai-document-search.json
expect_status "$DOCUMENT_PROPOSAL_STATUS" 201 'document publication proposal' /tmp/wewed-ai-document-proposal.json
expect_status "$DOCUMENT_APPROVE_STATUS" 200 'document publication approval' /tmp/wewed-ai-document-approved.json
expect_status "$DOCUMENT_EXECUTE_STATUS" 200 'document publication execution' /tmp/wewed-ai-document-executed.json
expect_status "$POST_PUBLISH_CONTEXT_STATUS" 200 'post-publication context health' /tmp/wewed-ai-context-published.json
expect_status "$DOCUMENT_DELETE_STATUS" 200 'document delete' /tmp/wewed-ai-document-deleted.json
expect_status "$POST_DELETE_CONTEXT_STATUS" 200 'post-delete context health' /tmp/wewed-ai-context-deleted.json

echo "Wewed AI authenticated built-runtime smoke test passed."
