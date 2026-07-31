#!/usr/bin/env python3
"""
Batch-process the Facted folder (fact-checked in-stock items) with Gemini 2.5 Flash.
Outputs facted-labels.json: filename, category, title, brand, price (avg EUR), description.
"""
import os, sys, json, base64, time, urllib.request as ureq

FOLDER = os.path.expanduser("~/Desktop/Facted")
API_KEY = None
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith('GEMINI_API_KEY='):
                API_KEY = line.strip().split('=', 1)[1].strip('"').strip("'")
                break
API_KEY = API_KEY or os.environ.get('GEMINI_API_KEY')
if not API_KEY:
    print("ERROR: Set GEMINI_API_KEY in .env or environment"); sys.exit(1)

CATEGORIES = """- Brasils: Football-inspired jerseys with Brazilian/retro styling
- Jerseys: Retro sport jerseys (rugby, football, basketball)
- Polos: Polo shirts, terry, pique, rugby-style
- Jumpers: Knit jumpers, crewnecks, cardigans
- Zip-up Jumpers: Hooded or collar zip-ups, tracksuit top style
- Tracksuits: Full matching sets (top + pants)
- Pants: Track pants, cargo, sweatpants
- Sets: Coordinated two-piece outfits (non-tracksuit)
- Shoes: Retro trainers, sneakers
- Jackets: Bomber, varsity, windbreakers, outerwear"""

SYSTEM_PROMPT = f"""You are a vintage clothing catalogue assistant for REWIND Store (EU, EUR pricing).
For each product image:
1. Category (exactly from this list):
{CATEGORIES}
2. Product title (concise, brand + type + colour, e.g. "Vintage Nike Windbreaker — Black")
3. Brand (the actual brand name, or "Unknown" if not identifiable)
4. Average resale price in EUR (whole number, realistic for EU vintage market)
5. Short description (1 sentence: style, condition cues, era)

Output a JSON array of objects with fields: filename, category, title, brand, price, description.
price must be a NUMBER (EUR)."""

def encode_image(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def get_mime(path):
    ext = path.lower().rsplit('.', 1)[-1]
    return {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
            'webp': 'image/webp', 'gif': 'image/gif'}.get(ext, 'image/jpeg')

files = sorted(f for f in os.listdir(FOLDER)
               if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')) and not f.startswith('.'))
print(f"Found {len(files)} images in {FOLDER}")
if not files:
    sys.exit(0)

BATCH = 8
all_results = []
for i in range(0, len(files), BATCH):
    batch = files[i:i+BATCH]
    print(f"\nBatch {i//BATCH + 1}/{(len(files)-1)//BATCH + 1} ({len(batch)} images)...")
    parts = [{"text": f"Analyze these {len(batch)} product images and return the JSON array. "
                       "The images are labelled in order: " + ", ".join(f"'{f}'" for f in batch) + ". "
                       "Use the EXACT filename from that list in each result object."}]
    for fname in batch:
        parts.append({"inline_data": {"mime_type": get_mime(fname), "data": encode_image(os.path.join(FOLDER, fname))}})
    payload = {
        "contents": [{"parts": parts}],
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    req = ureq.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    try:
        resp = json.loads(ureq.urlopen(req, timeout=90).read())
        text = resp.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        text = text.strip()
        if text.startswith('```json'): text = text[7:]
        if text.startswith('```'): text = text[3:]
        if text.endswith('```'): text = text[:-3]
        for r in json.loads(text.strip()):
            print(f"  {str(r.get('brand','?')):18s} | {str(r.get('price','?')):>5s} EUR | {str(r.get('title','?'))[:52]}")
            all_results.append(r)
    except Exception as e:
        print(f"  ERROR: {e}")
        time.sleep(5)

out = os.path.join(os.path.dirname(__file__), '..', 'facted-labels.json')
with open(out, 'w') as f:
    json.dump(all_results, f, indent=2)
print(f"\n✅ Saved {len(all_results)} labels to facted-labels.json")
