import crypto from 'crypto';

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

  const a = Buffer.from(provided);
  const b = Buffer.from(configuredToken);

  const same = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!same) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
}
