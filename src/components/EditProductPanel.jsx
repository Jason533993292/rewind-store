import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCustomProducts, updateCustomProduct, uploadProductImage } from '../lib/supabase';
import { REWIND_CATS } from '../data';

// ── Inline validation helpers ──
const required = v => v.trim() ? '' : 'Required';
const isNum = v => !isNaN(parseFloat(v)) && isFinite(v) ? '' : 'Must be a number';
const isPrice = v => v && !isNum(v) ? 'Invalid price' : '';

function validate(form) {
  const errs = {};
  if (!form.name.trim()) errs.name = 'Product name is required';
  if (!form.cat.trim()) errs.cat = 'Category is required';
  if (!form.price || parseFloat(form.price) <= 0) errs.price = 'Enter a valid price';
  return errs;
}

const labelStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' };
const inputStyle = { display: 'block', width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const btnStyle = { padding: '14px 28px', borderRadius: '999px', background: 'var(--ink)', color: 'var(--surface)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' };

export default function EditProductPanel({ product, onDone, setCustomProducts, onDuplicate }) {
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
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const fileRef = useRef(null);
  const isCatalogProduct = !product.product_id && REWIND_CATS.length > 0;
  const dirtyRef = useRef(false);

  // Track dirty state
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  // ── Unsaved changes guard ──
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Mark dirty on first change
  const setFormDirty = useCallback((updater) => {
    setForm(prev => { const next = typeof updater === 'function' ? updater(prev) : {...prev, ...updater}; return next; });
    setDirty(true);
  }, []);

  // ── Inline validation on blur ──
  const handleBlur = (field) => {
    const e = validate(form);
    setErrors(prev => ({...prev, [field]: e[field] || ''}));
  };

  // ── Save ──
  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) { setMsg('❌ Fix the highlighted fields before saving'); return; }
    if (isCatalogProduct) {
      setMsg('❌ Catalog products cannot be edited here — add a custom product instead');
      return;
    }
    setSaving(true); setMsg('');
    const result = await updateCustomProduct(product.id || product.product_id, {
      name: form.name, brand: form.brand, cat: form.cat, imgs: JSON.stringify(images),
      price: parseFloat(form.price) || 0, was: form.was ? parseFloat(form.was) : null,
      stock: (() => { const n = parseInt(form.stock); return isNaN(n) ? 10 : n; })(),
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
      material: form.material || '', note: form.note || '', hue: form.hue,
    });
    setSaving(false);
    if (result) {
      setMsg('✅ Updated');
      setDirty(false);
      getCustomProducts().then(setCustomProducts);
      setTimeout(onDone, 600);
    } else {
      setMsg('❌ Save failed — check console (F12) for details');
    }
  };

  // ── Drag-and-drop image reorder ──
  const handleDragStart = (i) => setDragIndex(i);
  const handleDragOver = (e, i) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    const a = [...images];
    const [moved] = a.splice(dragIndex, 1);
    a.splice(i, 0, moved);
    setImages(a);
    setDragIndex(i);
  };
  const handleDragEnd = () => setDragIndex(null);

  // ── Quick-duplicate ──
  const handleDuplicate = async () => {
    const dupe = {
      name: form.name + ' (copy)', brand: form.brand, cat: form.cat,
      imgs: JSON.stringify(images), price: parseFloat(form.price) || 0,
      was: form.was ? parseFloat(form.was) : null,
      stock: parseInt(form.stock) || 10,
      sizes: form.sizes.split(',').map(s => s.trim()).filter(Boolean),
      material: form.material || '', note: form.note || '', hue: form.hue,
    };
    // Direct Supabase insert via API
    try {
      const r = await fetch('/api/admin/products/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dupe),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg('✅ Duplicated');
        getCustomProducts().then(setCustomProducts);
        if (onDuplicate) onDuplicate(d.data);
      } else {
        setMsg('❌ Duplicate failed');
      }
    } catch { setMsg('❌ Duplicate failed'); }
  };

  // ── Live preview card ──
  const previewPrice = parseFloat(form.price) || 0;
  const previewWas = form.was ? parseFloat(form.was) : null;
  const previewSale = previewWas && previewWas > previewPrice;
  const previewStock = parseInt(form.stock) || 10;
  const sizes = form.cat === 'Shoes'
    ? ['36','37','38','39','40','41','42','43','44','45','46','47']
    : ['XS','S','M','L','XL','XXL'];
  const activeSizes = form.sizes.split(',').map(x => x.trim()).filter(Boolean);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '32px', maxWidth: '960px' }}>
      {/* ── Main form ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Edit product</div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{product.name}</h3>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{product.brand}{product.brand && product.cat ? ' · ' : ''}{product.cat}</div>
          </div>
          <button onClick={onDone}
            style={{ padding: '10px 18px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
            onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}>← Back</button>
        </div>

        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 600,
            background: msg.includes('✅') ? 'color-mix(in oklab, var(--ink) 12%, transparent)' : 'color-mix(in oklab, var(--accent) 10%, transparent)', color: msg.includes('✅') ? 'var(--ink)' : 'var(--accent)' }}>
            {msg}
          </div>
        )}

        {dirty && (
          <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600,
            background: 'color-mix(in oklab, #f59e0b 15%, transparent)', color: '#92400e' }}>
            ⚠️ Unsaved changes. Save or they'll be lost.
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Photos */}
          <div style={{ marginBottom: '28px' }}>
            <div style={labelStyle}>Product photos</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {images.map((url, i) => (
                <div key={url}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  style={{
                    position: 'relative', width: '100px', height: '130px', borderRadius: '10px', overflow: 'visible',
                    background: '#f0f0f0', flexShrink: 0, border: dragIndex === i ? '2px dashed var(--accent)' : '2px solid var(--line-2)',
                    transition: 'border 0.15s', cursor: 'grab',
                  }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: '13px', display: 'grid', placeItems: 'center', lineHeight: '1', zIndex: 2 }}>&times;</button>
                  <div style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '10px', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: '1px 6px', lineHeight: '1.4', zIndex: 1 }}>{i + 1}</div>
                </div>
              ))}
              <label style={{ width: '100px', height: '130px', borderRadius: '10px', border: '2px dashed var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px', color: 'var(--muted)', flexShrink: 0, transition: 'all 0.15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.color = 'var(--muted)'; }}>
                +
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    for (const file of files) {
                      const url = await uploadProductImage(file, product.id || product.product_id);
                      if (url) { setImages(prev => [...prev, url]); setMsg('✅ Photo added'); setDirty(true); } else setMsg('❌ Upload failed');
                    }
                  }} />
              </label>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
              Drag thumbnails to reorder. First photo = main image. Drop new files onto the "+" box.
            </p>
          </div>

          {/* Name + Brand */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{...labelStyle, color: errors.name ? 'var(--accent)' : 'var(--ink)'}}>Product name *</div>
              <input value={form.name} onChange={e => { setFormDirty({...form, name: e.target.value}); setErrors(prev => ({...prev, name: ''})); }}
                onBlur={() => handleBlur('name')}
                style={{...inputStyle, borderColor: errors.name ? 'var(--accent)' : 'var(--line-2)'}} placeholder="e.g. Vintage Nike Windbreaker" />
              {errors.name && <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>{errors.name}</div>}
            </div>
            <div>
              <div style={labelStyle}>Brand</div>
              <input value={form.brand} onChange={e => setFormDirty({...form, brand: e.target.value})} style={inputStyle} placeholder="e.g. Ralph Lauren" />
            </div>
          </div>

          {/* Category dropdown */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{...labelStyle, color: errors.cat ? 'var(--accent)' : 'var(--ink)'}}>Category *</div>
            {(() => {
              const catOptions = [...REWIND_CATS.filter(c => c !== 'All')];
              if (isCustomCat) catOptions.push(product.cat);
              catOptions.push('Other');
              return (<>
              <select value={showCustomCat ? 'Other' : form.cat}
                onChange={e => {
                  const newCat = e.target.value;
                  const sizesBefore = form.cat;
                  const isNowShoes = newCat === 'Shoes';
                  const wasShoes = sizesBefore === 'Shoes';
                  const sizes = (isNowShoes !== wasShoes)
                    ? (isNowShoes ? '36,37,38,39,40,41,42,43,44,45,46,47' : 'S,M,L,XL')
                    : form.sizes;
                  setFormDirty({...form, cat: newCat, sizes});
                  setShowCustomCat(newCat === 'Other');
                  setErrors(prev => ({...prev, cat: ''}));
                  if (newCat !== 'Other') setCatCustom('');
                }}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${errors.cat ? 'var(--accent)' : 'var(--line-2)'}`, background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer' }}>
                {catOptions.map(c => <option key={c} value={c === product.cat && isCustomCat ? 'Other' : c}>{c}</option>)}
              </select>
              {showCustomCat && (
                <input style={{ marginTop: '8px', ...inputStyle }}
                  placeholder="Custom category name"
                  value={catCustom}
                  onChange={e => { setCatCustom(e.target.value); setFormDirty({...form, cat: e.target.value}); }} />
              )}
              {errors.cat && <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>{errors.cat}</div>}
              </>);
            })()}
          </div>

          {/* Price row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{...labelStyle, color: errors.price ? 'var(--accent)' : 'var(--ink)'}}>Current price (€) *</div>
              <input type="number" step="0.01" value={form.price}
                onChange={e => { setFormDirty({...form, price: e.target.value}); setErrors(prev => ({...prev, price: ''})); }}
                onBlur={() => handleBlur('price')}
                style={{...inputStyle, borderColor: errors.price ? 'var(--accent)' : 'var(--line-2)'}} placeholder="95.00" />
              {errors.price && <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>{errors.price}</div>}
            </div>
            <div>
              <div style={labelStyle}>Original price (€) — leave empty if no sale</div>
              <input type="number" step="0.01" value={form.was} onChange={e => setFormDirty({...form, was: e.target.value})} style={inputStyle} placeholder="120.00" />
            </div>
          </div>

          {/* Stock */}
          <div style={{ marginBottom: '20px' }}>
            <div style={labelStyle}>Stock (shows "Only X left" when ≤ 5)</div>
            <input type="number" value={form.stock} onChange={e => setFormDirty({...form, stock: e.target.value})} style={{...inputStyle, maxWidth: '120px'}} />
          </div>

          {/* Sizes as pills */}
          <div style={{ marginBottom: '20px' }}>
            <div style={labelStyle}>Sizes</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {sizes.map(s => {
                const active = activeSizes.includes(s);
                return (
                  <button key={s} type="button" onClick={() => {
                    const current = [...activeSizes];
                    const next = active ? current.filter(x => x !== s) : [...current, s];
                    setFormDirty({...form, sizes: next.join(',')});
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

          {/* Hue picker */}
          <div style={{ marginBottom: '20px' }}>
            <div style={labelStyle}>Color swatch</div>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--muted)' }}>Background tint for the product card & page</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[0, 20, 38, 96, 128, 158, 188, 200, 210, 232, 248, 280, 300, 330, 350].map(h => (
                <button key={h} type="button" onClick={() => setFormDirty({...form, hue: h})}
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
          </div>

          {/* Material */}
          <div style={{ marginBottom: '20px' }}>
            <div style={labelStyle}>Material</div>
            <input value={form.material} onChange={e => setFormDirty({...form, material: e.target.value})} style={inputStyle} placeholder="e.g. 100% cotton pique, fleece" />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '28px' }}>
            <div style={labelStyle}>Description</div>
            <textarea value={form.note} onChange={e => setFormDirty({...form, note: e.target.value})}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
              placeholder="Product description shown on the product detail page." />
          </div>

          {/* Save + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="submit" disabled={saving}
              style={{...btnStyle, background: saving ? 'var(--line-2)' : 'var(--ink)', cursor: saving ? 'default' : 'pointer', transition: 'all 0.15s' }}
              onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
              onMouseOut={e => { if (!e.target.disabled) { e.target.style.opacity = '1'; e.target.style.transform = ''; } }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" onClick={handleDuplicate}
              style={{ padding: '14px 20px', borderRadius: '999px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', transition: 'all 0.15s' }}
              onMouseOver={e => { e.target.style.background = 'var(--line)'; }}
              onMouseOut={e => { e.target.style.background = 'var(--surface)'; }}>
              📋 Duplicate
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

      {/* ── Live preview pane ── */}
      <div style={{ position: 'sticky', top: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '2px', marginBottom: '12px' }}>LIVE PREVIEW</div>
        <div style={{
          background: `hsl(${form.hue},60%,80%)`, borderRadius: '14px', overflow: 'hidden',
          width: '100%', aspectRatio: '3/4', position: 'relative',
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        }}>
          {/* Image area */}
          <div style={{ height: '60%', background: images[0] ? `url(${images[0]}) center/cover` : `hsl(${form.hue},60%,70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '32px' }}>
            {!images[0] && '📷'}
          </div>
          {/* Info area */}
          <div style={{ padding: '12px', background: 'var(--surface)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{form.brand || 'Brand'}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.name || 'Product name'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              {previewSale && <span style={{ background: '#D43A00', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>-{Math.round((1 - previewPrice / previewWas) * 100)}%</span>}
              <span style={{ fontSize: '15px', fontWeight: 700 }}>€{previewPrice.toFixed(0)}</span>
              {previewSale && <span style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'line-through' }}>€{previewWas?.toFixed(0)}</span>}
            </div>
            {previewStock <= 5 && <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, marginTop: '4px' }}>🔥 Only {previewStock} left</div>}
            <div style={{ display: 'flex', gap: '3px', marginTop: '6px', flexWrap: 'wrap' }}>
              {activeSizes.slice(0, 5).map(s => (
                <span key={s} style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '3px', background: 'var(--line)', fontWeight: 600 }}>{s}</span>
              ))}
              {activeSizes.length > 5 && <span style={{ fontSize: '9px', color: 'var(--muted)' }}>+{activeSizes.length - 5}</span>}
            </div>
          </div>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', textAlign: 'center' }}>Preview updates as you edit</p>
      </div>
    </div>
  );
}
