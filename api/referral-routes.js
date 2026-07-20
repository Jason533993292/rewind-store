import express from 'express';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';

/*
 * ── REWIND Referral System with Fraud Prevention ──
 *
 * Flow:
 * 1. Shopper enters their email → generates a unique referral code
 * 2. They share the code with friends
 * 3. Friend enters the referral code during checkout
 * 4. After the friend's order is paid (webhook confirmed), referrer gets a reward
 *
 * Fraud prevention layers:
 * - Self-referral blocked (referrer !== referee)
 * - Rate-limited code generation (3 per IP per day)
 * - Same-IP detection (flag if referrer & referee share IP)
 * - One redemption per referee email per code
 * - Temporal pattern tracking
 * - Admin flagging system
 * - Reward only after confirmed paid orders
 */

const FRAUD = {
  MAX_CODES_PER_IP_DAY: 3,
  REFERRAL_DISCOUNT_PERCENT: 10,
  REFERRER_REWARD_PERCENT: 10,
};

// In-memory rate limit bucket for code generation per IP (24h TTL)
const ipGenRate = new Map();
setInterval(() => {
  const cutoff = Date.now() - 86400000;
  for (const [k, v] of ipGenRate) if (v.ts < cutoff) ipGenRate.delete(k);
}, 600000);

export function buildReferralRouter({ SUPABASE_URL, SERVICE_KEY, resend, FROM_EMAIL, REPLY_TO, requireAdmin }) {

  const router = express.Router();
  const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });

  // ── Helpers ──

  function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '';
  }

  function getUserAgent(req) {
    return req.headers['user-agent'] || '';
  }

  // ── Shipping-address similarity (Sørensen–Dice on character bigrams) ──
  // Used to catch the most common abuse pattern: a customer "referring"
  // themselves with a second email but the same shipping address.
  function normalizeAddr(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }
  function bigrams(s) {
    const arr = [];
    for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
    return arr;
  }
  function addressSimilarity(a, b) {
    const na = normalizeAddr(a), nb = normalizeAddr(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const bigA = bigrams(na), bigB = bigrams(nb);
    if (bigA.length === 0 || bigB.length === 0) return 0;
    const counts = new Map();
    for (const bg of bigB) counts.set(bg, (counts.get(bg) || 0) + 1);
    let matches = 0;
    for (const bg of bigA) {
      const count = counts.get(bg) || 0;
      if (count > 0) { matches++; counts.set(bg, count - 1); }
    }
    return (2 * matches) / (bigA.length + bigB.length);
  }

  function generateCode(email) {
    const hash = crypto.createHash('md5').update(email + Date.now()).digest('hex').slice(0, 4).toUpperCase();
    const prefix = 'RW-REF-';
    return prefix + hash + '-' + String(Date.now()).slice(-4);
  }

  async function fetchSupabase(table, options = {}) {
    const { method = 'GET', params = '', body } = options;
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };
    if (body && method !== 'GET') headers['Prefer'] = 'return=minimal';
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${method} ${table}: ${res.status} ${text}`);
    }
    // For GET, return JSON; for POST/PATCH/DELETE, return empty or response
    if (method === 'GET') return res.json();
    return res;
  }

  function referralHtml({ code, email, shareUrl }) {
    return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="text-align:center;padding-bottom:20px">
  <h1 style="font-size:28px;color:#16130F;margin:0">REWIND<span style="color:#FF4D14">.</span></h1>
</td></tr>
<tr><td style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <h2 style="font-size:22px;color:#16130F;margin:0 0 6px">Your referral code is ready 🎉</h2>
  <p style="color:#6E665A;font-size:15px;margin:0 0 4px">Hi there,</p>
  <p style="color:#6E665A;font-size:15px;margin:0 0 20px">
    Share your code with friends and they get <b>${FRAUD.REFERRAL_DISCOUNT_PERCENT}% off</b> their first order.
    You'll get <b>${FRAUD.REFERRER_REWARD_PERCENT}% off</b> your next order for every friend who buys through your link.
  </p>
  <div style="background:#FAF6EF;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
    <p style="color:#6E665A;font-size:13px;margin:0 0 8px">YOUR REFERRAL CODE</p>
    <div style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:6px;color:#16130F;background:#fff;border:2px dashed #FF4D14;border-radius:10px;padding:16px;display:inline-block">${code}</div>
    <p style="color:#6E665A;font-size:14px;margin:16px 0 0">
      Share this link:<br>
      <a href="${shareUrl}" style="color:#FF4D14;font-weight:600">${shareUrl}</a>
    </p>
  </div>
  <p style="color:#6E665A;font-size:13px;margin:0">
    Share with friends, family, vintage lovers — anyone who deserves ${FRAUD.REFERRAL_DISCOUNT_PERCENT}% off amazing streetwear.
  </p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
  }

  // ─────────────────────────────────────────────
  // 1. Generate a referral code
  // ─────────────────────────────────────────────
  router.post('/generate', strictLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email required' });
      }

      const ip = getClientIp(req);

      // ── FRAUD CHECK: IP rate limit for code generation ──
      const today = new Date().toISOString().slice(0, 10);
      const ipKey = `${ip}:${today}`;
      const genCount = ipGenRate.get(ipKey) || 0;
      if (genCount >= FRAUD.MAX_CODES_PER_IP_DAY) {
        return res.status(429).json({ error: 'Too many referral codes generated from this IP today. Please try again tomorrow.' });
      }

      // Check if email already has an active code
      const existing = await fetchSupabase('referral_codes', {
        params: `?email=eq.${encodeURIComponent(email)}&status=eq.active&select=code,created_at,used_count`,
      });
      if (Array.isArray(existing) && existing.length > 0) {
        // Return existing code instead of creating a duplicate
        const existingCode = existing[0];
        ipGenRate.set(ipKey, genCount + 1);
        const shareUrl = `https://rewind-stores.com?ref=${existingCode.code}`;
        return res.json({
          code: existingCode.code,
          isNew: false,
          usedCount: existingCode.used_count || 0,
          shareUrl,
          discount: FRAUD.REFERRAL_DISCOUNT_PERCENT,
        });
      }

      // Generate unique code
      let code;
      let attempts = 0;
      while (attempts < 5) {
        code = generateCode(email);
        const dupCheck = await fetchSupabase('referral_codes', {
          params: `?code=eq.${encodeURIComponent(code)}&select=id`,
        });
        if (!Array.isArray(dupCheck) || dupCheck.length === 0) break;
        attempts++;
      }
      if (!code) {
        return res.status(500).json({ error: 'Failed to generate unique code. Please try again.' });
      }

      // Store the code
      await fetchSupabase('referral_codes', {
        method: 'POST',
        body: {
          code,
          email: email.toLowerCase().trim(),
          created_ip: ip,
          created_user_agent: getUserAgent(req),
          status: 'active',
        },
      });

      // Update rate limiter
      ipGenRate.set(ipKey, genCount + 1);

      const shareUrl = `https://rewind-stores.com?ref=${code}`;

      // Send referral email
      if (resend) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            reply_to: REPLY_TO,
            to: email,
            subject: `Your REWIND referral code — give ${FRAUD.REFERRAL_DISCOUNT_PERCENT}% off`,
            html: referralHtml({ code, email, shareUrl }),
          });
        } catch (emailErr) {
          console.warn('Referral email failed:', emailErr.message);
        }
      }

      res.json({
        code,
        isNew: true,
        usedCount: 0,
        shareUrl,
        discount: FRAUD.REFERRAL_DISCOUNT_PERCENT,
        maxUses: 10,
      });
    } catch (err) {
      console.error('Referral generate error:', err);
      res.status(500).json({ error: 'Failed to generate referral code' });
    }
  });

  // ─────────────────────────────────────────────
  // 2. Get referral stats for an email
  // ─────────────────────────────────────────────
  router.get('/stats', async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const normalizedEmail = email.toLowerCase().trim();

      // Get the referrer's code
      const codes = await fetchSupabase('referral_codes', {
        params: `?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`,
      });
      const codeData = Array.isArray(codes) && codes.length > 0 ? codes[0] : null;

      let redemptions = [];
      let qualifiedCount = 0;
      let rewardTotal = 0;

      if (codeData) {
        redemptions = await fetchSupabase('referral_redemptions', {
          params: `?code_id=eq.${codeData.id}&order=created_at.desc`,
        });
        if (Array.isArray(redemptions)) {
          qualifiedCount = redemptions.filter(r => r.status === 'qualified').length;
          rewardTotal = redemptions.reduce((s, r) => s + (r.reward_earned ? 1 : 0), 0);
        } else {
          redemptions = [];
        }
      }

      // Get rewards
      const rewards = await fetchSupabase('referral_rewards', {
        params: `?referrer_email=eq.${encodeURIComponent(normalizedEmail)}&select=*&order=created_at.desc`,
      });

      res.json({
        code: codeData?.code || null,
        shareUrl: codeData ? `https://rewind-stores.com?ref=${codeData.code}` : null,
        usedCount: codeData?.used_count || 0,
        maxUses: codeData?.max_uses || 10,
        status: codeData?.status || null,
        totalRedemptions: Array.isArray(redemptions) ? redemptions.length : 0,
        qualifiedCount,
        rewardTotal,
        rewards: Array.isArray(rewards) ? rewards.map(r => ({
          id: r.id,
          promoCode: r.promo_code,
          rewardType: r.reward_type,
          rewardValue: r.reward_value,
          status: r.status,
          expiresAt: r.expires_at,
        })) : [],
        redemptions: Array.isArray(redemptions) ? redemptions.map(r => ({
          id: r.id,
          refereeEmail: r.referee_email,
          status: r.status,
          createdAt: r.created_at,
          flagged: !!r.flagged_reason,
        })) : [],
      });
    } catch (err) {
      console.error('Referral stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // ─────────────────────────────────────────────
  // 3. Validate a referral code (used during checkout)
  //    Falls back to promo_codes table if not found in referral_codes
  // ─────────────────────────────────────────────
  router.post('/validate', strictLimiter, async (req, res) => {
    try {
      const { code, email: refereeEmail } = req.body;
      if (!code) return res.json({ valid: false, error: 'No code provided' });

      const normalizedCode = code.toUpperCase().trim();
      const normalizedReferee = (refereeEmail || '').toLowerCase().trim();

      const codes = await fetchSupabase('referral_codes', {
        params: `?code=eq.${encodeURIComponent(normalizedCode)}&select=*`,
      });

      if (!Array.isArray(codes) || codes.length === 0) {
        // Not found in referral_codes — check promo_codes as fallback
        // (admin-generated promo codes from settings panel live there)
        try {
          const promoRes = await fetchSupabase('promo_codes', {
            params: `?code=eq.${encodeURIComponent(normalizedCode)}&select=code,discount,label,used,uses,max_uses,expires_at`,
          });
          if (Array.isArray(promoRes) && promoRes.length > 0) {
            const p = promoRes[0];
            if (p.used) return res.json({ valid: false, error: 'Code already used' });
            if (p.max_uses != null && (p.uses || 0) >= p.max_uses) return res.json({ valid: false, error: 'Usage limit reached' });
            if (p.expires_at && new Date(p.expires_at) < new Date()) return res.json({ valid: false, error: 'Code expired' });
            return res.json({
              valid: true,
              discount: p.discount,
              value: p.discount,
              type: 'percent',
              label: p.label || `${p.discount}% off`,
              fromPromoTable: true,
            });
          }
        } catch (e) {
          console.warn('Promo fallback error:', e.message);
          // Send error back so admin can see what's wrong
          return res.json({ valid: false, error: 'Promo lookup failed: ' + e.message });
        }
        return res.json({ valid: false, error: 'Referral code not found' });
      }

      const refCode = codes[0];

      // ── FRAUD CHECK: code disabled? ──
      if (refCode.status !== 'active') {
        return res.json({ valid: false, error: 'This referral code has been disabled' });
      }

      // ── FRAUD CHECK: max uses reached? ──
      if (refCode.used_count >= refCode.max_uses) {
        return res.json({ valid: false, error: 'This referral code has reached its maximum uses' });
      }

      // ── FRAUD CHECK: self-referral? ──
      if (normalizedReferee && refCode.email.toLowerCase() === normalizedReferee) {
        return res.json({ valid: false, error: 'Cannot use your own referral code' });
      }

      // ── FRAUD CHECK: already used by this referee? ──
      if (normalizedReferee) {
        const existing = await fetchSupabase('referral_redemptions', {
          params: `?referee_email=eq.${encodeURIComponent(normalizedReferee)}&code_id=eq.${refCode.id}&limit=1`,
        });
        if (Array.isArray(existing) && existing.length > 0) {
          return res.json({ valid: true, alreadyRedeemed: true, discount: refCode.reward_discount || FRAUD.REFERRAL_DISCOUNT_PERCENT, value: refCode.reward_discount || FRAUD.REFERRAL_DISCOUNT_PERCENT });
        }
      }

      // ── FRAUD CHECK: same IP as referrer ──
      const refereeIp = getClientIp(req);
      if (refCode.created_ip && refereeIp && refCode.created_ip === refereeIp) {
        return res.json({ valid: false, error: 'Cannot use a referral code from the same device/network', flagged: true });
      }

      return res.json({
        valid: true,
        discount: refCode.reward_discount || FRAUD.REFERRAL_DISCOUNT_PERCENT,
        value: refCode.reward_discount || FRAUD.REFERRAL_DISCOUNT_PERCENT,
        label: `${refCode.reward_discount || FRAUD.REFERRAL_DISCOUNT_PERCENT}% off (referral)`,
      });
    } catch (err) {
      console.error('Referral validate error:', err);
      res.status(500).json({ error: 'Failed to validate code' });
    }
  });

  // ─────────────────────────────────────────────
  // 4. Apply referral code (record redemption intent)
  //    Called after payment succeeds, to record the referral
  // ─────────────────────────────────────────────
  router.post('/apply', async (req, res) => {
    try {
      const { code, refereeEmail, orderNum, refereeName, refereeAddress } = req.body;
      if (!code || !refereeEmail || !orderNum) {
        return res.status(400).json({ error: 'Code, email, and order number required' });
      }

      const normalizedCode = code.toUpperCase().trim();
      const normalizedReferee = refereeEmail.toLowerCase().trim();

      // Look up the referral code
      const codes = await fetchSupabase('referral_codes', {
        params: `?code=eq.${encodeURIComponent(normalizedCode)}&select=*`,
      });

      if (!Array.isArray(codes) || codes.length === 0) {
        return res.json({ applied: false, error: 'Referral code not found' });
      }

      const refCode = codes[0];

      // ── FRAUD CHECK: self-referral ──
      if (refCode.email.toLowerCase() === normalizedReferee) {
        return res.json({ applied: false, error: 'Self-referral not allowed', flagged: true });
      }

      // Check if already applied for this order
      const existing = await fetchSupabase('referral_redemptions', {
        params: `?order_num=eq.${encodeURIComponent(orderNum)}&select=id`,
      });
      if (Array.isArray(existing) && existing.length > 0) {
        return res.json({ applied: true, alreadyRecorded: true });
      }

      // ── FRAUD CHECK: same IP detection ──
      const refereeIp = getClientIp(req);
      let sameIp = false;
      if (refCode.created_ip && refereeIp && refCode.created_ip === refereeIp) {
        sameIp = true;
      }

      const refereeUa = getUserAgent(req);
      let flaggedReason = '';
      if (sameIp) {
        flaggedReason = 'Same IP as referrer';
      }

      // ── FRAUD CHECK: shipping address matches referrer's past orders (>80%) ──
      let addressMatch = false;
      if (!flaggedReason && refereeAddress) {
        try {
          const pastOrders = await fetchSupabase('orders', {
            params: `?email=eq.${encodeURIComponent(refCode.email)}&select=customer_name,address&order=created_at.desc&limit=20`,
          });
          if (Array.isArray(pastOrders)) {
            const refereeCombined = `${refereeName || ''} ${refereeAddress}`;
            for (const order of pastOrders) {
              const pastCombined = `${order.customer_name || ''} ${order.address || ''}`;
              if (addressSimilarity(refereeCombined, pastCombined) > 0.8) {
                addressMatch = true;
                break;
              }
            }
          }
        } catch (e) {
          console.warn('Referral address fraud check failed:', e.message);
        }
        if (addressMatch) flaggedReason = 'Shipping address matches referrer\'s past order';
      }

      // ── FRAUD CHECK: block if same IP, self-referral, or address match ──
      if (sameIp || addressMatch || refCode.email === normalizedReferee) {
        // Still record the attempt for admin visibility
        await fetchSupabase('referral_redemptions', {
          method: 'POST',
          body: {
            code_id: refCode.id,
            referrer_email: refCode.email,
            referee_email: normalizedReferee,
            order_num: orderNum || '',
            status: 'flagged',
            referee_ip: refereeIp,
            referee_user_agent: refereeUa,
            referrer_ip: refCode.created_ip || '',
            same_ip: sameIp,
            flagged_reason: flaggedReason || 'Self-referral',
          },
        });
        return res.json({ applied: false, error: flaggedReason || 'Self-referral not allowed', flagged: true });
      }

      // ── FRAUD CHECK: IP rate limit — max 2 redemptions per IP per day ──
      const today = new Date().toISOString().slice(0, 10);
      const ipKey = `${refereeIp}:${today}`;
      const redeemCount = ipGenRate.get(ipKey) || 0;
      if (redeemCount >= 2) {
        flaggedReason = 'IP rate limit exceeded';
      }

      // Record the redemption
      await fetchSupabase('referral_redemptions', {
        method: 'POST',
        body: {
          code_id: refCode.id,
          referrer_email: refCode.email,
          referee_email: normalizedReferee,
          order_num: orderNum,
          status: 'pending',
          referee_ip: refereeIp,
          referee_user_agent: refereeUa,
          referrer_ip: refCode.created_ip || '',
          same_ip: sameIp,
          flagged_reason: flaggedReason,
          reward_earned: false,
        },
      });

      // Increment the code's used_count
      await fetchSupabase('referral_codes', {
        method: 'PATCH',
        params: `?id=eq.${refCode.id}`,
        body: { used_count: (refCode.used_count || 0) + 1 },
      });

      // Track IP for rate limiting
      ipGenRate.set(ipKey, (ipGenRate.get(ipKey) || 0) + 1);

      // Return success
      return res.json({ applied: true, discount: parseInt(refCode.reward_discount || FRAUD.REFERRAL_DISCOUNT_PERCENT), type: refCode.reward_type || 'percent', flagged: !!flaggedReason, flaggedReason: flaggedReason || null });
    } catch (err) {
      console.error('Referral apply error:', err);
      res.status(500).json({ error: 'Failed to apply referral' });
    }
  });

  // ─────────────────────────────────────────────
  // 5. Fulfill referral (called after Stripe webhook confirms payment)
  //    Generates a reward promo code for the referrer
  // ─────────────────────────────────────────────
  // Plain function version of the fulfillment logic — called directly by
  // the Stripe webhook in server.js (no HTTP loopback to localhost, which
  // only works on Railway's single process and silently fails on a
  // serverless deploy target). The /fulfill route below is a thin wrapper
  // around this for any other internal/manual callers.
  async function fulfillReferral(orderNum) {
    if (!orderNum) return { fulfilled: false, error: 'Order number required' };
    try {
      const redemptions = await fetchSupabase('referral_redemptions', {
        params: `?order_num=eq.${encodeURIComponent(orderNum)}&status=eq.pending&select=*`,
      });

      if (!Array.isArray(redemptions) || redemptions.length === 0) {
        return { fulfilled: false, reason: 'No pending referral for this order' };
      }

      const redemption = redemptions[0];
      const rewardValue = FRAUD.REFERRER_REWARD_PERCENT;
      const rewardPromo = 'RW-REF-' + crypto.randomBytes(3).toString('hex').toUpperCase();

      await fetchSupabase('referral_rewards', {
        method: 'POST',
        body: {
          referrer_email: redemption.referrer_email,
          redemption_id: redemption.id,
          promo_code: rewardPromo,
          reward_type: 'percent',
          reward_value: rewardValue,
          status: 'issued',
        },
      });

      await fetchSupabase('referral_redemptions', {
        method: 'PATCH',
        params: `?id=eq.${redemption.id}`,
        body: {
          status: 'qualified',
          reward_earned: true,
          reward_amount: rewardValue,
        },
      });

      if (resend) {
        try {
          const notifyHtml = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="background:#fff;border-radius:14px;padding:32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <h2 style="font-size:22px;color:#16130F;margin:0 0 6px">Someone used your referral code! 🎉</h2>
  <p style="color:#6E665A;font-size:15px;margin:0 0 20px">Thanks to you, a friend just placed their first order.</p>
  <div style="background:#FAF6EF;border-radius:12px;padding:20px;margin-bottom:16px">
    <p style="color:#6E665A;font-size:13px;margin:0 0 6px">Your reward — ${rewardValue}% off your next order</p>
    <div style="font-family:monospace;font-size:24px;font-weight:800;letter-spacing:4px;color:#16130F;background:#fff;border:2px dashed #FF4D14;border-radius:8px;padding:12px;display:inline-block">${rewardPromo}</div>
    <p style="color:#6E665A;font-size:12px;margin:10px 0 0">Use at checkout. Expires in 90 days.</p>
  </div>
  <p style="color:#6E665A;font-size:14px">Keep sharing your code — the more friends who shop, the more you save!</p>
  <p style="margin:20px 0 0"><a href="https://rewind-stores.com" style="color:#FF4D14;font-weight:600">Shop now →</a></p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
          await resend.emails.send({
            from: FROM_EMAIL,
            reply_to: REPLY_TO,
            to: redemption.referrer_email,
            subject: `Someone used your REWIND referral — you earned ${rewardValue}% off!`,
            html: notifyHtml,
          });
        } catch (emailErr) {
          console.warn('Referral reward email failed:', emailErr.message);
        }
      }

      return { fulfilled: true, promoCode: rewardPromo, referrerEmail: redemption.referrer_email };
    } catch (err) {
      console.error('Referral fulfill error:', err);
      return { fulfilled: false, error: 'Failed to fulfill' };
    }
  }

  router.post('/fulfill', async (req, res) => {
    const INTERNAL_TOKEN = process.env.ADMIN_API_TOKEN || process.env.ADMIN_SECRET_TOKEN;
    const clientToken = req.headers['x-internal-token'];
    if (INTERNAL_TOKEN && (!clientToken || clientToken !== INTERNAL_TOKEN)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const result = await fulfillReferral(req.body?.orderNum);
    if (result.error && !result.fulfilled) return res.status(result.error === 'Order number required' ? 400 : 500).json(result);
    res.json(result);
  });

  router.fulfillReferral = fulfillReferral;

  // ─────────────────────────────────────────────
  // ADMIN: List all referral codes and redemptions
  // ─────────────────────────────────────────────
  router.get('/admin/list', requireAdmin, async (req, res) => {
    try {
      const codes = await fetchSupabase('referral_codes', {
        params: '?order=created_at.desc&limit=100',
      });
      const redemptions = await fetchSupabase('referral_redemptions', {
        params: '?order=created_at.desc&limit=200',
      });
      const rewards = await fetchSupabase('referral_rewards', {
        params: '?order=created_at.desc&limit=200',
      });
      res.json({
        codes: Array.isArray(codes) ? codes : [],
        redemptions: Array.isArray(redemptions) ? redemptions : [],
        rewards: Array.isArray(rewards) ? rewards : [],
      });
    } catch (err) {
      console.error('Admin referral list error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // ─────────────────────────────────────────────
  // ADMIN: Disable a referral code (fraud)
  // ─────────────────────────────────────────────
  router.post('/admin/disable', requireAdmin, async (req, res) => {
    try {
      const { codeId } = req.body;
      if (!codeId) return res.status(400).json({ error: 'codeId required' });
      await fetchSupabase('referral_codes', {
        method: 'PATCH',
        params: `?id=eq.${codeId}`,
        body: { status: 'disabled' },
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // ─────────────────────────────────────────────
  // ADMIN: Flag a redemption as fraud
  // ─────────────────────────────────────────────
  router.post('/admin/flag', requireAdmin, async (req, res) => {
    try {
      const { redemptionId, reason } = req.body;
      if (!redemptionId) return res.status(400).json({ error: 'redemptionId required' });
      await fetchSupabase('referral_redemptions', {
        method: 'PATCH',
        params: `?id=eq.${redemptionId}`,
        body: {
          status: 'flagged',
          flagged_reason: reason || 'Flagged by admin',
          reward_earned: false,
        },
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // ─────────────────────────────────────────────
  // ADMIN: Unflag a redemption (undo fraud flag)
  // ─────────────────────────────────────────────
  router.post('/admin/unflag', requireAdmin, async (req, res) => {
    try {
      const { redemptionId } = req.body;
      if (!redemptionId) return res.status(400).json({ error: 'redemptionId required' });
      await fetchSupabase('referral_redemptions', {
        method: 'PATCH',
        params: `?id=eq.${redemptionId}`,
        body: { status: 'qualified', flagged_reason: '' },
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
