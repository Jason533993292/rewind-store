/**
 * SPA navigation helper — replaces window.location.hash with real paths.
 * Usage: nav('/admin') or nav('/privacy')
 */
export function nav(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new CustomEvent('spa-navigate'));
}

// Detect the active SPA route from the current pathname
export function getRoute() {
  const p = window.location.pathname;
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/privacy')) return 'privacy';
  if (p.startsWith('/terms')) return 'terms';
  if (p.startsWith('/returns')) return 'returns';
  if (p.startsWith('/shipping')) return 'shipping';
  if (p.startsWith('/track')) return 'track';
  if (p.startsWith('/product/')) return 'product/' + p.replace('/product/', '');
  if (p.startsWith('/payment-complete')) return 'payment-complete';
  return '';
}

// Set pathname on load without a history entry (replaces any hash URL)
export function initRouter() {
  const hash = window.location.hash;
  if (hash) {
    let path = hash.replace('#', '');
    if (path === '/privacy' || path === 'privacy') path = '/privacy';
    else if (path === '/terms' || path === 'terms') path = '/terms';
    else if (path === '/returns' || path === 'returns') path = '/returns';
    else if (path === '/shipping' || path === 'shipping') path = '/shipping';
    else if (path === '/track' || path === 'track') path = '/track';
    else if (path.startsWith('/product/') || path.startsWith('product/')) {
      path = '/product/' + path.replace(/^\/?product\//, '');
    }
    else if (path === '#admin' || path === 'admin') path = '/admin';
    else if (path.startsWith('/payment-complete') || path.startsWith('payment-complete')) path = path;
    else path = '/';
    window.history.replaceState({}, '', path);
  }
}
