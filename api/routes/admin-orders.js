// Admin orders routes — cancel, undo, list, update status, test order, ship
// Mounted AFTER the blanket requireAdmin middleware in server.js

export function registerAdminOrdersRoutes({ app, SUPABASE_URL, resend, FROM_EMAIL, REPLY_TO, escapeHtml, auditLog, getAdminEmailFromToken, requireAdmin }) {

  // ── Admin: cancel order ──
  app.post('/api/admin/cancel-order', async (req, res) => {
    const { orderId, reason, customReason } = req.body;
    if (!orderId || !reason) return res.status(400).json({ error: 'orderId and reason required' });
    try {
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!r.ok) {
        const errBody = await r.text();
        console.error('Supabase PATCH failed:', errBody);
        return res.status(500).json({ error: 'Failed to update order in database. Check server logs.' });
      }
      const orderData = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      }).then(r => r.json());
      const order = Array.isArray(orderData) ? orderData[0] : null;
      if (order?.email && resend) {
        const reasonLabels = { out_of_stock: 'Out of stock', damaged: 'Damaged during handling', customer_request: 'Customer requested cancellation', other: 'Other' };
        let emailBody = '';
        const reasonText = reason === 'other' && customReason ? customReason : (reasonLabels[reason] || reason);
        const escapedName = escapeHtml(order.customer_name || 'there');
        const cannedEmails = {
          out_of_stock: `Hi ${escapedName},\n\nWe regret to inform you that your recent REWIND order has been cancelled due to the item being out of stock. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
          damaged: `Hi ${escapedName},\n\nWe regret to inform you that your recent REWIND order has been cancelled because the item was damaged during handling. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
          customer_request: `Hi ${escapedName},\n\nAs requested, your recent REWIND order has been cancelled. A full refund has been initiated and will appear in your account within 5-10 business days. If you have any questions, reply to this email or contact us at orders@rewind-stores.com.\n\n— REWIND team`,
        };
        if (reason !== 'other' && cannedEmails[reason]) {
          emailBody = cannedEmails[reason];
        } else {
          try {
            const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Write a cancellation email for a REWIND vintage streetwear order. The customer's name is ${order.customer_name || 'there'}. The reason is: "${reasonText}". Use this exact structure:\n\n1. Greeting: "Hi [customer name],"\n2. One sentence stating the cancellation and the specific reason\n3. "A full refund has been initiated and will appear in your account within 5-10 business days."\n4. "If you have any questions, reply to this email or contact us at orders@rewind-stores.com."\n5. Sign-off: "— REWIND team"\n\nKeep it concise and professional. No slang, no emoji, no exclamation marks. Max 5 short sentences. No subject line.` }] }],
                generationConfig: { maxOutputTokens: 2000 },
              }),
            });
            const aiData = await aiRes.json();
            emailBody = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } catch {}
        }
        if (!emailBody) {
          const fallbacks = {
            out_of_stock: "Unfortunately, the item you ordered is out of stock and we're unable to fulfill it.",
            damaged: "Unfortunately, the item was damaged during handling and we cannot send it out.",
            customer_request: "You requested cancellation of this order.",
            other: "Your order has been cancelled as requested.",
          };
          emailBody = fallbacks[reason] || 'Your order has been cancelled.';
          if (reason === 'other' && customReason) emailBody = customReason;
        }
        await resend.emails.send({
          from: FROM_EMAIL, reply_to: REPLY_TO, to: order.email,
          subject: `Order ${order.order_num} cancelled — refund initiated`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#FAF6EF">
            <img src="https://rewind-stores.com/rewind-logo.svg" width="120" height="120" alt="REWIND" style="display:block;border:none;outline:none" />
            <div style="background:#fff;border-radius:14px;padding:32px;margin-top:20px">
              <h2 style="font-size:20px;color:#16130F;margin:0 0 8px">Order cancelled</h2>
              <p style="color:#6E665A;font-size:15px;line-height:1.6">Hi ${escapeHtml(order.customer_name || 'there')},</p>
              <p style="color:#6E665A;font-size:15px;line-height:1.6">
                ${emailBody}<br/><br/>
                <b>Reason:</b> ${reasonText}<br/><br/>
                If you have any questions, reply to this email or contact us at orders@rewind-stores.com.
              </p>
              <p style="color:#6E665A;font-size:14px;margin-top:20px">— REWIND team</p>
            </div>
          </div>`,
        });
      }
      auditLog(getAdminEmailFromToken(req), 'cancel_order', req.body.orderNum || orderId, req.ip);
      res.json({ ok: true });
    } catch (err) {
      console.error('Cancel order error:', err);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // ── Admin: undo cancellation (revert to pending) ──
  app.post('/api/admin/undo-cancel-order', async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    try {
      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      if (!r.ok) return res.status(500).json({ error: 'Failed to undo' });
      res.json({ ok: true });
    } catch (err) {
      console.error('Undo cancel error:', err);
      res.status(500).json({ error: 'Failed to undo cancellation' });
    }
  });

  // ── Admin: get all orders ──
  app.get('/api/admin/orders', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const offset = parseInt(req.query.offset) || 0;
      const [ordersRes, countRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/orders?order=created_at.desc&limit=${limit}&offset=${offset}&select=id,order_num,email,customer_name,total,status,items,created_at`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        }),
        fetch(`${SUPABASE_URL}/rest/v1/orders?select=count`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        }),
      ]);
      const orders = await ordersRes.json();
      const countArr = await countRes.json();
      const count = Array.isArray(countArr) ? (countArr[0]?.count || 0) : 0;
      res.json({ orders: orders || [], total: count, limit, offset });
    } catch { res.json({ orders: [], total: 0 }); }
  });

  // ── Admin: update order status + send step email ──
  app.post('/api/admin/orders/update-status', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id and status required' });
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      await fetch(SUPABASE_URL + '/rest/v1/orders?id=eq.' + id, {
        method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      // Send step email if applicable
      const stepEmails = {
        shipped: { subject: 'Your REWIND order has shipped', body: 'Your order has been shipped and is on its way. Estimated delivery: <b>10–30 days</b> depending on your location and customs processing.' },
        handed_courier: { subject: 'Your REWIND order has been handed to the courier', body: 'Your order has been handed over to the international courier and is now in transit.' },
        cleared_customs: { subject: 'Your REWIND order has cleared customs', body: 'Your order has cleared customs in your country and will be handed over to your local courier shortly.' },
        local_courier: { subject: 'Your REWIND order is with your local courier', bodyFn: (order, courierName) => courierName
          ? `Your order has been handed over to <b>${escapeHtml(courierName)}</b> for final delivery. Expect delivery within the next few days.`
          : 'Your order has been handed over to your local courier for final delivery. Expect delivery within the next few days.' },
        delivered: { subject: 'Your REWIND order has been delivered', body: 'Your order has been delivered. We hope you love it! If you have any questions, reply to this email or contact us at orders@rewind-stores.com.' },
      };
      const step = stepEmails[status];
      if (step) {
        const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${id}&select=*`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        });
        const orderData = await orderRes.json();
        const order = Array.isArray(orderData) ? orderData[0] : null;
        const bodyText = step.bodyFn ? step.bodyFn(order, req.body?.courier_name) : step.body;
        if (order?.email && resend) {
          await resend.emails.send({
            from: FROM_EMAIL, reply_to: REPLY_TO, to: order.email,
            subject: `${step.subject} — ${order.order_num}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#FAF6EF">
              <img src="https://rewind-stores.com/rewind-logo.svg" width="120" height="120" alt="REWIND" style="display:block;border:none;outline:none" />
              <div style="background:#fff;border-radius:14px;padding:32px;margin-top:20px">
                <h2 style="font-size:20px;color:#16130F;margin:0 0 8px">${step.subject}</h2>
                <p style="color:#6E665A;font-size:15px;line-height:1.6">Hi ${escapeHtml(order.customer_name || 'there')},</p>
                <p style="color:#6E665A;font-size:15px;line-height:1.6">Order <b>${escapeHtml(order.order_num)}</b></p>
                <p style="color:#6E665A;font-size:15px;line-height:1.6">${step.body}</p>
                <p style="color:#6E665A;font-size:14px;margin-top:20px">— REWIND team</p>
              </div></div>`,
          });
          auditLog(getAdminEmailFromToken(req), `status_${status}`, order.order_num, req.ip);
        }
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('Update status error:', e);
      res.status(500).json({ error: 'Operation failed' });
    }
  });

  // ── Admin: mark order as shipped + send notification email ──
  app.post('/api/admin/orders/ship', async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shipped', updated_at: new Date().toISOString() }),
      });
      if (!updateRes.ok) return res.status(500).json({ error: 'Failed to update order' });
      const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const orderData = await orderRes.json();
      const order = Array.isArray(orderData) ? orderData[0] : null;
      if (order?.email && resend) {
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
        const itemsList = items.map(it => `${it.name || ''} ${it.size ? '(' + it.size + ')' : ''}`).filter(Boolean).join(', ');
        await resend.emails.send({
          from: FROM_EMAIL, reply_to: REPLY_TO, to: order.email,
          subject: `Your REWIND order has shipped — ${order.order_num}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#FAF6EF">
            <img src="https://rewind-stores.com/rewind-logo.svg" width="120" height="120" alt="REWIND" style="display:block;border:none;outline:none" />
            <div style="background:#fff;border-radius:14px;padding:32px;margin-top:20px">
              <h2 style="font-size:20px;color:#16130F;margin:0 0 8px">Your order is on the way! 📦</h2>
              <p style="color:#6E665A;font-size:15px">Hi ${escapeHtml(order.customer_name || 'there')},</p>
              <p style="color:#6E665A;font-size:15px">Order <b>${escapeHtml(order.order_num)}</b> has been shipped and is on its way to you.</p>
              <p style="color:#6E665A;font-size:15px">Estimated delivery: <b>10–30 days</b> depending on your location and customs processing.</p>
              ${itemsList ? `<p style="color:#6E665A;font-size:14px"><b>Items:</b> ${escapeHtml(itemsList)}</p>` : ''}
              <p style="color:#6E665A;font-size:14px;margin-top:16px">If you have any questions, reply to this email or contact us at orders@rewind-stores.com. Thank you for shopping at REWIND.</p>
            </div></div>`,
        });
      }
      auditLog(getAdminEmailFromToken(req), 'ship_order', `${order?.order_num || id}`, req.ip);
      res.json({ ok: true });
    } catch (e) {
      console.error('Ship order error:', e);
      res.status(500).json({ error: 'Failed to ship order' });
    }
  });

  // ── Create test order for debugging ──
  app.post('/api/debug/create-test-order', requireAdmin, async (req, res) => {
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY || !SUPABASE_URL) return res.status(500).json({ error: 'Supabase not configured' });
    try {
      const orderNum = 'RW-TEST-' + Date.now().toString(36).toUpperCase();
      const email = req.body?.email || 'test@rewind-stores.com';
      const supRes = await fetch(SUPABASE_URL + '/rest/v1/orders', {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          order_num: orderNum,
          email,
          customer_name: 'Test Customer',
          address: '123 Test Street, Test City',
          items: JSON.stringify([{ name: 'Test Product', price: 50, qty: 1 }]),
          total: 50,
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
      });
      if (!supRes.ok) {
        const errText = await supRes.text().catch(() => '');
        return res.status(500).json({ error: 'Supabase error: ' + (errText || supRes.statusText) });
      }
      console.log('Test order created in Supabase:', orderNum, 'for', email);
      res.json({ ok: true, orderNum });
    } catch (e) {
      console.error('Test order error:', e.message);
      res.status(500).json({ error: 'Test order failed: ' + e.message });
    }
  });
}
