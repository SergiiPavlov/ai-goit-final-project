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
  -H "Access-Control-Request-Method: GET" | head -n 40

echo "== Chat (with origin)"
curl -s -i "$BASE/v1/chat" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: $KEY" \
  -d '{"message":"Тест smoke","history":[]}' | head -n 60

echo "== Widget asset"
curl -s -I "$BASE/widget/widget.js" | egrep -i '^(HTTP|content-type|cross-origin-resource-policy|access-control-allow-origin|cache-control)'

echo "== Metrics"
curl -s "$BASE/v1/metrics" | head -n 40

echo "OK"
