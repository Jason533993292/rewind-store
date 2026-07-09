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
