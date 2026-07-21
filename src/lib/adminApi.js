// Shared admin API client with error handling
// Every function returns { ok, data, error }

async function adminFetch(url, options = {}) {
  try {
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: data.error || `HTTP ${r.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

export const adminApi = {
  // Orders
  getOrders: (limit, offset) => adminFetch('/api/admin/orders?limit=' + (limit || 50) + '&offset=' + (offset || 0)),
  updateOrderStatus: (id, status) => adminFetch('/api/admin/orders/update-status', { method: 'POST', body: JSON.stringify({ id, status }) }),
  shipOrder: (id, trackingNumber, courier) => adminFetch('/api/admin/orders/ship', { method: 'POST', body: JSON.stringify({ id, trackingNumber, courier }) }),
  cancelOrder: (id, reason) => adminFetch('/api/admin/cancel-order', { method: 'POST', body: JSON.stringify({ id, reason }) }),
  lookupOrder: (orderNum, email) => adminFetch('/api/lookup-order', { method: 'POST', body: JSON.stringify({ orderNum, email }) }),

  // Products
  getProducts: () => adminFetch('/api/admin/custom-products'),
  addProduct: (product) => adminFetch('/api/admin/products/add', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id, updates) => adminFetch('/api/admin/products/update', { method: 'POST', body: JSON.stringify({ id, ...updates }) }),
  deleteProduct: (id) => adminFetch('/api/admin/products/delete', { method: 'POST', body: JSON.stringify({ id }) }),

  // Blocking
  blockEmail: (email, reason) => adminFetch('/api/admin/block-email', { method: 'POST', body: JSON.stringify({ email, reason }) }),
  unblockEmail: (email) => adminFetch('/api/admin/unblock-email', { method: 'POST', body: JSON.stringify({ email }) }),
  blockIp: (ip) => adminFetch('/api/admin/block-ip', { method: 'POST', body: JSON.stringify({ ip }) }),
  unblockIp: (ip) => adminFetch('/api/admin/unblock-ip', { method: 'POST', body: JSON.stringify({ ip }) }),
  getBlockedEmails: () => adminFetch('/api/admin/blocked-emails'),
  getBlockedIps: () => adminFetch('/api/admin/blocked-ips'),
  getEmailIps: () => adminFetch('/api/admin/email-ips'),

  // Promo codes
  createPromo: (data) => adminFetch('/api/admin/create-promo', { method: 'POST', body: JSON.stringify(data) }),
  validatePromo: (code) => adminFetch('/api/validate-promo', { method: 'POST', body: JSON.stringify({ code }) }),

  // Chat
  getChatSessions: () => adminFetch('/api/admin/chat/sessions'),
  getChatMessages: (sessionId) => adminFetch('/api/admin/chat/messages?session_id=' + encodeURIComponent(sessionId)),
  replyToChat: (sessionId, message) => adminFetch('/api/admin/chat/reply', { method: 'POST', body: JSON.stringify({ session_id: sessionId, message }) }),
  closeChat: (sessionId) => adminFetch('/api/admin/chat/session', { method: 'DELETE', body: JSON.stringify({ session_id: sessionId }) }),
  blockEmailFromChat: (email, reason, customReason) => adminFetch('/api/admin/chat/block-email', { method: 'POST', body: JSON.stringify({ email, reason, customReason }) }),

  // Users / Audit
  getUsers: () => adminFetch('/api/admin/users'),
  getAuditLog: () => adminFetch('/api/admin/audit-log'),
  getUserEmails: () => adminFetch('/api/admin/user-emails'),

  // Campaign
  sendCampaign: (subject, message) => adminFetch('/api/send-campaign', { method: 'POST', body: JSON.stringify({ subject, message }) }),

  // Admin management
  manageAdmins: (action, email) => adminFetch('/api/manage-admins', { method: 'POST', body: JSON.stringify({ action, email }) }),

  // Check auth
  checkAuth: () => fetch('/api/admin/check-auth').then(r => r.json()).then(d => d.authed).catch(() => false),
};

// Toast helper for showing messages
export function showToastMessage(msg, type) {
  const el = document.getElementById('rw-toast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : 'var(--ink)';
  el.style.color = '#fff';
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  clearTimeout(el._hide);
  el._hide = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; }, 3000);
}
