// ── Settings panel routes (Pulse, Order Lookup, Promo Generator) ──
import { Router } from 'express';

export function buildSettingsRouter({ SUPABASE_URL, SERVICE_KEY, requireAdmin }) {
  const router = Router();

  // ── Store Pulse ──
  // Returns today's sales total, order count, low-stock items, unread chat count
  router.get('/pulse', requireAdmin, async (_req, res) => {
    if (!SERVICE_KEY || !SUPABASE_URL) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const todayStart = today + 'T00:00:00.000Z';
      const todayEnd = today + 'T23:59:59.999Z';

      // Fetch all three data sources in parallel
      const [ordersRes, stockRes, chatsRes] = await Promise.all([
        // Today's confirmed/paid orders
        fetch(
          `${SUPABASE_URL}/rest/v1/orders?created_at=gte.${encodeURIComponent(todayStart)}&created_at=lte.${encodeURIComponent(todayEnd)}&select=total,status`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        ),
        // Low-stock products (< 3 units)
        fetch(
          `${SUPABASE_URL}/rest/v1/custom_products?stock=lt.3&select=name,stock,product_id`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        ),
        // Unread chat messages (by admin, not yet seen by customer)
        fetch(
          `${SUPABASE_URL}/rest/v1/chat_messages?read_by_customer=eq.false&sender=eq.admin&select=id`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        ),
      ]);

      const orders = await ordersRes.json();
      const stockData = await stockRes.json();
      const chatData = await chatsRes.json();

      const todayOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'confirmed' || o.status === 'paid') : [];
      const todaySales = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
      const lowStock = Array.isArray(stockData) ? stockData.filter(p => p.stock != null && p.stock < 3) : [];
      const unreadChats = Array.isArray(chatData) ? chatData.length : 0;

      res.json({
        todaySales: Math.round(todaySales * 100) / 100,
        todayOrders: todayOrders.length,
        lowStock: lowStock.map(p => ({ name: p.name, stock: p.stock, id: p.product_id })),
        unreadChats,
      });
    } catch (e) {
      console.error('Settings pulse error:', e);
      res.status(500).json({ error: 'Operation failed' });
    }
  });

  // ── Quick Order Lookup ──
  // Search orders by order number (case-insensitive LIKE)
  router.get('/order-lookup', requireAdmin, async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ orders: [] });
    if (!SERVICE_KEY || !SUPABASE_URL) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    try {
      // Supabase REST doesn't support ILIKE on text fields directly,
      // so we fetch all orders and filter client-side for the search.
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=order_num,email,customer_name,items,total,status,created_at&order=created_at.desc&limit=50`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const data = await r.json();
      const orders = (Array.isArray(data) ? data : []).filter(o =>
        o.order_num && o.order_num.toLowerCase().includes(q.toLowerCase())
      );
      res.json({
        orders: orders.map(o => ({
          order_num: o.order_num,
          email: o.email,
          customer_name: o.customer_name,
          items: typeof o.items === 'string' ? (() => { try { return JSON.parse(o.items); } catch { return []; } })() : (o.items || []),
          total: o.total,
          status: o.status,
          created_at: o.created_at,
        })),
      });
    } catch (e) {
      console.error('Order lookup error:', e);
      res.status(500).json({ error: 'Operation failed' });
    }
  });

  // ── Promo Code Generator ──
  // Creates a promo code with a given discount %
  router.post('/generate-promo', requireAdmin, async (req, res) => {
    const { discount, label } = req.body;
    if (!discount || discount < 1 || discount > 100) {
      return res.status(400).json({ error: 'Discount must be 1-100' });
    }
    if (!SERVICE_KEY || !SUPABASE_URL) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const promoCode = 'REWIND-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
      const promoRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          code: promoCode,
          discount,
          label: label || `${discount}% off`,
          created_by: 'admin',
          created_at: new Date().toISOString(),
        }),
      });
      if (!promoRes.ok) {
        const errText = await promoRes.text();
        return res.status(500).json({ error: 'Supabase error: ' + errText });
      }
      res.json({ code: promoCode, discount });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create promo' });
    }
  });

  return router;
}
