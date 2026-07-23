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
    if (path === '/privacy') path = '/privacy';
    else if (path === '/terms') path = '/terms';
    else if (path === '/returns') path = '/returns';
    else if (path === '/shipping') path = '/shipping';
    else if (path.startsWith('/product/')) path = path;
    else if (path === '#admin' || path === 'admin') path = '/admin';
    else path = '/';
    window.history.replaceState({}, '', path);
  }
}
