#!/usr/bin/env python3
"""Webhook Monitor cron: poll webhook_events, forward to cron_inbox, update cursor."""
import json, os, sys, re, urllib.request, urllib.parse

BASE = "https://luiqimsfvllgsmzedncw.supabase.co/rest/v1"

def load_env():
    env = {}
    try:
        with open("/Users/phil/REWIND/.env") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env

def req(method, path, key, body=None):
    url = BASE + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None

def main():
    env = load_env()
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("[SILENT]", file=sys.stderr); return
    # Cursor = max already-forwarded id in cron_inbox (source=webhook_event).
    # IMPORTANT: source_id is stored as TEXT and may contain rogue/non-event values
    # (e.g. 1785225462 from a mis-logged cron-bot row). Clamp to the real max
    # webhook event id so the cursor can't be poisoned into "[SILENT]"-forever.
    max_we = req("GET", "/webhook_events?select=id&order=id.desc&limit=1", key)
    real_max = int(max_we[0]["id"]) if max_we else 0
    rows = req("GET", f"/cron_inbox?select=source_id&source=eq.webhook_event&limit=1000", key)
    fwd_ids = set()
    for r in rows or []:
        sid = r.get("source_id")
        if sid is None:
            continue
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            continue
        if 0 <= sid <= real_max:      # only count valid webhook event ids
            fwd_ids.add(sid)
    cursor = max(fwd_ids) if fwd_ids else 0
    # Fetch events after cursor
    new_events = req("GET", f"/webhook_events?select=*&id=gt.{cursor}&order=id.asc&limit=50", key)
    if not new_events:
        print("[SILENT]")
        return
    # Report + forward relevant (skip source=cron-bot, and events already forwarded)
    report = []
    for ev in new_events:
        src = (ev.get("source") or "").strip()
        if src == "cron-bot":
            continue
        eid = ev.get("id")
        if eid in fwd_ids:
            continue
        # Forward
        try:
            req("POST", "/cron_inbox", key, {
                "source": "webhook_event",
                "source_id": eid,
                "summary": f"Webhook: {ev.get('event')}",
                "body": ev.get("payload"),
                "customer_email": None,
            })
        except Exception as e:
            report.append(f"  ⚠️ forward failed for event {eid}: {e}")
            continue
        fwd_ids.add(eid)
        cursor = max(cursor, eid)
        report.append(f"  • #{eid} [{src}] {ev.get('event')} @ {ev.get('received_at') or ev.get('created_at')}")
    # Update (no separate state file needed; cursor derived from cron_inbox)
    if not report:
        print("[SILENT]")
        return
    print(f"New webhook events ({len(report)}):")
    for line in report:
        print(line)

if __name__ == "__main__":
    main()
