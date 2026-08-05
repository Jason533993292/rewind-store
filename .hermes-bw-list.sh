#!/bin/bash
cd /Users/phil/REWIND
URL=$(grep -o 'SUPABASE_URL=.*' .env | head -1 | cut -d= -f2-)
KEY=$(grep -o 'SUPABASE_SERVICE_ROLE_KEY=.*' .env | head -1 | cut -d= -f2-)
echo "=== ALL PENDING (id:source:summary) ==="
curl -s -G "$URL/rest/v1/cron_inbox" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  --data-urlencode 'select=id,source,summary' \
  --data-urlencode 'handled=eq.false' \
  --data-urlencode 'claimed_by=is.null' \
  --data-urlencode 'order=created_at.asc' \
  --data-urlencode 'limit=100'
echo ""
echo "=== TOTAL PENDING COUNT ==="
curl -s -G "$URL/rest/v1/cron_inbox" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  --data-urlencode 'select=id' \
  --data-urlencode 'handled=eq.false' \
  --data-urlencode 'claimed_by=is.null' \
  -H 'Prefer: count=exact' -D - -o /dev/null | grep -i content-range
echo ""
