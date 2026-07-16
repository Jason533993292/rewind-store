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
  const [adminToken] = useState('');
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
        
      }).then(r => {
        if (!r.ok) { console.error('Verify-admin status:', r.status); return { verified: false }; }
        return r.json();
      }).then(d => {
        if (d.verified) {
          if (d.sessionToken) 
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

       

... [OUTPUT TRUNCATED - 93,296 chars omitted out of 143,222 total] ...

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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setMsg(`🚫 ${email} blocked`);
    setTimeout(() => setMsg(''), 3000);
  }

  async function unblockEmail(email) {
    if (!window.confirm(`Unblock ${email}?`)) return;
    await fetch('/api/admin/unblock-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setMsg(`✅ ${email} unblocked`);
    setTimeout(() => setMsg(''), 3000);
  }

  async function blockIp(ip) {
    if (!window.confirm(`Block IP ${ip}?`)) return;
    await fetch('/api/admin/block-ip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      if (d.code) {
        setMsg('✅ Promo code ' + d.code + ' created!');
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