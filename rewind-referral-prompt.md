# REWIND Store — Referral System Build Prompt for Claude

## Project Context
**Site:** rewind-stores.com (React/Vite + Express + Supabase + Stripe + Resend + Gemini)
**Repo:** Jason533993292/rewind-store (branch main)
**Version:** V10.11.0

The site is a vintage streetwear store. Average order ~€50. Customers are repeat buyers who share finds with friends.

## Goal
Build a referral system where existing customers can refer friends. Both parties get a 5% discount. The system must prevent fraud.

## Fraud Prevention Requirements (MANDATORY)

### 1. Discount pays out only after a real purchase
The referrer's 5% code is NOT generated on signup. It's created only after the referred person:
- Clicks the referral link (cookie drops)
- Places an order (not abandoned cart)
- The order is marked as "shipped" or "confirmed" (Stripe webhook confirms payment)

No real order = no discount code. This kills 90% of alt-email abuse.

### 2. Flag identical shipping details
When the referee checks out, compare their shipping name + address + postal code against the referrer's past orders. If they match >80%, block the referral and flag for admin review. Most abusers reuse their own address.

### 3. IP + fingerprint tracking
Store the IP address and a browser fingerprint hash when the referral link is clicked. If the same IP/fingerprint generates more than 2 referrals in 24h, block it. Use a simple fingerprint (user agent + screen resolution + timezone — no 3rd party library needed).

### 4. Monthly cap
Max 5 successful referrals per customer per month. Real customers refer 1-3 people max. Anyone hitting the cap is abusing.

### 5. Cookie-based tracking (not just codes)
When someone clicks a referral link like `rewind-stores.com/ref?code=ABC123`, drop a cookie with the referrer code. The discount auto-applies at checkout — no code to paste. Cookie expires in 30 days. If the customer clears cookies, they can paste the code as fallback.

## Build Requirements

### Database (Supabase)
Create a `referrals` table:
```sql
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_email TEXT NOT NULL,
  referee_email TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending', -- pending, ordered, completed, flagged, blocked
  referee_ip TEXT,
  referee_fingerprint TEXT,
  referrer_discount_given BOOLEAN DEFAULT false,
  referee_discount_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Server (api/server.js)
- `POST /api/referral/create` — generates a referral code for an authenticated customer (use their email + a random 6-char code)
- `GET /api/referral/:code` — validates a referral code and drops a cookie (set-Cookie header)
- `POST /api/referral/apply` — applies a referral cookie/code at checkout (returns discount)
- Webhook handler: when order is confirmed (payment_intent.succeeded), mark referral as completed and generate the 5% discount codes for both parties
- Admin endpoint to view flagged referrals

### Frontend (src/App.jsx + src/components/Referral*.jsx)
- Referral dashboard in the account/checkout area: "Share your code" with a copy button
- Auto-apply the discount at checkout when referral cookie/code is detected
- Show discount line in order summary: "Friend referral -5%"

### Fraud Checks (apply in order)
1. When referral link is clicked: check IP/fingerprint cap → block if exceeded
2. When referee places order: compare shipping address with referrer's past orders → flag if too similar
3. When order is paid: only then generate discount codes for both parties
4. Monthly cap check before code generation

### Already in place
- Stripe webhook with signature verification (use payment_intent.succeeded)
- Supabase client access
- Environment variables: SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY
- CSP allows *.stripe.com

### Give me
1. Exact SQL for the referrals table
2. Server endpoint code (ready to paste into server.js)
3. Frontend component code
4. The cookie handling logic
5. All fraud check implementations

Use the existing code patterns from the site (same Supabase fetch pattern, same error handling style).
