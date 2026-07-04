import React from 'react';
import { Photo } from './Shell';
import { money } from '../hooks/useCountdown';

/**
 * RecentlyViewed — a horizontally scrollable strip of recently-viewed products.
 *
 * Props:
 *   items       — array of product objects to display (pre-filtered by caller)
 *   allProducts — master product list for resolving fresh data on click
 *   onSelect    — (product) => void, called when user clicks a card
 *   onClear     — (filteredItems) => void, called when user clicks Clear;
 *                 receives the items being cleared so the parent can buffer
 *                 them for undo
 *   showToast   — (msg, action?) => void
 */
export default function RecentlyViewed({ items, allProducts, onSelect, onClear, onRemoveItem, showToast }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
          👁 Recently viewed
        </h3>
        <button
          onClick={() => onClear(items)}
          style={{ fontSize: '12px' }}
          className="rw-txt-btn"
          aria-label="Clear recently viewed items"
        >
          Clear
        </button>
      </div>
      <div className="rw-recent-scroll" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
        {items.map((p, idx) => {
          const pid = p.id || p.product_id;
          return (
            <div
              key={pid}
              className="rw-recent-item"
              style={{ animationDelay: `${idx * 0.07}s`, position: 'relative' }}
              role="button"
              tabIndex={0}
              title={p.name}
              onClick={(e) => {
                // Ignore clicks on the remove button itself
                if (e.target.closest('[data-remove-recent]')) return;
                const fresh = allProducts.find(x => (x.id || x.product_id) === pid);
                if (fresh) {
                  onSelect(fresh);
                } else {
                  showToast('This product is no longer available');
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <button
                data-remove-recent
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRemoveItem) onRemoveItem(pid, p.name);
                }}
                aria-label={`Remove ${p.name} from recently viewed`}
                style={{
                  position: 'absolute', top: '4px', right: '4px', zIndex: 5,
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: 'none', background: 'color-mix(in oklab, var(--surface) 80%, transparent)',
                  backdropFilter: 'blur(4px)',
                  cursor: 'pointer', display: 'grid', placeItems: 'center',
                  color: 'var(--muted)', fontSize: '12px', fontWeight: 700,
                  opacity: 0.5, transition: 'opacity 0.15s, background 0.15s, color 0.15s',
                  padding: 0, lineHeight: 1,
                }}
                onMouseOver={e => { e.target.style.opacity = '1'; e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; }}
                onMouseOut={e => { e.target.style.opacity = '0.5'; e.target.style.background = 'color-mix(in oklab, var(--surface) 80%, transparent)'; e.target.style.color = 'var(--muted)'; }}
                onFocus={e => e.target.style.opacity = '1'}
                onBlur={e => e.target.style.opacity = '0.5'}
              >×</button>
              <Photo id={pid + '-recent'} hue={p.hue} label={p.name?.toUpperCase() || ''} h={150} img={p.img} />
              <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                {p.name}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                {money(p.price)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
