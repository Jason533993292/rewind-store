import React, { useState } from 'react';

// Ready-to-paste AI prompts for a given product, generated from its data.
function promptsFor(p) {
  const name = p.name || p.title || 'this piece';
  const cat = p.category || 'vintage';
  const style = 'Retro-Modern, bold, vibrant, human-made';
  const sizes = p.size && p.size.length ? ` Sizes: ${p.size.join(', ')}.` : '';
  return [
    { label: 'Product description', text: `Write a product description for "${name}" (${cat}). One-of-each vintage piece, authenticated, steam-cleaned, ships in 24h, arrives in 10-25 days. Tone: ${style}.${sizes} End with a scarcity line ("When it's gone, it's gone").` },
    { label: 'AI image prompt', text: `Generate a studio product photo of "${name}" — ${cat}. ${style}. Clean cream background, warm natural light, editorial, high detail, no text.` },
    { label: 'Social caption', text: `Write an Instagram caption for "${name}" (${cat}). One-of-one vintage, authenticated, ships in 24h. Scarcity-driven, on-brand ${style} tone. 3-5 relevant hashtags.` },
    { label: 'SEO title', text: `Write an SEO meta title (max ~60 chars) for "${name}" — ${cat} vintage streetwear, one of one.` },
  ];
}

export default function ContentPrompts({ products, showToast }) {
  const [copied, setCopied] = useState(null);
  const items = (products || []).filter((p) => p && (p.name || p.title));

  const copy = (text, key) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      if (showToast) showToast('Copied');
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>📝 Content Prompts</h3>
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
        All <b>{items.length}</b> items in the store, each with ready-to-paste AI prompts for descriptions, images, captions, and SEO.
      </p>
      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No products yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {items.map((p, i) => (
            <details key={p.id || p.product_id || i} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px 14px' }} open={items.length <= 3}>
              <summary style={{ fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                {p.name || p.title}
                {p.category ? <span style={{ color: 'var(--muted)', fontWeight: 500, marginLeft: '8px' }}>{p.category}</span> : null}
                {typeof p.price === 'number' ? <span style={{ color: 'var(--accent)', marginLeft: '8px' }}>€{p.price}</span> : null}
              </summary>
              <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                {promptsFor(p).map((pr, j) => {
                  const k = `${i}-${j}`;
                  return (
                    <div key={j} style={{ background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{pr.label}</span>
                        <button onClick={() => copy(pr.text, k)} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', color: copied === k ? 'var(--accent)' : 'var(--muted)', fontWeight: 600 }}>
                          {copied === k ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ink)', lineHeight: 1.5 }}>{pr.text}</div>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
