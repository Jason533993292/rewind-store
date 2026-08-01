#!/usr/bin/env python3
import json, urllib.request, sys

creds = json.load(open('/Users/phil/.hermes/scripts/_rw_creds.json'))
BASE = creds['url'] + "/rest/v1"
KEY = creds['key']
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=H, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        raw = resp.read().decode()
        return resp.status, (json.loads(raw) if raw else None)

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "list"
    if action == "list":
        q = "/cron_inbox?select=*&handled=eq.false&claimed_by=is.null&order=created_at.asc&limit=20"
        st, rows = req("GET", q)
        print("STATUS:", st, "COUNT:", len(rows))
        for r in rows:
            print("---")
            for k, v in r.items():
                sv = str(v)
                if len(sv) > 250: sv = sv[:250] + "..."
                print(f"  {k}: {sv}")
    elif action == "claim":
        # claim by id
        rid = sys.argv[2]
        from datetime import datetime, timezone
        iso = datetime.now(timezone.utc).isoformat()
        st, res = req("PATCH", f"cron_inbox?id=eq.{rid}", {"claimed_by": "bug_watcher", "claimed_at": iso})
        print("CLAIM STATUS:", st, res)
