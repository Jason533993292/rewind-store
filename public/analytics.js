// ── Self-hosted analytics tracker (Plausible replacement) ──
// Fires once per pageview, sends minimal data to our own API.

(function() {
  // Skip bots
  if (navigator.webdriver || /bot|crawl|spider|crawling/i.test(navigator.userAgent)) return;

  const SITE = 'rewind-stores.com';
  // Skip if running on localhost
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

  // Persistent visitor/session IDs
  let vid = localStorage.getItem('_av');
  if (!vid) { vid = crypto.randomUUID(); localStorage.setItem('_av', vid); }

  let sid = sessionStorage.getItem('_as');
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('_as', sid); }

  const payload = {
    page: location.pathname + location.search,
    referrer: document.referrer || '',
    screen_width: screen.width,
    visitor_id: vid,
    session_id: sid,
  };

  // Send via sendBeacon (non-blocking, survives page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', JSON.stringify(payload));
  } else {
    fetch('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      // Don't keepalive — it's just analytics, not critical
    }).catch(() => {});
  }
})();
