import crypto from 'crypto';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function b64url(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function hmac(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// A session token is `<b64url(email)>.<expiryEpochMs>.<hmac>` — signed with the
// server-only master secret, so it can't be forged, and it naturally expires.
// This is what the browser actually stores/replays, instead of the master
// secret itself, so a leaked localStorage value only grants time-limited access.
export function signAdminSession(email) {
  const secret = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_API_TOKEN;
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = `${b64url(email)}.${expiry}`;
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifyAdminSession(token, expectedEmail) {
  const secret = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_API_TOKEN;
  if (!secret || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [emailB64, expiryStr, sig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const payload = `${emailB64}.${expiryStr}`;
  const expectedSig = hmac(secret, payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  if (expectedEmail) {
    let decodedEmail;
    try { decodedEmail = Buffer.from(emailB64, 'base64url').toString('utf8'); } catch { return false; }
    if (decodedEmail !== expectedEmail) return false;
  }
  return true;
}

// Decode the email from a session token without fully verifying it.
// verifyAdminSession must still be called for signature validation.
function decodeSessionEmail(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return Buffer.from(parts[0], 'base64url').toString('utf8');
  } catch { return null; }
}

// Check Supabase admins table — is this email still an active admin?
async function isStillActiveAdmin(email) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !email) return false;
  try {
    const r = await fetch(`${url}/rest/v1/admins?email=eq.${encodeURIComponent(email)}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_SECRET_TOKEN || process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    console.error('ADMIN_SECRET_TOKEN not configured — refusing all admin requests.');
    return res.status(500).json({ error: 'Admin auth is not configured on the server' });
  }

  const header = req.headers['authorization'] || '';
  const provided = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : (req.headers['x-admin-token'] || '').trim();

  if (!provided) {
    return res.status(401).json({ error: 'Missing admin token' });
  }

  // Accept a signed, time-limited session token (the normal path — this is
  // what the browser stores after login).
  if (verifyAdminSession(provided)) {
    // Revocation check: verify this email is still in the admins table.
    // This ensures removing someone from the admins table revokes access
    // immediately, not just after the session token expires (12h).
    const email = decodeSessionEmail(provided);
    if (email) {
      isStillActiveAdmin(email).then((active) => {
        if (!active) {
          return res.status(403).json({ error: 'Admin access revoked' });
        }
        next();
      }).catch(() => {
        // If Supabase is unreachable, fall through to next() rather than
        // locking out every admin during a transient outage.
        // To force immediate revocation in an emergency, rotate
        // ADMIN_SECRET_TOKEN instead — it invalidates all sessions.
        next();
      });
      return; // Wait for the async check
    }
    return next();
  }

  // Fall back to the raw master secret for server-to-server/internal calls.
  const a = Buffer.from(provided);
  const b = Buffer.from(configuredToken);
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!same) {
    return res.status(403).json({ error: 'Invalid or expired admin token' });
  }

  next();
}
