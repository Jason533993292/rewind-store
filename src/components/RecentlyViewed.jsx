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
export default function RecentlyViewed({ items, allProducts, onSelect, onClear, showToast }) {
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
              style={{ animationDelay: `${idx * 0.07}s` }}
              role="button"
              tabIndex={0}
              title={p.name}
              onClick={() => {
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
