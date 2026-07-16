import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Icon, Header } from './Shell';
import { QuickView } from './Shop';
import ChatBubble from './ChatBubble';
import ProductPage from './ProductPage';
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
  const [adminTab, setAdminTab] = useState('users');
  const [editProduct, setEditProduct] = useState(null); // direct product for editing
  const [adminEmail, setAdminEmail] = useState('');
  const [adminToken, setAdminToken] = useState(() => {
    try { return localStorage.getItem('rw_admin_token') || ''; } catch { return ''; }
  });
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
  const [cancelStep, setCancelStep] = useState(0); // 0=closed, 1=reason, 2=email preview, 3=refund
  const [cancelledOrderNum, setCancelledOrderNum] = useState('');
  const [chatUnread, setChatUnread] = useState(0);

  // Keyboard shortcuts: 1-9 for tabs (skip when typing in inputs)
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabs = ['users', 'email', 'orders', 'chats', 'promo', 'blocked', 'products', 'changelog', 'audit'];
        if (tabs[n - 1]) { setAdminTab(tabs[n - 1]); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    if (saved) {
      setAdminEmail(saved);
      // Verify via server endpoint — NOT direct Supabase query with anon key
      fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: saved, token: localStorage.getItem('rw_admin_token') })
      }).then(r => {
        if (!r.ok) { console.error('Verify-admin status:', r.status); return { verified: false }; }
        return r.json();
      }).then(d => {
        if (d.verified) {
          if (d.sessionToken) localStorage.setItem('rw_admin_token', d.sessionToken);
          setAdminAuthed(true);
        }
        setAdminChecking(false);
      }).catch(() => setAdminChecking(false));
    } else {
      setAdminChecking(false);
    }
  }, []);

  // Only load users, orders, and custom products after admin auth is confirmed
  useEffect(() => {
    if (!adminAuthed) return;
    // Fetch users, products, and orders through server API (not direct Supabase)
    fetch('/api/admin/users', {
      headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') }
    }).then(r => r.json()).then(d => {
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
          headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
          body: JSON.stringify({ email })
        });
      } else {
        await fetch('/api/admin/unblock-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
          body: JSON.stringify({ email })
        });
      }
    } catch {}
    // Optimistic UI update — reload data from server
    setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked } : u));
  }

  // Stats
  const totalFavs = users.reduce((s, u) => s + (u.product_ids?.length || 0), 0);

  const allEmails = users.map((u) => u.email).join(', ');
  const marketingEmails = users.filter((u) => u.marketing_optin).map((u) => u.email).join(', ');

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
                localStorage.removeItem('rw_admin_token');
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
                localStorage.setItem('rw_admin_token', d.sessionToken || adminToken);
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
          { id: 'changelog', label: '📋 Changelog' },
          { id: 'audit', label: '📜 Audit Log' },
        ].filter(t => t.label).map((t) => (
          <button key={t.id} onClick={() => setAdminTab(t.id)}
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
        Shortcuts: 1 Users · 2 Email · 3 Orders · 4 Chats · 5 Promo · 6 Blocked · 7 Products · 8 Changelog · 9 Audit
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
                      onClick={(e) => { e.preventDefault(); window.location.hash = ''; onSelect(product); }}
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
                const r = await fetch('/api/manage-admins', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ action: 'add', email, adminEmail }) });
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
                const r = await fetch('/api/run-tests', {
                  headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') }
                });
                const d = await r.json();
                if (d.error) throw new Error(d.error);
                btn.textContent = `✅ ${d.passed}/${d.total} passed`;
                // Show results inline
                const resultsDiv = document.getElementById('test-results');
                if (resultsDiv) {
                  resultsDiv.textContent = '';
                  d.results.forEach(r => {
                    const row = Object.assign(document.createElement('div'), { style: 'padding:6px 0;border-bottom:1px solid var(--line);font-size:13px' });
                    row.textContent = r.status + ' ' + r.endpoint;
                    resultsDiv.appendChild(row);
                  });
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
                  headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
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
                  headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
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
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            {/* ── Order stats chart ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Total</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'pending').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>⏳ Pending</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--accent) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'ordered').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>📦 Ordered</div>
              </div>
              <div style={{ background: 'color-mix(in oklab, var(--ink) 16%, transparent)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{orders.filter(o => o.status === 'shipped').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>🚚 Shipped</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📦 Orders to fulfill</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {orders.length > 0 && (
                  <button onClick={() => {
                    const csv = ["Order,Customer,Email,Items,Total,Status,Address"];
                    orders.forEach(o => {
                      const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size})`).join('; ');
                      csv.push(`"${o.order_num}","${o.customer_name}","${o.email}","${items}","€${o.total}","${o.status}","${o.address}"`);
                    });
                    navigator.clipboard.writeText(csv.join('\n'));
                    alert('📋 Orders CSV copied! Paste into Shopify or Excel.');
                  }}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}
                    onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                    onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
                            📋 Export CSV
                  </button>
                )}
              </div>
            </div>
            {orders.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No orders yet. When a customer checks out, orders appear here.</p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                  {orders.filter(o => o.status === 'pending').length} pending · {orders.filter(o => o.status === 'ordered').length} ordered · {orders.filter(o => o.status === 'shipped').length} shipped
                </p>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Order</th>
                      <th style={{ padding: '8px 10px' }}>Customer</th>
                      <th style={{ padding: '8px 10px' }}>Items</th>
                      <th style={{ padding: '8px 10px' }}>Total</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                      <th style={{ padding: '8px 10px' }}>Supplier</th>
                    </tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} style={{ borderTop: '1px solid var(--line)', background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: '12px' }}>{o.order_num}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <div>{o.customer_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.email}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.address}</div>
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                            {(Array.isArray(o.items) ? o.items : []).map((it, i) => (
                              <div key={i}>{typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`}</div>
                            ))}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{money(o.total)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <select value={o.status} onChange={async (e) => {
                              await updateOrderStatus(o.id, e.target.value);
                              setOrders(prev => prev.map(ord => ord.id === o.id ? { ...ord, status: e.target.value } : ord));
                            }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', fontWeight: 600,
                                background: o.status === 'pending' ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : o.status === 'ordered' ? 'color-mix(in oklab, var(--accent) 40%, transparent)' : 'color-mix(in oklab, var(--ink) 20%, transparent)' }}>
                              <option value="pending">⏳ Pending</option>
                              <option value="ordered">📦 Ordered</option>
                              <option value="shipped">🚚 Shipped</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => {
                              const items = (Array.isArray(o.items) ? o.items : []).map(it => typeof it === 'string' ? it : `${it.name} (${it.size}) × ${it.qty || 1}`).join(', ');
                              const msg = `NEW ORDER\n━━━━━━━━━━━\nOrder: ${o.order_num}\nItem: ${items}\nCustomer: ${o.customer_name}\nAddress: ${o.address}\nEmail: ${o.email}\n━━━━━━━━━━━\nPlease ship to the address above.`;
                              navigator.clipboard.writeText(msg);
                              alert('✅ Order info copied! Paste it into your Alibaba / WhatsApp / DSers chat.');
                            }}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s', marginRight: '4px' }}
                              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.transform = 'translateY(-1px)'; }}
                              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}>
                              📋 Copy for supplier
                            </button>
                            {o.status !== 'cancelled' && o.status !== 'shipped' && (
                            <button onClick={() => { setCancelOrder({ id: o.id, order: o }); setCancelStep(1); }}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
                              onMouseOut={e => { e.target.style.background = 'color-mix(in oklab, var(--accent) 15%, transparent)'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}>
                              ✕ Cancel
                            </button>
                            )}
                            {o.status === 'cancelled' && (
                            <button onClick={async () => {
                              const r = await fetch('/api/admin/undo-cancel-order', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
                                body: JSON.stringify({ orderId: o.id }),
                              });
                              const d = await r.json();
                              if (d.ok) setOrders(prev => prev.map(p => p.id === o.id ? { ...p, status: 'pending' } : p));
                            }}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--ink)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                              onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
                              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; e.target.style.transform = ''; }}>
                              ↩ Undo
                            </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          )}

          {/* ── Stock bar chart ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📊 Stock levels</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const maxStock = Math.max(...allProds.map(p => p.stock || 0), 1);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allProds.map(p => (
                    <div key={p.id || p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '160px', fontSize: '12px', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <div style={{ flex: 1, height: '22px', background: 'var(--line)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${Math.round(((p.stock || 0) / maxStock) * 100)}%`,
                          height: '100%',
                          background: (p.stock || 0) <= 5 ? 'var(--accent)' : (p.stock || 0) <= 15 ? 'color-mix(in oklab, var(--accent) 60%, var(--ink))' : 'color-mix(in oklab, var(--ink) 40%, transparent)',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ width: '30px', fontSize: '12px', fontWeight: 700, color: (p.stock || 0) <= 5 ? 'var(--accent)' : 'var(--muted)' }}>{p.stock || 0}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Stock alerts ── */}
          {adminTab === 'orders' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>📉 Stock alerts</h3>
            {(() => {
              const allProds = [...REWIND_PRODUCTS, ...customProducts];
              const low = allProds.filter(p => p.stock !== undefined && p.stock <= 5);
              if (low.length === 0) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>All products have sufficient stock.</p>;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {low.map(p => (
                    <span key={p.id || p.product_id} style={{ padding: '6px 12px', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
                      {p.name} — only {p.stock} left
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          )}

          {/* ── Edit product panel ── */}
          {adminTab === 'edit' && editProduct && (
            <EditProductPanel key={editProduct.id || editProduct.product_id} product={editProduct} onDone={() => { setEditProduct(null); setAdminTab('products'); }} setCustomProducts={setCustomProducts} />
          )}

          {/* ── Blocked IPs ── */}
          {adminTab === 'blocked' && <BlockedPanel />}

          {/* ── Changelog ── */}
          {adminTab === 'changelog' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '20px', maxWidth: '700px', fontSize: '14px', lineHeight: '1.7' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>📋 Dev log</h3>
            {[
              { v: 'V8.2.0', date: 'Jul 7', items: ['✕ X button immediately closes + hides chat from list', 'Email required before customer can start a chat', 'Block button now shows feedback messages', 'Hover flicker in session list fixed (e.currentTarget)'] },
              { v: 'V8.1.0', date: 'Jul 7', items: ['Chat email input screen for customers', 'URL encoding for session IDs'] },
              { v: 'V8.0.0', date: 'Jul 7', items: ['Full live chat system (ChatBubble + admin panel)', 'Separate modals for Close session, Block, Give promo', 'Notification badge on Chats tab (polls 10s)', 'Session closed UI for customers', 'SVG spinner on refresh button', 'Promo codes stored in DB + valid in checkout', 'Admin token reads from localStorage on mount'] },
              { v: 'V7.9.0', date: 'Jul 7', items: ['Performance: lazy images, content-visibility CSS', 'Removed unused deps (react-router-dom, react-select)', 'Removed old promo code button'] },
              { v: 'V7.8.0', date: 'Jul 6', items: ['Security fixes from Claude audit', 'Hydrate blocked lists on boot', 'Gate /api/env behind requireAdmin', 'AI auto-reply fire-and-forget', 'AI sender set to "ai" not "admin"'] },
              { v: 'V7.7.0', date: 'Jul 6', items: ['Admin chat panel with session list + reply', 'AI auto-reply for common questions'] },
              { v: 'V7.6.0', date: 'Jul 6', items: ['Undo cancel button for cancelled orders', '3-column product grid', 'Live chat feature (backend + widget)'] },
              { v: 'V7.5.0', date: 'Jul 5', items: ['Cache-control no-store (no more Cloudflare purge)', 'Security: shipping calc, IP blocker, helmet, minify', 'Cancel flow with step indicators + reason-specific emails', 'Canned cancel emails (no AI for predefined reasons)'] },
              { v: 'V7.4.0', date: 'Jul 5', items: ['Admin cancel order + email', 'Mouse glow removed', 'Gemini AI for cancel emails'] },
              { v: 'V7.3.0', date: 'Jul 4', items: ['Chat widget + product descriptions', 'Admin security fixes'] },
              { v: 'V7.0.0', date: 'Jul 3', items: ['Admin panel with orders, users, products', 'Stripe payments + webhooks', 'Supabase RLS lockdown'] },
              { v: 'V6.0.0', date: 'Jun 28', items: ['Initial deploy: product grid, cart, wishlist', 'Railway + Cloudflare setup'] },
            ].map(entry => (
              <div key={entry.v} style={{ marginBottom: '16px', paddingLeft: '12px', borderLeft: '2px solid var(--line)' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>{entry.v} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>— {entry.date}</span></div>
                <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '13px', color: 'var(--ink)' }}>
                  {entry.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
          )}

          {/* ── Audit Log ── */}
          {adminTab === 'audit' && <AuditLogPanel adminToken={adminToken} />}

          {/* ── Chats ── */}
          {adminTab === 'chats' && <AdminChatPanel adminToken={adminToken} chatUnread={chatUnread} setChatUnread={setChatUnread} />}

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
                      headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
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
                        headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') },
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
    </div>
  );
}

/* ── Admin Chat Panel ── */
function AdminChatPanel({ adminToken, chatUnread, setChatUnread }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [hoveredSession, setHoveredSession] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockCustomReason, setBlockCustomReason] = useState('');
  const [blockMsg, setBlockMsg] = useState('');
  const [showPromoPanel, setShowPromoPanel] = useState(false);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [promoPercent, setPromoPercent] = useState(10);
  const [promoCustomValue, setPromoCustomValue] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const scrollRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/chat/sessions', {
        headers: { 'x-admin-token': adminToken },
      });
      const d = await r.json();
      setSessions(Array.isArray(d.sessions) ? d.sessions : []);
    } catch {}
  }, [adminToken]);

  const loadMessages = useCallback(async (sessionId) => {
    try {
      const r = await fetch(`/api/admin/chat/messages?session_id=${encodeURIComponent(sessionId)}`, {
        headers: { 'x-admin-token': adminToken },
      });
      const d = await r.json();
      setMessages(Array.isArray(d.messages) ? d.messages : []);
    } catch {}
  }, [adminToken]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Notification badge — poll for new sessions every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/api/admin/chat/sessions', {
          headers: { 'x-admin-token': adminToken },
        });
        const d = await r.json();
        const newSessions = Array.isArray(d.sessions) ? d.sessions : [];
        setSessions(prev => {
          if (prev.length > 0 && newSessions.length > prev.length) {
            setChatUnread(newSessions.length - prev.length);
          }
          return newSessions;
        });
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [adminToken, setChatUnread]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => loadMessages(selectedId), 3000);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages]);

  async function handleSelect(sessionId) {
    setSelectedId(sessionId);
    loadMessages(sessionId);
    // Clear unread badge when viewing chats
    setChatUnread(0);
  }

  async function handleReply() {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/admin/chat/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ session_id: selectedId, message: text }),
      });
      const d = await r.json();
      if (d.ok) {
        setReply('');
        loadMessages(selectedId);
        loadSessions();
      }
    } catch {}
    setSending(false);
  }

  async function handleCloseConfirmed() {
    try {
      await fetch('/api/admin/chat/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ session_id: selectedId }),
      });
    } catch {}
    setSessions(prev => prev.filter(s => s.session_id !== selectedId));
    setSelectedId(null);
    setShowCloseConfirm(false);
  }

  const BLOCK_REASONS = ['Spammer', 'Troller', 'Abusive', 'Rude', 'Other'];

  async function handleBlock(reason) {
    if (!selectedId) return;
    const session = sessions.find(s => s.session_id === selectedId);
    const email = session?.customer_email;
    const finalReason = reason === 'Other' ? blockCustomReason : reason;
    try {
      const r = await fetch('/api/admin/block-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ session_id: selectedId, email, reason: finalReason || 'Blocked via chat' }),
      });
      const d = await r.json();
      if (d.ok) {
        const parts = [];
        if (d.emailBlocked) parts.push('email');
        if (d.ipBlocked) parts.push('IP');
        setBlockMsg(`✅ Blocked ${parts.join(' + ')} for ${email}`);
        if (!d.emailBlocked && !d.ipBlocked) {
          setBlockMsg('❌ Nothing was blocked — no email or IP found');
        }
      } else {
        setBlockMsg('❌ Failed to block');
      }
    } catch { setBlockMsg('❌ Error'); }
    setTimeout(() => { setBlockMsg(''); setShowBlockPanel(false); setBlockReason(''); setBlockCustomReason(''); }, 1500);
  }

  function generatePromoCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'REWIND-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function handleGeneratePromo() {
    const percent = promoCustomValue || promoPercent;
    const code = generatePromoCode();
    (async () => {
      try {
        await fetch('/api/admin/create-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ discount: percent, code }),
        });
        setGeneratedCode(code);
        navigator.clipboard.writeText(code).catch(() => {});
      } catch {}
    })();
  }

  function getLastMessage(sessionId) {
    // We don't have last_message_text from sessions, so we'll show a preview
    const session = sessions.find(s => s.session_id === sessionId);
    return session?.last_message_text || session?.status || 'Click to view';
  }

  const selectedSession = selectedId ? sessions.find(s => s.session_id === selectedId) : null;

  return (
    <div style={{ display: 'flex', gap: '16px', maxWidth: '1000px' }}>
      {/* Session list */}
      <div style={{ flex: '0 0 260px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'visible', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sessions ({sessions.length})
          </span>
          <button onClick={() => { setChatRefreshing(true); loadSessions().finally(() => setChatRefreshing(false)); }}
            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--muted)', padding: '4px 8px', borderRadius: '6px', display: 'grid', placeItems: 'center' }}>
            {chatRefreshing ? (
              <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--muted)', animation: 'spin 0.6s linear infinite' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'transform 0.3s' }}>
                <path d="M2 8a6 6 0 0 1 11.4-2.8M14 8a6 6 0 0 1-11.4 2.8" />
                <path d="M13.5 2v3.5H10" />
              </svg>
            )}
          </button>
        </div>
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {sessions.map(s => (
            <div key={s.session_id}
              onClick={() => handleSelect(s.session_id)}
              onMouseEnter={(e) => setHoveredSession(s.session_id)}
              onMouseLeave={() => setHoveredSession(null)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--line)', background: selectedId === s.session_id ? 'var(--line)' : 'transparent', fontSize: '13px', position: 'relative' }}
              onMouseOver={e => { e.currentTarget.style.background = 'var(--line)'; }}
              onMouseOut={e => { e.currentTarget.style.background = selectedId === s.session_id ? 'var(--line)' : 'transparent'; }}>
              <div style={{ fontWeight: 600 }}>{s.customer_email || s.customer_name || 'Unknown'}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{s.status} · {new Date(s.last_message_at).toLocaleString()}</div>
              {/* Feature 1: Hover tooltip with last message preview */}
              {hoveredSession === s.session_id && (
                <div style={{
                  position: 'absolute', left: '100%', top: '0', zIndex: 100,
                  background: 'var(--ink)', color: 'var(--surface)', padding: '8px 12px',
                  borderRadius: '8px', fontSize: '12px', maxWidth: '220px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  marginLeft: '8px',
                }}>
                  {getLastMessage(s.session_id)}
                </div>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No chats yet</div>
          )}
        </div>
      </div>
      {/* Message area */}
      <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedId ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)', fontSize: '13px', fontWeight: 600 }}>
              <span>{selectedSession?.customer_email || selectedSession?.customer_name || 'Session'}</span>
              <button onClick={() => setShowCloseConfirm(true)}
                style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: 'var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--muted)', lineHeight: 1 }}
                aria-label="Close session">✕</button>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {messages.map((m, i) => (
                <div key={i}
                  className="admin-chat-msg"
                  style={{
                    alignSelf: m.sender === 'admin' ? 'flex-end' : 'flex-start',
                    background: m.sender === 'admin' ? 'var(--accent)' : m.sender === 'ai' ? '#E4DFD3' : '#F1EEE7',
                    color: m.sender === 'admin' ? '#fff' : '#16130F',
                    borderRadius: '10px', padding: '8px 12px', fontSize: '13px', maxWidth: '80%',
                    whiteSpace: 'pre-wrap',
                    boxShadow: m.sender === 'admin' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                    border: m.sender === 'ai' ? '1px dashed var(--line-2)' : 'none',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'; }}
                  onMouseOut={e => { e.currentTarget.style.boxShadow = m.sender === 'admin' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'; }}>
                  <div style={{ fontSize: '9px', opacity: 0.6, marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {m.sender === 'admin' ? 'You' : m.sender === 'ai' ? 'AI' : 'Customer'}
                  </div>
                  {m.message}
                  <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '10px', borderTop: '1px solid var(--line)' }}>
              <input value={reply} onChange={e => setReply(e.target.value.slice(0, 2000))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                placeholder="Type your reply..."
                style={{ flex: 1, border: '1px solid var(--line-2)', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }} />
              <button onClick={handleReply} disabled={sending || !reply.trim()}
                style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
                Send
              </button>
              {/* Feature 3: Close session button */}
              <button onClick={() => setShowCloseConfirm(true)}
                style={{ padding: '8px 12px', background: 'var(--line)', color: 'var(--muted)', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                Close session
              </button>
              {/* Feature 4: Block email button */}
              <button onClick={() => setShowBlockPanel(true)}
                style={{ padding: '8px 12px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                Block
              </button>
              {/* Feature 5: Give promo button */}
              <button onClick={() => setShowPromoPanel(true)}
                style={{ padding: '8px 12px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                Give promo
              </button>
            </div>
          {/* ── Close session modal ── */}
          {selectedId && selectedSession && showCloseConfirm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowCloseConfirm(false)}>
              <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', maxWidth: '360px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>Close session?</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Are you sure?</div>
                <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, marginBottom: '16px' }}>{selectedSession?.customer_email}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCloseConfirm(false)}
                    style={{ padding: '8px 16px', background: 'var(--line)', color: 'var(--ink)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleCloseConfirmed}
                    style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* ── Block email modal ── */}
          {selectedId && selectedSession && showBlockPanel && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => { setShowBlockPanel(false); setBlockReason(''); setBlockCustomReason(''); }}>
              <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', maxWidth: '360px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>Block customer</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>{selectedSession?.customer_email}</div>
                {blockMsg && <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', textAlign: 'center', color: blockMsg.startsWith('✅') ? '#2ecc71' : '#e74c3c' }}>{blockMsg}</div>}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {BLOCK_REASONS.map(r => (
                    <button key={r} onClick={() => setBlockReason(r)}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', border: 'none',
                        background: blockReason === r ? 'var(--accent)' : 'var(--line)',
                        color: blockReason === r ? '#fff' : 'var(--ink)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
                {blockReason === 'Other' && (
                  <input value={blockCustomReason} onChange={e => setBlockCustomReason(e.target.value)}
                    placeholder="Custom reason..." style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box' }} />
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowBlockPanel(false); setBlockReason(''); setBlockCustomReason(''); }}
                    style={{ padding: '8px 16px', background: 'var(--line)', color: 'var(--ink)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleBlock(blockReason)} disabled={!blockReason || (blockReason === 'Other' && !blockCustomReason.trim())}
                    style={{ padding: '8px 16px', background: blockReason && !(blockReason === 'Other' && !blockCustomReason.trim()) ? '#e74c3c' : 'var(--line-2)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, opacity: blockReason && !(blockReason === 'Other' && !blockCustomReason.trim()) ? 1 : 0.5 }}>
                    Block
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* ── Give promo modal ── */}
          {selectedId && selectedSession && showPromoPanel && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => { setShowPromoPanel(false); setGeneratedCode(''); setPromoCustomValue(''); }}>
              <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', maxWidth: '360px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>Give promo code</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>{selectedSession?.customer_email}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '40px' }}>{promoPercent}%</span>
                  <input type="range" min="5" max="50" value={promoPercent}
                    onChange={e => setPromoPercent(parseInt(e.target.value))}
                    style={{ flex: 1 }} />
                </div>
                <input value={promoCustomValue} onChange={e => setPromoCustomValue(e.target.value)}
                  placeholder="Custom value (e.g. 25%)" style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box' }} />
                {generatedCode && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 0' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{generatedCode}</span>
                    <button onClick={() => { navigator.clipboard.writeText(generatedCode).catch(() => {}); }}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                      Copy
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowPromoPanel(false); setGeneratedCode(''); setPromoCustomValue(''); }}
                    style={{ padding: '8px 16px', background: 'var(--line)', color: 'var(--ink)', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleGeneratePromo}
                    style={{ padding: '8px 16px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    {generatedCode ? 'Copied!' : 'Generate & copy'}
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            Select a session to view messages
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Blocked Emails & IPs Panel ── */
function BlockedPanel() {
  const [emails, setEmails] = useState([]);
  const [ips, setIps] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newIp, setNewIp] = useState('');
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  const loadAll = async () => {
    try {
      const [re, ri, ru] = await Promise.all([
        fetch('/api/admin/blocked-emails', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
        fetch('/api/admin/blocked-ips', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
        fetch('/api/admin/user-emails', { headers: { 'x-admin-token': localStorage.getItem('rw_admin_token') } }).then(r => r.json()),
      ]);
      setEmails(re.emails || []);
      setIps(ri.ips || []);
      setAllUsers(ru.emails || []);
    } catch {}
    setLoading(false);
  };

  React.useEffect(() => { loadAll(); }, []);

  const blockEmail = async (email) => {
    if (!email) return;
    await fetch('/api/admin/block-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ email }) });
    setNewEmail(''); loadAll();
  };

  const unblockEmail = async (email) => {
    await fetch('/api/admin/unblock-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ email }) });
    loadAll();
  };

  const blockIp = async (ip) => {
    if (!ip) return;
    await fetch('/api/admin/block-ip', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ ip }) });
    setNewIp(''); loadAll();
  };

  const unblockIp = async (ip) => {
    await fetch('/api/admin/unblock-ip', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': localStorage.getItem('rw_admin_token') }, body: JSON.stringify({ ip }) });
    loadAll();
  };

  const blockedEmails = new Set(emails.map(e => e.email));
  const unblockedUsers = allUsers.filter(email => !blockedEmails.has(email));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🚫 Blocked Emails</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>Blocked users will see a permanent notice when they try to checkout: <em>"Contact orders@rewind-stores.com to appeal."</em></p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input className="rw-input" placeholder="user@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newEmail.trim()) blockEmail(newEmail.trim()); }} />
          <button onClick={() => blockEmail(newEmail.trim())} disabled={!newEmail.trim()}
            style={{ padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>Block</button>
        </div>
        {loading ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p> : emails.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No blocked emails.</p>
        ) : emails.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: '13px' }}>{e.email}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{new Date(e.created_at).toLocaleDateString()}</span>
            <button onClick={() => unblockEmail(e.email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--accent)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.borderColor = 'var(--line-2)'; }}>Unblock</button>
          </div>
        ))}
      </div>

      {/* ── Blocked IPs ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>🚫 Blocked IPs</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>Blocked IPs will see a 403 page when accessing the site.</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input className="rw-input" placeholder="192.168.1.1" value={newIp} onChange={e => setNewIp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newIp.trim()) blockIp(newIp.trim()); }} />
          <button onClick={() => blockIp(newIp.trim())} disabled={!newIp.trim()}
            style={{ padding: '10px 20px', borderRadius: '999px', border: 'none', background: 'var(--accent)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>Block IP</button>
        </div>
        {loading ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p> : ips.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No blocked IPs.</p>
        ) : ips.map(ip => (
          <div key={ip.id || ip.ip_address} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{ip.ip_address}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{ip.created_at ? new Date(ip.created_at).toLocaleDateString() : ''}</span>
            <button onClick={() => unblockIp(ip.ip_address)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--accent)'; }}
              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.borderColor = 'var(--line-2)'; }}>Unblock</button>
          </div>
        ))}
      </div>

      {unblockedUsers.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>👥 All Users</h3>
          {unblockedUsers.map(email => (
            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: '13px' }}>{email}</span>
              <button onClick={() => blockEmail(email)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = 'var(--surface)'; e.target.style.borderColor = 'var(--accent)'; }}
                onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--accent)'; e.target.style.borderColor = 'var(--line-2)'; }}>Block</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Edit Product Panel ── */
function EditProductPanel({ product, onDone, setCustomProducts }) {
  const isCustomCat = product.cat && product.cat !== 'Other' && !REWIND_CATS.includes(product.cat);
  const [form, setForm] = React.useState(() => ({
    name: product.name || '', brand: product.brand || '', cat: product.cat || '',
    price: product.price?.toString() || '', was: product.was?.toString() || '',
    stock: product.stock?.toString() || '10', sizes: (product.sizes || ['S','M','L','XL']).join(','),
    material: product.material || '', note: product.note || '', hue: product.hue ?? 128,
  }));
  const [showCustomCat, setShowCustomCat] = React.useState(form.cat === 'Other' || isCustomCat);
  const [catCustom, setCatCustom] = React.useState(isCustomCat ? form.cat : '');
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const result = await updateCustomProduct(product.product_id || product.id, {
      name: form.name, brand: form.brand, cat: form.cat,
      price: parseFloat(form.price) || 0, was: form.was ? parseFloat(form.was) : null,
      stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 10 : n; })(),
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
      material: form.material || '', note: form.note || '', hue: form.hue,
    });
    setSaving(false);
    if (result) {
      setMsg('✅ Updated');
      getCustomProducts().then(setCustomProducts);
      setTimeout(onDone, 600);
    } else {
      setMsg('❌ Failed');
    }
  };

  const labelStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' };
  const inputStyle = { display: 'block', width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const btnStyle = { padding: '14px 28px', borderRadius: '999px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' };

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Edit product</div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{product.name}</h3>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{product.brand}{product.brand && product.cat ? ' · ' : ''}{product.cat}</div>
        </div>
        <button onClick={onDone}
          style={{ padding: '10px 18px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>← Back
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 600,
          background: msg.includes('✅') ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 10%, transparent)', color: msg.includes('✅') ? 'var(--ink)' : 'var(--accent)' }}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Image */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Product photo</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
            <div style={{ width: '160px', height: '200px', borderRadius: '12px', overflow: 'hidden', background: product.hue ? `hsl(${product.hue},50%,88%)` : 'var(--line)', flexShrink: 0 }}>
              {product.img
                ? <img src={product.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '13px', color: 'var(--muted)' }}>No photo</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'inline-block', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}
                onMouseOver={e => { e.target.style.background = 'var(--line)'; }}
                onMouseOut={e => { e.target.style.background = 'var(--surface)'; }}>
                📷 Upload new photo
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadProductImage(file, product.product_id || product.id);
                    if (url) { product.img = url; setSaving(v => v); setMsg('✅ Photo uploaded'); } else setMsg('❌ Upload failed');
                  }} />
              </label>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                Upload a new photo. Supported: JPG, PNG, WebP.
              </p>
            </div>
          </div>
        </div>

        {/* Name + Brand row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={labelStyle}>Product name</div>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle} placeholder="e.g. Vintage Nike Windbreaker" />
          </div>
          <div>
            <div style={labelStyle}>Brand</div>
            <input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} style={inputStyle} placeholder="e.g. Ralph Lauren" />
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Category</div>
          {(() => {
            const catOptions = [...REWIND_CATS.filter(c => c !== 'All')];
            if (isCustomCat) catOptions.push(product.cat);
            catOptions.push('Other');
            return (<>
            <select value={showCustomCat ? 'Other' : form.cat}
              onChange={e => {
                const newCat = e.target.value;
                // Reset sizes when switching between Shoes and other categories
                const sizesBefore = form.cat;
                const isNowShoes = newCat === 'Shoes';
                const wasShoes = sizesBefore === 'Shoes';
                const sizes = (isNowShoes !== wasShoes)
                  ? (isNowShoes ? '36,37,38,39,40,41,42,43,44,45,46,47' : 'S,M,L,XL')
                  : form.sizes;
                setForm({...form, cat: newCat, sizes});
                setShowCustomCat(newCat === 'Other');
                if (newCat !== 'Other') setCatCustom('');
              }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
              {catOptions.map(c => <option key={c} value={c === product.cat && isCustomCat ? 'Other' : c}>{c}</option>)}
            </select>
            {showCustomCat && (
              <input style={{ marginTop: '8px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', width: '100%' }}
                placeholder="Custom category name"
                value={catCustom}
                onChange={e => { setCatCustom(e.target.value); setForm({...form, cat: e.target.value}); }} />
            )}
            </>);
          })()}
        </div>

        {/* Price row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={labelStyle}>Current price (€)</div>
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} style={inputStyle} placeholder="95.00" />
          </div>
          <div>
            <div style={labelStyle}>Original price (€)</div>
            <input type="number" step="0.01" value={form.was} onChange={e => setForm({...form, was: e.target.value})} style={inputStyle} placeholder="120.00" />
          </div>
        </div>

        {/* Stock */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Stock (shows "Only X left" when ≤ 5)</div>
          <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} style={{...inputStyle, maxWidth: '120px'}} />
        </div>

        {/* Sizes */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Sizes</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(form.cat === 'Shoes' ? ['36','37','38','39','40','41','42','43','44','45','46','47'] : ['XS','S','M','L','XL','XXL']).map(s => {
              const active = form.sizes.split(',').map(x => x.trim()).includes(s);
              return (
                <button key={s} type="button" onClick={() => {
                  const current = form.sizes.split(',').map(x => x.trim()).filter(Boolean);
                  const next = active ? current.filter(x => x !== s) : [...current, s];
                  setForm({...form, sizes: next.join(',')});
                }}
                  style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    border: active ? '2px solid var(--ink)' : '1px solid var(--line-2)',
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!active) { e.target.style.borderColor = 'var(--line)'; e.target.style.transform = 'scale(1.05)'; } }}
                  onMouseOut={e => { if (!active) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; } }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hue color picker */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Color swatch</div>
          <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)' }}>Background tint for the product card & page</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 20, 38, 96, 128, 158, 188, 200, 210, 232, 248, 280, 300, 330, 350].map(h => (
              <button key={h} type="button" onClick={() => setForm({...form, hue: h})}
                title={`Hue ${h}°`}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: form.hue === h ? '3px solid var(--ink)' : '2px solid transparent',
                  background: `hsl(${h},60%,80%)`,
                  cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s',
                  transform: form.hue === h ? 'scale(1.15)' : 'scale(1)',
                  outline: 'none',
                }}
                onMouseOver={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1.12)'; e.target.style.borderColor = 'var(--line-2)'; } }}
                onMouseOut={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1)'; e.target.style.borderColor = 'transparent'; } }} />
            ))}
          </div>
          <div style={{ marginTop: '6px', width: '48px', height: '12px', borderRadius: '4px', background: `hsl(${form.hue},60%,80%)` }} />
        </div>

        {/* Material */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Material</div>
          <input value={form.material} onChange={e => setForm({...form, material: e.target.value})} style={inputStyle} placeholder="e.g. 100% cotton pique, fleece" />
        </div>

        {/* Description / note */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Description</div>
          <textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})}
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
            placeholder="Product description shown on the product detail page. e.g. Vintage argyle pattern, button front." />
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button type="submit" disabled={saving}
            style={{...btnStyle, background: saving ? 'var(--line-2)' : 'var(--ink)', cursor: saving ? 'default' : 'pointer', transition: 'all 0.15s' }}
            onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button type="button" onClick={onDone}
            style={{ padding: '14px 28px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── First-visit survey ── */
function ProductForm({ editProduct, onClearEdit, customProducts, setCustomProducts }) {
  const [form, setForm] = React.useState({
    name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360)
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [showCustomCat, setShowCustomCat] = React.useState(false);
  const [showProduct, setShowProduct] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const fileRef = React.useRef(null);
  const catOptions = [...REWIND_CATS.filter(c => c !== 'All'), 'Other'];

  // Memoize the preview blob URL so it's not recreated on every keystroke.
  // Without this, each form-field change re-renders the component and calls
  // URL.createObjectURL() again, leaking blob URLs until the page is reloaded.
  const previewUrl = React.useMemo(() => {
    return form.file ? URL.createObjectURL(form.file) : null;
  }, [form.file]);
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Load product for editing when editProduct prop changes
  React.useEffect(() => {
    if (editProduct) {
      setForm({
        name: editProduct.name || '', brand: editProduct.brand || '', cat: editProduct.cat || '',
        catCustom: '', price: editProduct.price?.toString() || '', was: editProduct.was?.toString() || '',
        stock: editProduct.stock?.toString() || '10', sizes: (editProduct.sizes || ['S','M','L','XL']).join(','),
        material: editProduct.material || '', note: editProduct.note || '', file: null, files: [],
        hue: editProduct.hue ?? Math.floor(Math.random() * 360),
      });
      setEditingId(editProduct.product_id || editProduct.id);
      setMsg('✏️ Editing: ' + editProduct.name);
    }
  }, [editProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const cat = form.cat === 'Other' ? form.catCustom : form.cat;
    if (!form.name || !cat || !form.price) {
      setMsg('❌ Name, category, and price are required'); setSaving(false); return;
    }
    const productId = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const product = {
      product_id: productId, name: form.name, brand: form.brand || '', cat,
      price: parseFloat(form.price), was: form.was ? parseFloat(form.was) : null,
      stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 5 : n; })(), hue: form.hue ?? Math.floor(Math.random() * 360), img: '', note: form.note || '',
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
    };
    // Upload images if selected
    if (form.files?.length) {
      const images = [];
      const url = await uploadProductImage(form.files[0], productId);
      if (url) { product.img = url; images.push(url); }
      for (let i = 1; i < form.files.length; i++) {
        const extraUrl = await uploadProductImage(form.files[i], `${productId}-${i}`);
        if (extraUrl) images.push(extraUrl);
      }
      product.images = images;
    }
    // Save or update
    if (editingId) {
      const result = await updateCustomProduct(editingId, { name: form.name, brand: form.brand, cat, price: parseFloat(form.price), was: form.was ? parseFloat(form.was) : null, stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 10 : n; })(), sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean), material: form.material || '', note: form.note || '', ...(product.img ? { img: product.img } : {}), ...(product.images?.length ? { images: product.images } : {}) });
      if (result) {
        setMsg(`✅ "${form.name}" updated!`);
        setEditingId(null);
        if (onClearEdit) onClearEdit();
        setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360) });
        getCustomProducts().then(setCustomProducts);
      } else { setMsg('❌ Failed to update.'); }
    } else {
      const result = await addCustomProduct(product);
      if (result) {
        setMsg(`✅ "${form.name}" added! `);
        setShowProduct(productId);
        setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360) });
        if (fileRef.current) fileRef.current.value = '';
        getCustomProducts().then(setCustomProducts);
      } else { setMsg('❌ Failed to save.'); }
    }
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', marginBottom: '28px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
        {editingId ? '✏️ Edit product' : '📦 Add new product'}
        {editingId && <button onClick={() => { setEditingId(null); setForm({ name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360) }); if (onClearEdit) onClearEdit(); }}
          style={{ marginLeft: '10px', padding: '4px 10px', borderRadius: '6px', background: 'var(--line)', border: 'none', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s' }}
          onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>Cancel edit</button>}
      </h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <input className="rw-input" placeholder="Product name *" value={form.name}
            onChange={e => setForm({...form, name: e.target.value})} required />
          <input className="rw-input" placeholder="Brand (e.g. Nike)" value={form.brand}
            onChange={e => setForm({...form, brand: e.target.value})} />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <select className="rw-input"
            value={showCustomCat ? 'Other' : form.cat}
            onChange={e => {
              const newCat = e.target.value;
              // Reset sizes when switching between Shoes and other categories
              // so the size picker buttons match the visible options
              const sizesBefore = form.cat;
              const isNowShoes = newCat === 'Shoes';
              const wasShoes = sizesBefore === 'Shoes';
              const sizes = (isNowShoes !== wasShoes)
                ? (isNowShoes ? '36,37,38,39,40,41,42,43,44,45,46,47' : 'S,M,L,XL')
                : form.sizes;
              setForm({...form, cat: newCat, sizes});
              setShowCustomCat(newCat === 'Other');
            }}>
            <option value="">Select category *</option>
            {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {showCustomCat && (
            <input className="rw-input" placeholder="New category name" value={form.catCustom}
              onChange={e => setForm({...form, catCustom: e.target.value})} />
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <input className="rw-input" type="number" step="0.01" placeholder="Price * (€)" value={form.price}
            onChange={e => setForm({...form, price: e.target.value})} required />
          <input className="rw-input" type="number" step="0.01" placeholder="Original price (€)" value={form.was}
            onChange={e => setForm({...form, was: e.target.value})} />
        </div>
        <input className="rw-input" type="number" min="0" placeholder="Stock (e.g. 3)" value={form.stock}
          onChange={e => setForm({...form, stock: e.target.value})} style={{ marginBottom: '12px' }} />
        {/* ── Size picker buttons ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>Sizes — click to toggle</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(form.cat === 'Shoes' ? ['36','37','38','39','40','41','42','43','44','45','46','47'] : ['XS','S','M','L','XL','XXL']).map(s => {
              const active = form.sizes.split(',').map(x => x.trim()).includes(s);
              return (
                <button key={s} type="button" onClick={() => {
                  const current = form.sizes.split(',').map(x => x.trim()).filter(Boolean);
                  const next = active ? current.filter(x => x !== s) : [...current, s];
                  setForm({...form, sizes: next.join(',')});
                }}
                  style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    border: active ? '2px solid var(--ink)' : '1px solid var(--line-2)',
                    background: active ? 'var(--ink)' : 'var(--surface)',
                    color: active ? 'var(--bg)' : 'var(--muted)',
                    cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { if (!active) { e.target.style.borderColor = 'var(--line)'; e.target.style.transform = 'scale(1.05)'; } }}
                  onMouseOut={e => { if (!active) { e.target.style.borderColor = 'var(--line-2)'; e.target.style.transform = ''; } }}>
                  {s}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            {form.sizes.split(',').map(x => x.trim()).filter(Boolean).length || 0} size{form.sizes.split(',').filter(Boolean).length !== 1 ? 's' : ''} selected
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          <input className="rw-input" placeholder="Material (e.g. 100% cotton, fleece)" value={form.material}
            onChange={e => setForm({...form, material: e.target.value})} />
        </div>
        {/* ── Hue color picker ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Color swatch</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>— pick the background tint for the product card</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[0, 20, 38, 96, 128, 158, 188, 200, 210, 232, 248, 280, 300, 330, 350].map(h => (
              <button key={h} type="button" onClick={() => setForm({...form, hue: h})}
                title={`Hue ${h}°`}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: form.hue === h ? '2px solid var(--ink)' : '2px solid transparent',
                  background: `hsl(${h},60%,80%)`,
                  cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s',
                  transform: form.hue === h ? 'scale(1.2)' : 'scale(1)',
                  outline: 'none',
                }}
                onMouseOver={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1.15)'; e.target.style.borderColor = 'var(--line-2)'; } }}
                onMouseOut={e => { if (form.hue !== h) { e.target.style.transform = 'scale(1)'; e.target.style.borderColor = 'transparent'; } }} />
            ))}
          </div>
        </div>
        <textarea className="rw-input" placeholder="Description / product notes (appears on product page)"
          value={form.note}
          onChange={e => setForm({...form, note: e.target.value})}
          rows={3}
          style={{ marginBottom: '12px', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
          {form.file && (<div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button"
              onClick={async () => {
                const reader = new FileReader();
                reader.onload = () => {
                  const prompt = "I'm listing a vintage streetwear item. Look at this photo and describe only the product. Do NOT mention the filename, 'WhatsApp', 'image', or any file metadata. Respond with:\n\nTITLE: (short product name, max 6 words)\nDESCRIPTION: (2-3 sentences describing the item — material, era, colors, style, brand clues)\n\nOnly respond with the title and description, nothing else.";
                  navigator.clipboard.writeText(prompt);
                  window.open('https://gemini.google.com/app', '_blank');
                  setMsg('✅ Prompt copied! Paste it into Gemini (tab opened). Then copy the response back here.');
                };
                reader.readAsDataURL(form.file);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--accent)'; e.target.style.transform = ''; }}>
              📋 Copy to Gemini
            </button>
            <button type="button"
              onClick={async () => {
                const reader = new FileReader();
                reader.onload = () => {
                  const prompt = "Enhance this product photo for a streetwear store listing. Remove any creases and wrinkles from the fabric. Make the background pure white (#FAF6EF). Improve contrast and lighting so the item pops. Keep the product exactly as it is — just make it look professionally photographed.";
                  navigator.clipboard.writeText(prompt);
                  window.open('https://gemini.google.com/app', '_blank');
                  setMsg('✅ Enhancement prompt copied! Paste into Gemini (tab opened) along with your photo.');
                };
                reader.readAsDataURL(form.file);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid color-mix(in oklab, var(--ink) 30%, transparent)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; e.target.style.transform = ''; }}>
              🎨 Enhance photo
            </button>
            <button type="button"
              onClick={async () => {
                const btn = document.activeElement;
                const orig = btn.textContent;
                btn.disabled = true;
                btn.textContent = '⏳ Generating...';
                try {
                  const img = new Image();
                  const url = URL.createObjectURL(form.file);
                  const base64 = await new Promise((resolve) => {
                    img.onload = () => {
                      const c = document.createElement('canvas');
                      let w = img.width, h = img.height;
                      const m = 1200;
                      if (w > m || h > m) { if (w > h) { h = Math.round(h*m/w); w = m; } else { w = Math.round(w*m/h); h = m; } }
                      c.width = w; c.height = h;
                      c.getContext('2d').drawImage(img, 0, 0, w, h);
                      resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  });
                  const r = await fetch('/api/generate-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64 }) });
                  const d = await r.json();
                  if (d.description || d.title) {
                    setForm(prev => ({ ...prev, name: d.title || prev.name, note: d.description || '' }));
                    btn.textContent = '✅ Generated';
                  } else {
                    btn.textContent = '❌ ' + ((d.error || '').slice(0, 30) || 'Failed');
                    setMsg('❌ AI Error: ' + (d.error || 'Failed'));
                  }
                } catch (e) {
                  btn.textContent = '❌ Error';
                  setMsg('❌ Network Error: ' + e.message);
                }
                setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
              }}
              style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: 'var(--ink)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
              ✨ Generate from photo
            </button>
            </div>
          </div>)}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{
            display: 'inline-block',
            padding: '10px 20px',
            borderRadius: '999px',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 4px 12px color-mix(in oklab, var(--accent) 40%, transparent)'; }}
            onMouseOut={e => { e.target.style.transform = ''; e.target.style.boxShadow = ''; }}>
            📁 Choose files
            <input ref={fileRef} type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.pdf,.svg"
              multiple
              onChange={e => {
                const files = Array.from(e.target.files);
                setForm({...form, file: files[0] || null, files});
              }}
              style={{ display: 'none' }} />
          </label>
          {form.files?.length > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
              {form.files.length} file{form.files.length > 1 ? 's' : ''} selected
              {form.files.map((f, i) => (
                <span key={i} style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {form.file && (
          <div style={{ marginTop: '16px', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', background: 'var(--bg)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>📱 Storefront preview</p>
            <div style={{ background: 'var(--surface)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ background: form.hue ? `hsl(${form.hue},60%,85%)` : 'var(--line)', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {previewUrl ? <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} /> : <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Upload a photo</span>}
              </div>
              <div style={{ padding: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>{form.cat?.toUpperCase() || 'CATEGORY'}</span>
                {form.brand && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>— {form.brand}</span>}
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '4px 0 2px', color: 'var(--ink)' }}>{form.name || 'Product name'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{form.price ? `€${form.price}` : '€--'}</span>
                  {form.was && <span style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>€{form.was}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {form.sizes.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '11px', color: 'var(--muted)' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            {form.note && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontStyle: 'italic' }}>{form.note}</p>}
          </div>
        )}
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600,
            background: msg.includes('✅') ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 10%, transparent)',
            color: msg.includes('✅') ? 'var(--ink)' : 'var(--accent)',
          }}>
            {msg}
          {showProduct && <button onClick={() => { window.location.hash = '#/product/' + showProduct; window.location.reload(); }}
            style={{ marginLeft: '8px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>
            👁 View on store
          </button>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="submit" disabled={saving}
        style={{ padding: '10px 20px', borderRadius: '999px', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.15s' }}
        onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
        onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
        {saving ? 'Saving...' : editingId ? '💾 Save changes' : '➕ Add product'}
        </button>
        </div>
      </form>
    </div>
  );
}

/* ── Audit Log Panel ── */
function AuditLogPanel({ adminToken }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/admin/audit-log', { headers: { 'x-admin-token': adminToken } });
      const d = await r.json();
      setEntries(Array.isArray(d.entries) ? d.entries : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [adminToken]);

  const actionLabels = {
    block_email: '🚫 Blocked email',
    unblock_email: '✅ Unblocked email',
    block_ip: '🚫 Blocked IP',
    unblock_ip: '✅ Unblocked IP',
    cancel_order: '✕ Cancelled order',
    create_promo: '🎁 Created promo code',
  };

  async function blockEmail(email) {
    if (!window.confirm(`Block ${email} from the store?`)) return;
    await fetch('/api/admin/block-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ email }),
    });
    setMsg(`🚫 ${email} blocked`);
    setTimeout(() => setMsg(''), 3000);
  }

  async function unblockEmail(email) {
    if (!window.confirm(`Unblock ${email}?`)) return;
    await fetch('/api/admin/unblock-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ email }),
    });
    setMsg(`✅ ${email} unblocked`);
    setTimeout(() => setMsg(''), 3000);
  }

  async function blockIp(ip) {
    if (!window.confirm(`Block IP ${ip}?`)) return;
    await fetch('/api/admin/block-ip', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ ip }),
    });
    setMsg(`🚫 IP ${ip} blocked`);
    setTimeout(() => setMsg(''), 3000);
  }

  // Guess what type of detail this is — email or IP
  function isEmail(v) { return /^\S+@\S+\.\S+$/.test(v); }
  function isIp(v) { return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v); }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>📜 Admin audit trail</h3>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{entries.length} entries</span>
      </div>
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, background: 'color-mix(in oklab, var(--ink) 12%, transparent)', color: 'var(--ink)' }}>
          {msg}
        </div>
      )}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p>
      ) : entries.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No audit entries yet. They appear after admin actions (blocks, cancels, promo codes).</p>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: 'var(--line)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>When</th>
              <th style={{ padding: '8px 12px' }}>Action</th>
              <th style={{ padding: '8px 12px' }}>Details</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr></thead>
            <tbody>
              {entries.map(e => {
                const detail = e.details || '';
                const showBlockEmail = isEmail(detail) && e.action !== 'block_email' && e.action !== 'unblock_email';
                const showBlockIp = isIp(detail) && e.action !== 'block_ip' && e.action !== 'unblock_ip';
                const showUnblockEmail = e.action === 'block_email' && isEmail(detail);
                const isAlreadyBlockedAction = e.action === 'block_email' || e.action === 'block_ip';
                return (
                <tr key={e.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '12px' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{actionLabels[e.action] || e.action}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {detail || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    {showBlockEmail && (
                      <button onClick={() => blockEmail(detail)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}
                        onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff'; }}
                        onMouseOut={e => { e.target.style.background = 'color-mix(in oklab, var(--accent) 15%, transparent)'; e.target.style.color = 'var(--accent)'; }}>
                        🚫 Block
                      </button>
                    )}
                    {showBlockIp && (
                      <button onClick={() => blockIp(detail)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}
                        onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff'; }}
                        onMouseOut={e => { e.target.style.background = 'color-mix(in oklab, var(--accent) 15%, transparent)'; e.target.style.color = 'var(--accent)'; }}>
                        🚫 Block IP
                      </button>
                    )}
                    {showUnblockEmail && (
                      <button onClick={() => unblockEmail(detail)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--ink)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s' }}
                        onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; }}
                        onMouseOut={e => { e.target.style.background = 'var(--surface)'; e.target.style.color = 'var(--ink)'; }}>
                        ✅ Unblock
                      </button>
                    )}
                    {!showBlockEmail && !showBlockIp && !showUnblockEmail && isAlreadyBlockedAction && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Done</span>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;

/* ── Create promo code form ── */
function CreatePromoCode({ showToast }) {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(10);
  const [maxUses, setMaxUses] = useState(50);
  const [expiresIn, setExpiresIn] = useState(90);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleCreate = async () => {
    if (!code.trim()) { setMsg('Enter a code'); return; }
    setLoading(true); setMsg('');
    try {
      const r = await fetch('/api/admin/create-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), discount: Number(discount), label: `${Number(discount)}% off` }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg('✅ Promo code ' + code.trim().toUpperCase() + ' created!');
        setCode('');
        if (showToast) showToast('Promo code created');
      } else {
        setMsg(d.error || 'Failed to create');
      }
    } catch { setMsg('Network error'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Code</label>
          <input className="rw-input" placeholder="e.g. SUMMER20" value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Discount %</label>
            <input className="rw-input" type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={1} max={100} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max uses</label>
            <input className="rw-input" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} min={1} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Expires (days)</label>
            <input className="rw-input" type="number" value={expiresIn} onChange={e => setExpiresIn(e.target.value)} min={1} style={{ width: '100%' }} />
          </div>
        </div>
        <button className="rw-btn rw-btn-pri" onClick={handleCreate} disabled={loading} style={{ padding: '12px', fontSize: '14px' }}>
          {loading ? 'Creating...' : 'Create promo code'}
        </button>
        {msg && <p style={{ fontSize: '13px', margin: 0 }}>{msg}</p>}
      </div>
    </div>
  );
}
