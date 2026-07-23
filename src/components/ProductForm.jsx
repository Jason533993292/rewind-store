import React, { useState, useRef, useMemo } from 'react';
import { addCustomProduct, getCustomProducts, updateCustomProduct, uploadProductImage } from '../lib/supabase';
import { REWIND_CATS } from '../data';

export default function ProductForm({ editProduct, onClearEdit, customProducts, setCustomProducts }) {
  const [form, setForm] = useState({
    name: '', brand: '', cat: '', catCustom: '', price: '', was: '', stock: 10, sizes: 'S,M,L,XL', material: '', note: '', file: null, files: [], hue: Math.floor(Math.random() * 360)
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [showProduct, setShowProduct] = useState(null);
  const [editingId, setEditingId] = useState(null);
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
          {showProduct && <button onClick={() => { nav('/product/' + showProduct); }}
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


