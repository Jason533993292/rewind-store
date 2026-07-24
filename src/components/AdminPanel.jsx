import React, { useState, useEffect, useCallback, useRef } from 'react';
import { nav } from '../lib/router';
import { Icon, Header } from './Shell';
import { QuickView } from './Shop';
import ChatBubble from './ChatBubble';
import ProductPage from './ProductPage';
import CreatePromoCode from './CreatePromoCode';
import AuditLogPanel from './AuditLogPanel';
import AdminChatPanel from './AdminChatPanel';
import BlockedPanel from './BlockedPanel';
import ProductForm from './ProductForm';
import EditProductPanel from './EditProductPanel';
import AdminOrdersPanel from './AdminOrdersPanel';
import { REWIND_PRODUCTS, REWIND_CATS } from '../data';
import { supabase, getCustomProducts, addCustomProduct, updateCustomProduct, uploadProductImage, getOrders, updateOrderStatus } from '../lib/supabase';
import { money } from '../hooks/useCountdown';

const VERSION = 'V11.3.0';

function AdminPanel({ onExit, onSelect, customProducts, setCustomProducts, showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [emailText, setEmailText] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [adminTab, setAdminTab] = useState(() => {
    const editPending = typeof localStorage !== 'undefined' && localStorage.getItem('rw_edit_product');
    return editPending ? 'edit' : (localStorage.getItem('rw_admin_tab') || 'users');
  });
  const [editProduct, setEditProduct] = useState(null); // direct product for editing
  const [adminEmail, setAdminEmail] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminChecking, setAdminChecking] = useState(true);
  const [orders, setOrders] = useState([]);
  const [adminMsg, setAdminMsg] = useState('');
  const [savedVersion, setSavedVersion] = useState(0);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [previewEmail, setPreviewEmail] = useState('');
  const [previewReason, setPreviewReason] = useState('');
  // Shipping modal state
  const [shipOrder, setShipOrder] = useState(null);
  const [trackingNum, setTrackingNum] = useState('');
  const [courierName, setCourierName] = useState('');
  const [shipping, setShipping] = useState(false);
  const [cancelStep, setCancelStep] = useState(0); // 0=closed, 1=reason, 2=email preview, 3=refund
  const [cancelledOrderNum, setCancelledOrderNum] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const lastUnreadRef = useRef(0);

  // ── Desktop notifications for new chat messages ──
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (chatUnread === 0) return;
    if (chatUnread > lastUnreadRef.current && Notification.permission === 'granted') {
      const diff = chatUnread - lastUnreadRef.current;
      try {
        new Notification('💬 New chat message' + (diff > 1 ? ` (${diff} unread)` : ''), {
          body: diff > 1 ? `${diff} unread messages from customers` : 'A customer sent a new message',
          tag: 'rewind-chat',
        });
      } catch {}
    }
    lastUnreadRef.current = chatUnread;
  }, [chatUnread]);

  // Separated admin auth check from data loading so that expensive Supabase
  // queries (users, custom products, orders) only fire after authentication
  // is confirmed — prevents unnecessary API calls and potential data exposure
  // when non-admin visitors land on #admin.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setAdminChecking(false);
      return;
    }
    const saved = localStorage.getItem('rw_admin_email');
    if (saved) setAdminEmail(saved);
    // Check auth via HttpOnly cookie — no localStorage token needed
    fetch('/api/admin/check-auth')
      .then(r => { if (r.ok) setAdminAuthed(true); setAdminChecking(false); })
      .catch(() => setAdminChecking(false));
  }, []);

  // Only load users, orders, and custom products after admin auth is confirmed
  useEffect(() => {
    if (!adminAuthed) return;
    // Fetch users, products, and orders through server API (not direct Supabase)
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      if (d.users) setUsers(d.users);
      setLoading(false);
    }).catch(() => setLoading(false));
    getCustomProducts().then(setCustomProducts).catch(() => {});
    getOrders().then(setOrders).catch(() => {});
  }, [adminAuthed]);

  // Check if we were directed here to edit a specific product (from QuickView or ProductPage "Edit" button)
  useEffect(() => {
    const editId = localStorage.getItem('rw_edit_product');
    if (editId) {
      localStorage.removeItem('rw_edit_product');
      const allProds = [...REWIND_PRODUCTS, ...customProducts];
      const found = allProds.find(p => (p.id || p.product_id) === editId);
      if (found) {
        setEditProduct(found);
        setAdminTab('edit');
      } else {
        setMsg('Product not found — it may not be a custom product');
      }
    }
  }, [customProducts]);

  async function toggleBlockUser(email, blocked) {
    const msg = blocked ? 'Block this user from the store?' : 'Unblock this user?';
    if (!window.confirm(msg)) return;
    try {
      if (blocked) {
        await fetch('/api/admin/block-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
      } else {
        await fetch('/api/admin/unblock-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
      }
    } catch {}
    // Optimistic UI update — reload data from server
    setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked } : u));
  }

  return (
    <div style={{ padding: '40px 24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>REWIND Admin</h1>
          <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{VERSION}</span>
        </div>
        <button onClick={onExit}
          style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'var(--ink)', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; }}>
          ← Back to store
        </button>
      </div>

      {/* ── Admin login ── */}
      {adminChecking && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Checking access...</p>}

      {!adminChecking && !adminAuthed && (
        <div style={{ maxWidth: '400px', margin: '60px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>🔐 Admin Access</h2>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Enter your admin email and secret token.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
          <input className="rw-input" placeholder="your@email.com" value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('rw-admin-verify-btn')?.click(); } }}
            style={{ flex: 1 }} />
            {localStorage.getItem('rw_admin_email') && (
              <button onClick={() => {
                localStorage.removeItem('rw_admin_email');
                localStorage.removeItem('rw_admin_saved');
                
                setAdminEmail('');
                setAdminMsg('✅ Stored email cleared');
              }}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; e.target.style.color = 'var(--ink)'; }}
                onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; e.target.style.color = 'var(--muted)'; }}
                title="Clear saved email and try again">
                ✕ Clear stored
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <input className="rw-input" type={showToken ? 'text' : 'password'} placeholder="Admin secret token" value={adminToken}
              onChange={e => setAdminToken(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('rw-admin-verify-btn')?.click(); } }}
              style={{ flex: 1, marginBottom: 0 }} />
            <button onClick={() => setShowToken(!showToken)}
              type="button"
              aria-label={showToken ? 'Hide token' : 'Show token'}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line-2)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: '15px', lineHeight: 1,
                color: showToken ? 'var(--accent)' : 'var(--muted)',
                transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; }}
              onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; }}>
              {showToken ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <button id="rw-admin-verify-btn" onClick={async () => {
            if (!adminEmail) return;
            if (!adminToken) { setAdminMsg('❌ Please enter your admin secret token.'); return; }
            setAdminMsg('');
            try {
              const r = await fetch('/api/verify-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: adminEmail, token: adminToken })
              });
              if (!r.ok) { setAdminMsg('❌ Server error (' + r.status + ') — try again'); return; }
              const d = await r.json();
              if (d.verified) {
                localStorage.setItem('rw_admin_email', adminEmail);
                
                setAdminAuthed(true);
              } else {
                setAdminMsg('❌ Access denied. This email is not on the admin list.');
              }
            } catch {
              setAdminMsg('❌ Could not verify — try again');
            }
          }}
            style={{ padding: '10px 24px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            Enter admin panel
          </button>
          <p style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '8px' }}>{adminMsg}</p>
        </div>
      )}

      {adminAuthed && (<>
      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '📊 Users' },
          { id: 'email', label: '📧 Email' },
          { id: 'orders', label: '📦 Orders' },
          { id: 'chats', label: '💬 Chats' + (chatUnread > 0 ? ` (${chatUnread})` : '') },
          { id: 'promo', label: '🎟️ Promo Codes' },
          { id: 'blocked', label: '🚫 Blocked' },
          { id: 'products', label: '🛍️ Products' },
          { id: 'audit', label: '📜 Audit Log' },
        ].filter(t => t.label).map((t) => (
          <button key={t.id} onClick={() => { setAdminTab(t.id); localStorage.setItem('rw_admin_tab', t.id); }}
            style={{
              padding: '10px 20px', borderRadius: '999px', border: 'none',
              background: adminTab === t.id ? 'var(--ink)' : 'var(--line)',
              color: adminTab === t.id ? 'var(--surface)' : 'var(--ink)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line-2)'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (adminTab !== t.id) { e.target.style.background = 'var(--line)'; e.target.style.transform = ''; } }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Keyboard shortcuts hint */}
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-16px', marginBottom: '24px', textAlign: 'center' }}>
        Shortcuts: 1 Users · 2 Email · 3 Orders · 4 Chats · 5 Promo · 6 Blocked · 7 Products · 8 Audit
      </div>

      {!supabase && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', background: 'var(--line)', borderRadius: '12px' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Supabase not connected</p>
          <p style={{ fontSize: '14px' }}>Set up VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then redeploy.</p>
        </div>
      )}

      {supabase && loading && <p>Loading users...</p>}

      {supabase && !loading && users.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          <p>No users signed up yet. Sign up on the storefront to see data here.</p>
        </div>
      )}

      {supabase && !loading && users.length > 0 && adminTab === 'users' && (
        <>
          {/* ── User table ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginBottom: '32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Email</th>
                  <th style={{ padding: '12px 16px' }}>Wishlist</th>
                  <th style={{ padding: '12px 16px' }}>Marketing</th>
                  <th style={{ padding: '12px 16px' }}>Signed up</th>
                  <th style={{ padding: '12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} style={{ borderTop: '1px solid var(--line)', background: u.blocked ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent' }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedUser(selectedUser?.email === u.email ? null : u);
                    }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, cursor: 'context-menu' }}>
                      {u.email} {u.blocked && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>🚫</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.product_ids?.length || 0} items
                      {u.product_ids?.length > 0 && (
                        <button onClick={() => setSelectedUser(selectedUser?.email === u.email ? null : u)}
                          style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px' }}>
                          {selectedUser?.email === u.email ? 'Hide' : 'View'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{u.marketing_optin ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <a href={`mailto:${u.email}`} style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '16px' }}>✉️</a>
                      <button onClick={() => toggleBlockUser(u.email, !u.blocked)}
                        style={{
                          marginLeft: '8px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: u.blocked ? 'color-mix(in oklab, var(--accent) 30%, transparent)' : 'var(--accent)',
                          color: 'var(--surface)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 700,
                          transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)'; }}
                        onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
                        {u.blocked ? '✅ Unblock' : '🚫 Block'}
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm(`Delete all data for ${u.email}? This cannot be undone.`)) return;
                        try {
                          const r = await fetch('/api/admin/delete-customer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email }) });
                          const d = await r.json();
                          if (r.ok) alert('✅ Deleted data for ' + u.email + (d.sessionsRemoved ? ' (' + d.sessionsRemoved + ' chat sessions)' : ''));
                          else alert('❌ ' + d.error);
                        } catch { alert('❌ Network error'); }
                      }}
                        style={{ marginLeft: '4px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'transform 0.15s, box-shadow 0.15s' }}
                        onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)'; }}
                        onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Selected user's wishlist ── */}
          {selectedUser && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                {selectedUser.email}'s wishlist
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedUser.product_ids?.map((pid) => {
                  const product = [...REWIND_PRODUCTS, ...customProducts].find((p) => p.id === pid || p.product_id === pid);
                  return (
                    <a key={pid} href="#"
                      onClick={(e) => { e.preventDefault(); nav('/'); onSelect(product); }}
                      style={{ padding: '6px 12px', background: 'var(--line)', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', color: 'var(--ink)', display: 'inline-block', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseOver={e => e.target.style.background = 'var(--line-2)'}
                      onMouseOut={e => e.target.style.background = 'var(--line)'}
                      title={`${product?.name || pid} — ${product?.brand || 'no brand'} — ${product?.cat || ''}`}>
                      {product?.name || pid} {product ? `— ${product.cat}` : ''}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total users</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.filter(u => u.marketing_optin).length}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Marketing opt-in</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{users.reduce((s, u) => s + (u.product_ids?.length || 0), 0)}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Saved items</div>
            </div>
          </div>

          {/* ── Admin manager ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🔑 Admin management</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input placeholder="Email to add as admin" id="new-admin-email"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px' }} />
              <button onClick={async () => {
                const input = document.getElementById('new-admin-email');
                const email = input.value.trim();
                if (!email) return;
                const masterToken = prompt('Enter the admin master token to authorize this change:');
                if (!masterToken) return;
                const r = await fetch('/api/manage-admins', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': masterToken }, body: JSON.stringify({ action: 'add', email, adminEmail }) });
                const d = await r.json();
                alert(d.ok ? `✅ ${email} added as admin` : `❌ ${d.error}`);
                if (d.ok) input.value = '';
              }}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                Add admin
              </button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              Enter a team member's email above to grant them admin access
            </div>
          </div>

          {/* ── Run Tests ── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🧪 Automated tests</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
              Tests every button and page on the site using Playwright browser automation.
            </p>
            <button onClick={async () => {
              const btn = document.activeElement;
              btn.textContent = '🔄 Running tests...';
              btn.disabled = true;
              try {
                const r = await fetch('/api/run-tests');
                const d = await r.json();
                if (d.error) throw new Error(d.error);
                btn.textContent = `✅ ${d.passed}/${d.total} passed` + (d.skipped ? ' (server test unavailable)' : '');
                // Show results inline
                const resultsDiv = document.getElementById('test-results');
                if (resultsDiv) {
                  resultsDiv.textContent = '';
                  (d.results || []).forEach(r => {
                    const row = Object.assign(document.createElement('div'), { style: 'padding:6px 0;border-bottom:1px solid var(--line);font-size:13px' });
                    row.textContent = (r.status || '⚠️') + ' ' + (r.name || r.endpoint || 'Test') + ': ' + (r.detail || '');
                    resultsDiv.appendChild(row);
                  });
                  if (d.hint) {
                    const hint = Object.assign(document.createElement('div'), { style: 'padding:8px 0;font-size:12px;color:var(--muted)' });
                    hint.textContent = '💡 ' + d.hint;
                    resultsDiv.appendChild(hint);
                  }
                }
              } catch (e) {
                btn.textContent = '❌ Tests failed';
              }
              setTimeout(() => { btn.textContent = '🧪 Run tests'; btn.disabled = false; }, 5000);
            }}
              style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
              🧪 Run tests
            </button>
            <div id="test-results" style={{ marginTop: '16px', maxHeight: '300px', overflow: 'auto' }} />
          </div>
          </>)
}

          {/* ── Email tool ── */}
          {adminTab === 'email' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📧 Email users about discounts / sales</h3>
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
              placeholder="Write your email message here... (or leave blank for default)"
              rows={5}
              style={{ width: '100%', padding: '12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', resize: 'vertical', marginBottom: '8px' }} />
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              Emails are sent via Resend. Leave message blank for a default template.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.textContent = 'Sending...';
                btn.disabled = true;
                const r = await fetch('/api/send-campaign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ emails: users.map((u) => u.email), subject: '', message: emailText || '' }),
                });
                const d = await r.json();
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
              }}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📩 Email all users ({users.length})
              </button>
              <button onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.textContent = 'Sending...';
                btn.disabled = true;
                const marketingUsers = users.filter((u) => u.marketing_optin);
                const r = await fetch('/api/send-campaign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ emails: marketingUsers.map((u) => u.email), subject: '', message: emailText || '' }),
                });
                const d = await r.json();
                btn.textContent = d.ok ? `✅ Sent (${d.sent}/${d.total})` : `❌ ${d.error || 'Failed'}`;
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
              }}
                style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📩 Email opted-in only ({users.filter((u) => u.marketing_optin).length})
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(users.map((u) => u.email).join(', ')); }}
                style={{ padding: '10px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                📋 Copy all emails
              </button>
            </div>
          </div>
          )}

          {/* ── Orders ── */}
          {adminTab === 'orders' && (
            <AdminOrdersPanel showToast={showToast} />
          )}

          {/* ── Edit product panel ── */}
          {adminTab === 'edit' && editProduct && (
            <EditProductPanel key={editProduct.id || editProduct.product_id} product={editProduct} onDone={() => { setEditProduct(null); setAdminTab('products'); }} setCustomProducts={setCustomProducts} />
          )}

          {/* ── Blocked IPs ── */}
          {adminTab === 'blocked' && <BlockedPanel />}
          {adminTab === 'audit' && <AuditLogPanel />}
          {adminTab === 'chats' && <AdminChatPanel chatUnread={chatUnread} setChatUnread={setChatUnread} />}

          {/* ── Promo Codes ── */}
          {adminTab === 'promo' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🎟️ Promo Codes</h3>
            <CreatePromoCode showToast={showToast} />
          </div>
          )}

          {/* ── Product stats ── */}
          {adminTab === 'products' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Product stats</h3>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '14px', paddingRight: productSearch ? '36px' : '14px' }} />
              {productSearch && (
                <button onClick={() => setProductSearch('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    display: 'grid', placeItems: 'center', color: 'var(--muted)', opacity: 0.7,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseOver={e => e.target.style.opacity = '1'}
                  onMouseOut={e => e.target.style.opacity = '0.7'}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
            {(() => {
              // Count favorites per product from all users
              const favCounts = {};
              users.forEach(u => {
                (u.product_ids || []).forEach(pid => {
                  if (!favCounts[pid]) favCounts[pid] = { count: 0, users: [] };
                  favCounts[pid].count++;
                  if (!favCounts[pid].users.includes(u.email)) favCounts[pid].users.push(u.email);
                });
              });
              // Build product list from all products + custom products
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const productStats = allProds.filter(p => {
                const name = p.name?.toLowerCase() || '';
                const brand = p.brand?.toLowerCase() || '';
                const q = productSearch.toLowerCase();
                return !q || name.includes(q) || brand.includes(q);
              }).map(p => ({
                ...p,
                favs: favCounts[p.id || p.product_id]?.count || 0,
                favUsers: favCounts[p.id || p.product_id]?.users || [],
              })).sort((a, b) => b.favs - a.favs);

              if (productStats.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No products found.</p>;
              return (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Product</th>
                      <th style={{ padding: '8px 12px' }}>Brand</th>
                      <th style={{ padding: '8px 12px' }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>⭐ Favs</th>
                      <th style={{ padding: '8px 12px' }}>Users</th>
                    </tr></thead>
                    <tbody>
                      {productStats.map(p => (
                        <tr key={p.id || p.product_id} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name || 'Unnamed'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{p.brand || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>{p.cat}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>{p.favs}</td>
                          <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.favUsers.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
          )}

          {adminTab === 'products' && (
          <ProductForm editProduct={editProduct} onClearEdit={() => setEditProduct(null)}
            customProducts={customProducts} setCustomProducts={setCustomProducts} />
          )}
        </>
      )}

      {/* ── Cancel panel (step-based — same container, different content) ── */}
      {cancelOrder && cancelStep > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(22,19,15,0.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => { if (!cancelling) { setCancelOrder(null); setCancelReason(''); setCustomReason(''); setCancelStep(0); setPreviewEmail(''); } }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '14px', padding: '32px', maxWidth: cancelStep === 2 ? '520px' : '480px', width: '100%', boxShadow: '0 30px 80px -20px rgba(22,19,15,.5)', position: 'relative' }}>
            <button onClick={() => { setCancelOrder(null); setCancelReason(''); setCustomReason(''); setCancelStep(0); setPreviewEmail(''); }}
              style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--muted)', lineHeight: 1 }}
              aria-label="Close">✕</button>

            {/* ── Step 1: Reason selection ── */}
            {cancelStep === 1 && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '2px' }}>
                    {cancelOrder.order?.order_num || 'Order'} · {cancelOrder.order?.total ? `€${cancelOrder.order.total}` : ''}
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 12px' }}>Cancel order</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>1</div>
                    <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--line-2)' }} />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--line)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>2</div>
                    <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--line-2)' }} />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--line)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>3</div>
                  </div>
                </div>
                {[{id:'out_of_stock',label:'Out of stock'},{id:'damaged',label:'Damaged during handling'},{id:'customer_request',label:'Customer requested'},{id:'other',label:'Other'}].map(r => (
                  <button key={r.id} onClick={() => { setCancelReason(r.id); if (r.id !== 'other') setCustomReason(''); }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', marginBottom: '6px', borderRadius: '10px', border: cancelReason === r.id ? '2px solid var(--ink)' : '1px solid var(--line-2)', background: cancelReason === r.id ? 'var(--ink)' : 'var(--surface)', color: cancelReason === r.id ? '#fff' : 'var(--ink)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseOver={e => { if (cancelReason !== r.id) { e.target.style.borderColor = 'var(--ink)'; e.target.style.background = 'var(--line)'; } }}
                    onMouseOut={e => { if (cancelReason !== r.id) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.background = 'var(--surface)'; } }}>
                    {r.label}
                  </button>
                ))}
                {cancelReason === 'other' && (
                  <textarea placeholder="Describe why you're cancelling this order..."
                    value={customReason} onChange={e => setCustomReason(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--line-2)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', minHeight: '60px', outline: 'none', boxSizing: 'border-box' }} />
                )}
                <button disabled={!cancelReason || cancelling || !(cancelReason !== 'other' || (cancelReason === 'other' && customReason.trim()))} onClick={async () => {
                  setCancelling(true);
                  try {
                    const previewRes = await fetch('/api/admin/preview-cancel-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: cancelReason, customReason: cancelReason === 'other' ? customReason : '', customerName: cancelOrder.order?.customer_name || 'there' }),
                    });
                    const previewData = await previewRes.json();
                    setPreviewEmail(previewData.emailBody || '');
                    setPreviewReason(previewData.reasonText || '');
                    setCancelStep(2);
                  } catch {
                    alert('❌ Could not generate email preview');
                  }
                  setCancelling(false);
                }}
                  style={{ display: 'block', width: '100%', padding: '12px', borderRadius: '999px', border: 'none', background: cancelReason && !cancelling ? 'var(--accent)' : 'var(--line-2)', color: '#fff', cursor: cancelReason && !cancelling ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '14px', marginTop: '16px', transition: 'all 0.15s' }}>
                  {cancelling ? 'Generating...' : cancelReason ? 'Preview email →' : 'Select a reason'}
                </button>
              </>
            )}

            {/* ── Step 2: Email preview ── */}
            {cancelStep === 2 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--accent)' }} />
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>2</div>
                  <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--line-2)' }} />
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--line)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>3</div>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>Review email</h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
                  {cancelOrder.order?.order_num || 'Order'} — the AI-generated email will be sent to the customer
                </p>
                <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '16px', marginBottom: '16px', fontSize: '14px', lineHeight: '1.6' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📧 Email</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{previewEmail || 'Generating...'}</div>
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '13px' }}><b>Reason:</b> {previewReason}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setCancelStep(1); }}
                    style={{ flex: 1, padding: '12px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'all 0.15s' }}
                    onMouseOver={e => { e.target.style.borderColor = 'var(--ink)'; }}
                    onMouseOut={e => { e.target.style.borderColor = 'var(--line-2)'; }}>
                    ← Back
                  </button>
                  <button disabled={cancelling} onClick={async () => {
                    setCancelling(true);
                    try {
                      const r = await fetch('/api/admin/cancel-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: cancelOrder.id, reason: cancelReason, customReason: cancelReason === 'other' ? customReason : '' }),
                      });
                      const d = await r.json();
                      if (d.ok) {
                        setOrders(prev => prev.map(o => o.id === cancelOrder.id ? { ...o, status: 'cancelled' } : o));
                        setCancelledOrderNum(cancelOrder.order?.order_num || '');
                        setCancelStep(3);
                      } else {
                        alert('❌ ' + (d.error || 'Failed'));
                      }
                    } catch {
                      alert('❌ Network error');
                    }
                    setCancelling(false);
                  }}
                    style={{ flex: 1, padding: '12px', borderRadius: '999px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: cancelling ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px', transition: 'all 0.15s' }}>
                    {cancelling ? 'Sending...' : '✅ Send & cancel order'}
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: Refund steps ── */}
            {cancelStep === 3 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--accent)' }} />
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <div style={{ flex: 1, height: 0, borderTop: '2px dashed var(--accent)' }} />
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>3</div>
                </div>
                <div style={{ fontSize: '40px', marginBottom: '8px', textAlign: 'center' }}>✅</div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, textAlign: 'center', margin: '0 0 4px' }}>Order cancelled</h3>
                <p style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center', margin: '0 0 20px' }}>
                  {cancelledOrderNum} — email sent to customer
                </p>
                <div style={{ background: 'color-mix(in oklab, var(--accent) 10%, transparent)', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Refund steps</div>
                  <div style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: '1.8' }}>
                    1. Search for <b>{cancelledOrderNum}</b> in Stripe<br/>
                    2. Find the payment → Click <b>Refund</b><br/>
                    3. Select <b>Full refund</b> → <b>Confirm</b><br/>
                    4. Customer sees refund in <b>5-10 business days</b>
                  </div>
                </div>
                <button onClick={() => { window.open('https://dashboard.stripe.com/payments?query=' + encodeURIComponent(cancelledOrderNum), '_blank'); }}
                  style={{ display: 'block', width: '100%', padding: '14px', borderRadius: '999px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px', marginBottom: '10px', transition: 'all 0.15s' }}>
                  🔍 Search in Stripe
                </button>
                <button onClick={() => { setCancelOrder(null); setCancelReason(''); setCustomReason(''); setCancelStep(0); setPreviewEmail(''); }}
                  style={{ display: 'block', width: '100%', padding: '12px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'all 0.15s' }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Ship order modal ── */}
      {shipOrder && (
        <div className="rw-modal-wrap" onClick={() => { if (!shipping) { setShipOrder(null); } }}>
          <div className="rw-modal" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '460px', gridTemplateColumns: '1fr', background: 'var(--surface)', borderRadius: '14px', padding: '32px' }}>
            <button onClick={() => setShipOrder(null)}
              style={{ position: 'absolute', top: '14px', right: '14px', width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--line)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>✕</button>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px' }}>🚚 Mark as shipped</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px' }}>
              Order {shipOrder.order_num} · {shipOrder.customer_name}
            </p>
            <input className="rw-input" type="text" placeholder="Courier name (e.g. PostNL, FedEx)"
              value={courierName} onChange={e => setCourierName(e.target.value)}
              style={{ marginBottom: '10px' }} />
            <input className="rw-input" type="text" placeholder="Tracking number"
              value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
              style={{ marginBottom: '14px' }} />
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '16px' }}>
              Customer will receive an email with tracking info. Track at <a href="https://www.17track.net/en" target="_blank" style={{ color: 'var(--accent)' }}>17track.net</a>
            </p>
            <button className="rw-btn rw-btn-pri rw-btn-full" disabled={!trackingNum.trim() || !courierName.trim() || shipping}
              onClick={async () => {
                setShipping(true);
                try {
                  const r = await fetch('/api/admin/orders/ship', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: shipOrder.id, trackingNumber: trackingNum.trim(), courier: courierName.trim() }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    setOrders(prev => prev.map(ord => ord.id === shipOrder.id ? { ...ord, status: 'shipped' } : ord));
                    setShipOrder(null);
                    alert('✅ Shipped! Email sent to customer.');
                  } else {
                    alert('❌ Failed: ' + (d.error || 'Unknown error'));
                  }
                } catch {
                  alert('❌ Network error — try again');
                }
                setShipping(false);
              }}>
              {shipping ? 'Shipping...' : `Mark shipped & notify customer`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;

/* ── First-visit survey ── */
