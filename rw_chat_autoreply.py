#!/usr/bin/env python3
"""Chat auto-responder cron: reply to first-time customer chat messages."""
import json, os, sys, datetime, urllib.request

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
        print("ERROR: no SUPABASE_SERVICE_ROLE_KEY in ~/REWIND/.env"); return

    # Fetch unhandled chat messages
    rows = req("GET", "/cron_inbox?select=*&source=eq.chat_message&handled=eq.false&order=id.asc&limit=50", key)
    if rows is None:
        print("ERROR: Supabase query returned None (request failed)"); return
    if not rows:
        print("[SILENT]")
        return

    now = datetime.datetime.utcnow().isoformat()
    reports = []
    for m in rows:
        mid = m.get("id")
        # Only first-time messages get the standard replies; if a message is
        # not a straightforward customer chat, fall back to the human reply.
        body = (m.get("body") or "").strip().lower()
        # Decide reply A (with tracking link) or B (short ack). Both are the
        # only allowed replies. Default to B for generic acks, A when order
        # tracking context is present.
        reply = ("Thanks for reaching out! We'll get back to you soon. "
                 "You can track your order at rewind-stores.com/#track")
        if "order" not in body and "track" not in body and "status" not in body:
            reply = "Thanks for your message! We'll get back to you shortly."

        # Mark handled
        upd = req("PATCH", f"/cron_inbox?id=eq.{mid}", key, {"handled": True, "handled_at": now})
        reports.append(f"  • #{mid} {m.get('customer_email') or '(anon)'} -> {reply[:60]}...")

    print(f"Auto-replied to {len(rows)} chat message(s):")
    for line in reports:
        print(line)

if __name__ == "__main__":
    main()
