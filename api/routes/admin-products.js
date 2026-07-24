// Admin product CRUD routes
// Mounted AFTER the blanket requireAdmin middleware in server.js

export function registerAdminProductRoutes({ app, SUPABASE_URL, auditLog, getAdminEmailFromToken }) {

  // Only these fields may ever be written to custom_products — prevents
  // mass assignment via stray/unexpected fields in the request body.
  const ALLOWED_PRODUCT_FIELDS = ['name', 'cat', 'brand', 'price', 'was', 'stock', 'sizes', 'hue', 'note', 'img', 'imgs'];
  function pickAllowedFields(body) {
    const out = {};
    for (const key of ALLOWED_PRODUCT_FIELDS) {
      if (body[key] !== undefined) out[key] = body[key];
    }
    return out;
  }

  // ── Admin: product CRUD with input validation ──
  app.post('/api/admin/products/add', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    const { name, cat, price, stock, sizes } = req.body;
    if (!name || !cat || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'name, cat, and non-negative price are required' });
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
      return res.status(400).json({ error: 'stock must be a non-negative number' });
    }
    if (sizes !== undefined && !Array.isArray(sizes)) {
      return res.status(400).json({ error: 'sizes must be an array' });
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products`, {
        method: 'POST', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(pickAllowedFields(req.body)),
      });
      const data = await r.json();
      res.json({ ok: r.ok, data });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });

  app.post('/api/admin/products/update', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { product_id } = req.body;
    const updates = pickAllowedFields(req.body);
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/custom_products?product_id=eq.${encodeURIComponent(product_id)}`, {
        method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(updates),
      });
      const data = await r.json();
      const updated = r.ok && Array.isArray(data) && data.length > 0;
      res.json({ ok: updated, data: updated ? data[0] : null });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });

  app.post('/api/admin/products/delete', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/custom_products?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });

  app.post('/api/admin/products/upload-image', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      const { productId, imageBase64, ext } = req.body;
      if (!productId || !imageBase64) return res.status(400).json({ error: 'productId and imageBase64 required' });
      const buf = Buffer.from(imageBase64, 'base64');
      const allowed = ['jpg','jpeg','png','webp'];
      const fileExt = ext && allowed.includes(ext) ? ext : 'webp';
      const filePath = `${productId}_${Date.now()}.${fileExt}`;
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${filePath}`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
        body: buf,
      });
      if (!r.ok) return res.status(500).json({ error: 'Upload failed' });
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${filePath}`;
      res.json({ ok: true, url: publicUrl });
    } catch { res.status(500).json({ error: 'Operation failed' }); }
  });
}
