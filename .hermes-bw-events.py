#!/usr/bin/env python3
import json, urllib.request

creds = json.load(open('/Users/phil/.hermes/scripts/_rw_creds.json'))
BASE = creds['url'] + "/rest/v1"
KEY = creds['key']
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def get(path):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=H), timeout=30) as r:
        return json.loads(r.read().decode())

# Recent webhook events, focus on failures / bug reports
events = get("/webhook_events?select=id,event,source,created_at,payload&order=id.desc&limit=25")
for e in events:
    ev = e.get("event")
    src = e.get("source")
    # show all; flag anything non-cron-bot and non-deploy success
    flag = ""
    if "failed" in str(ev).lower():
        flag = " <-- FAILURE"
    elif src != "cron-bot" and "deploy" in str(ev).lower() and "success" not in str(ev).lower():
        flag = " <-- NON-SUCCESS"
    payload = e.get("payload")
    summary = ""
    if isinstance(payload, dict):
        summary = json.dumps(payload)[:150]
    elif isinstance(payload, str):
        summary = payload[:150]
    print(f"id={e['id']} src={src} event={ev} created={e.get('created_at','')}{flag}")
    if summary:
        print(f"    {summary}")
