#!/bin/bash
cd /Users/phil/REWIND
URL=$(grep -o 'SUPABASE_URL=.*' .env | head -1 | cut -d= -f2-)
KEY=$(grep -o 'SUPABASE_SERVICE_ROLE_KEY=.*' .env | head -1 | cut -d= -f2-)
echo "=== RECENT webhook_events (event:source_id:payload.commit-ish) ==="
curl -s -G "$URL/rest/v1/webhook_events" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  --data-urlencode 'select=id,event,source,created_at' \
  --data-urlencode 'order=id.desc' \
  --data-urlencode 'limit=30'
echo ""
