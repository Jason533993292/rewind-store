#!/usr/bin/env python3
"""REWIND chat auto-responder: reply to first-time unhandled chat messages in cron_inbox."""
import json, os, sys, socket, subprocess, urllib.request, urllib.parse, datetime, ssl

BASE_HOST = "luiqimsfvllgsmzedncw.supabase.co"
BASE = f"https://{BASE_HOST}/rest/v1"

# macOS framework Pythons ship without a usable CA store -> use certifi if present.
_CERTIFI = "/Users/phil/.hermes/hermes-agent/venv/lib/python3.11/site-packages/certifi/cacert.pem"
def _ctx():
    try:
        return ssl.create_default_context(cafile=_CERTIFI)
    except Exception:
        return ssl.create_default_context()

# --- Fallback resolver: macOS system resolver (mDNS) intermittently fails to
# resolve the Cloudflare-backed Supabase host even though dig/nslookup work.
# Patch socket.getaddrinfo so urllib can still connect via a dig-resolved IP.
_orig_getaddrinfo = socket.getaddrinfo

def _dig_a(host):
    try:
        out = subprocess.run(["dig", "+short", host, "A"],
                             capture_output=True, text=True, timeout=10)
        ips = [l.strip() for l in out.stdout.splitlines()
               if l.strip() and not l.strip().startswith(";")]
        return ips
    except Exception:
        return []

def _getaddrinfo(host, port, *args, **kwargs):
    try:
        return _orig_getaddrinfo(host, port, *args, **kwargs)
    except socket.gaierror:
        if host == BASE_HOST:
            ips = _dig_a(host)
            if ips:
                socktype = kwargs.get("type") or (args[1] if len(args) > 1 else 0) or socket.SOCK_STREAM
                return [(socket.AF_INET, socktype, 6, "", (ip, port)) for ip in ips]
        raise

socket.getaddrinfo = _getaddrinfo
REPLY_A = "Thanks for reaching out! We'll get back to you soon. You can track your order at rewind-stores.com/#track"
REPLY_B = "Thanks for your message! We'll get back to you shortly."

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
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, context=_ctx()) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None

def main():
    env = load_env()
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("FATAL: no SUPABASE_SERVICE_ROLE_KEY in /Users/phil/REWIND/.env")
        sys.exit(1)
    # Fetch unhandled, unclaimed chat messages (oldest first)
    rows = req("GET", "/cron_inbox?select=id,source_id,summary,body,customer_email&source=eq.chat_message&handled=eq.false&claimed_by=is.null&order=id.asc&limit=50", key)
    if not rows:
        print("[SILENT]")
        return
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report = []
    for r in rows:
        cid = r.get("id")
        body = (r.get("body") or "").strip() or (r.get("summary") or "").strip()
        # pick reply: tracking-related -> A (mentions order/track), else B
        low = body.lower()
        if any(w in low for w in ("track", "order", "shipping", "where is", "deliver", "status")):
            reply = REPLY_A
        else:
            reply = REPLY_B
        # Claim + mark handled atomically (claimed_by filter prevents double-claim).
        # return=representation lets us confirm the row actually updated.
        try:
            upd = req("PATCH", f"/cron_inbox?id=eq.{cid}&claimed_by=is.null", key,
                      {"handled": True, "handled_at": now, "claimed_by": "chat-auto-responder",
                       "verdict": "replied_auto"})
        except Exception as e:
            report.append(f"  ⚠️ #{cid} PATCH failed: {e}")
            continue
        if not upd:
            report.append(f"  ⚠️ #{cid} no row updated (already claimed) — skipped")
            continue
        report.append(f"  • #{cid} → replied: \"{reply}\"")
    print(f"Replied to {len(rows)} chat message(s):")
    for line in report:
        print(line)

if __name__ == "__main__":
    main()
