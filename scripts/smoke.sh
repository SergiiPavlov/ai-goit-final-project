#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:4001}"
KEY="${KEY:-leleka-dev}"
ORIGIN="${ORIGIN:-http://127.0.0.1:5500}"

echo "== Health"
curl -s -i "$BASE/v1/health" | head -n 20

echo "== Public config (no origin)"
curl -s -i "$BASE/v1/projects/$KEY/public-config" | head -n 30

echo "== CORS preflight"
curl -s -i -X OPTIONS "$BASE/v1/projects/$KEY/public-config" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization, X-Project-Key" | head -n 40

echo "== KB sources (must be > 0)"
KB_SOURCES_JSON="$(curl -s -H "X-Project-Key: $KEY" "$BASE/v1/kb/sources")"
echo "$KB_SOURCES_JSON" | head -c 600; echo

KB_SOURCES_JSON="$KB_SOURCES_JSON" node -e '
  const raw = process.env.KB_SOURCES_JSON || "{}";
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error("SMOKE_FAIL: kb/sources is not valid JSON");
    process.exit(2);
  }
  const n = Array.isArray(data.items) ? data.items.length : 0;
  if (n < 1) {
    console.error("SMOKE_FAIL: KB sources empty");
    process.exit(2);
  }
  console.error(`KB sources OK: ${n}`);
'

echo "== Chat (RAG sources must be connected)"
TMP_BODY="$(mktemp 2>/dev/null || echo "./.tmp.smoke.body.json")"
node -e 'process.stdout.write(JSON.stringify({message:"Можно ли курить при беременности?",locale:"ru",history:[]}))' > "$TMP_BODY"

CHAT_JSON="$(curl -s "$BASE/v1/chat" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "X-Project-Key: $KEY" \
  --data-binary "@$TMP_BODY")"
rm -f "$TMP_BODY" 2>/dev/null || true

echo "$CHAT_JSON" | head -c 900; echo

CHAT_JSON="$CHAT_JSON" node -e '
  const raw = process.env.CHAT_JSON || "{}";
  let data;
  try { data = JSON.parse(raw); } catch (e) {
    console.error("SMOKE_FAIL: chat response is not valid JSON");
    process.exit(3);
  }
  const n = Array.isArray(data.sources) ? data.sources.length : 0;
  if (n < 1) {
    console.error("SMOKE_FAIL: Chat returned empty sources[] (KB not connected / RAG failed)");
    process.exit(3);
  }
  console.error(`Chat sources OK: ${n}`);
'

echo "== Widget asset"
curl -s -I "$BASE/widget/widget.js" | head -n 20

echo "== Metrics"
curl -s "$BASE/v1/metrics" | head -c 900; echo

echo "OK"
