import React, { useState } from 'react';
import { getCustomProducts, updateCustomProduct, uploadProductImage } from '../lib/supabase';
import { REWIND_CATS } from '../data';

export default function EditProductPanel({ product, onDone, setCustomProducts }) {
  const isCustomCat = product.cat && product.cat !== 'Other' && !REWIND_CATS.includes(product.cat);
  const [form, setForm] = useState(() => ({
    name: product.name || '', brand: product.brand || '', cat: product.cat || '',
    price: product.price?.toString() || '', was: product.was?.toString() || '',
    stock: product.stock?.toString() || '10', sizes: (product.sizes || ['S','M','L','XL']).join(','),
    material: product.material || '', note: product.note || '', hue: product.hue ?? 128,
  }));
  const [showCustomCat, setShowCustomCat] = useState(form.cat === 'Other' || isCustomCat);
  const [catCustom, setCatCustom] = useState(isCustomCat ? form.cat : '');
  const [images, setImages] = useState(() => {
    const imgs = product.imgs || product.img;
    if (Array.isArray(imgs)) return imgs;
    if (typeof imgs === 'string' && imgs.startsWith('[')) {
      try { return JSON.parse(imgs); } catch { return imgs ? [imgs] : []; }
    }
    return imgs ? [imgs] : [];
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg('');
    const result = await updateCustomProduct(product.product_id || product.id, {
      name: form.name, brand: form.brand, cat: form.cat, imgs: JSON.stringify(images),
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
        {/* Photos (multi-image) */}
        <div style={{ marginBottom: '28px' }}>
          <div style={labelStyle}>Product photos</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {images.map((url, i) => (
              <div key={url} style={{ position: 'relative', width: '100px', height: '130px', borderRadius: '10px', overflow: 'visible', background: '#f0f0f0', flexShrink: 0, border: '2px solid var(--line-2)' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: '13px', display: 'grid', placeItems: 'center', lineHeight: '1', zIndex: 2 }}>&times;</button>
                {i > 0 && <button type="button" onClick={() => { const a = [...images]; [a[i-1], a[i]] = [a[i], a[i-1]]; setImages(a); }}
                  style={{ position: 'absolute', top: '50%', left: '-1px', transform: 'translateY(-50%)', width: '22px', height: '40px', borderRadius: '0 6px 6px 0', border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', fontSize: '12px', display: 'grid', placeItems: 'center', zIndex: 2 }}>&lsaquo;</button>}
                {i < images.length - 1 && <button type="button" onClick={() => { const a = [...images]; [a[i], a[i+1]] = [a[i+1], a[i]]; setImages(a); }}
                  style={{ position: 'absolute', top: '50%', right: '-1px', transform: 'translateY(-50%)', width: '22px', height: '40px', borderRadius: '6px 0 0 6px', border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', fontSize: '12px', display: 'grid', placeItems: 'center', zIndex: 2 }}>&rsaquo;</button>}
                <div style={{ position: 'absolute', top: '4px', left: '4px', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: '4px', padding: '1px 6px', lineHeight: '1.4', zIndex: 1 }}>{i + 1}</div>
              </div>
            ))}
            <label style={{ width: '100px', height: '130px', borderRadius: '10px', border: '2px dashed var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', color: 'var(--muted)', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.color = 'var(--muted)'; }}>
              +
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadProductImage(file, product.product_id || product.id);
                  if (url) { setImages(prev => [...prev, url]); setMsg('✅ Photo added'); } else setMsg('❌ Upload failed');
                }} />
            </label>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
            Upload multiple photos. Use the arrow buttons to reorder. The first photo is the main product image.
          </p>
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

