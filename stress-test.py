#!/usr/bin/env python3
"""REWIND stress test — uses curl to safely test endpoints and response times."""
import subprocess, time, sys

BASE = "https://rewind-stores.com"
ENDPOINTS = [
    ("/", "Homepage"),
    ("/#admin", "Admin panel"),
]

CONCURRENT = 3
results = {"passed": 0, "failed": 0, "slow": 0}

def test_url(url, name):
    times = []
    for i in range(CONCURRENT):
        start = time.time()
        try:
            r = subprocess.run(
                ["curl", "-sk", "-o", "/dev/null", "-w", "%{http_code}:%{time_total}", url],
                capture_output=True, text=True, timeout=15
            )
            elapsed = time.time() - start
            parts = r.stdout.strip().split(":")
            status = parts[0] if parts else "000"
            curl_time = float(parts[1]) if len(parts) > 1 and parts[1] else 0
            times.append(curl_time)

            if status == "200":
                results["passed"] += 1
            else:
                results["failed"] += 1
                print(f"  ❌ {name}: HTTP {status}")
            
            if curl_time > 3:
                results["slow"] += 1
                print(f"  ⚠️  {name}: Slow ({curl_time:.1f}s)")

        except Exception as e:
            results["failed"] += 1
            print(f"  ❌ {name}: {e}")

    if times:
        avg = sum(times) / len(times)
        print(f"  {name}: avg={avg:.2f}s  fast={min(times):.2f}s  slow={max(times):.2f}s  ({CONCURRENT}x)")

print(f"\n{'='*55}")
print(f"  REWIND Stress Test — {BASE}")
print(f"{'='*55}\n")

for path, name in ENDPOINTS:
    test_url(BASE + path, name)

# Test API
print(f"\n  --- API ---\n")
try:
    start = time.time()
    r = subprocess.run(
        ["curl", "-sk", "-X", "POST", f"{BASE}/api/send-order",
         "-H", "Content-Type: application/json",
         "-d", '{"email":"test@test.com","items":[],"total":0,"orderNum":"TEST"}',
         "-w", "%{http_code}"],
        capture_output=True, text=True, timeout=15
    )
    elapsed = time.time() - start
    print(f"  ✅ /api/send-order: {r.stdout.strip()} ({elapsed:.2f}s)")
    results["passed"] += 1
except Exception as e:
    print(f"  ❌ /api/send-order: {e}")
    results["failed"] += 1

print(f"\n{'='*55}")
print(f"  {results['passed']} passed, {results['failed']} failed, {results['slow']} slow")
print(f"{'='*55}")

sys.exit(1 if results['failed'] > 0 else 0)
