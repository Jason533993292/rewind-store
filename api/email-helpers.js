// Pure email-rendering helpers for the REWIND store API.
// Moved out of server.js — no side effects, no env deps, unit-testable.

export function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function orderHtml({ name, items, total, address, orderNum }) {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(it.name)} <span style="color:#888">(${escapeHtml(it.size || '')})</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">€${it.price}</td>
    </tr>`).join('');
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="text-align:center;padding-bottom:20px">
  <h1 style="font-size:28px;color:#16130F;margin:0">REWIND<span style="color:#FF4D14">.</span></h1>
</td></tr>
<tr><td style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <h2 style="font-size:22px;color:#16130F;margin:0 0 6px">Order confirmed ✅</h2>
  <p style="color:#6E665A;font-size:15px;margin:0 0 4px">Hi ${escapeHtml(name || 'there')},</p>
  <p style="color:#6E665A;font-size:15px;margin:0 0 20px">Your order <b>${escapeHtml(orderNum)}</b> has been placed.</p>
  <table width="100%">${rows}</table>
  <div style="border-top:2px solid #16130F;padding:12px 0;margin-top:8px">
    <table width="100%"><tr>
      <td style="font-weight:700;font-size:16px">Total</td>
      <td style="font-weight:700;font-size:16px;text-align:right">€${total}</td>
    </tr></table>
  </div>
  <p style="color:#6E665A;font-size:14px;margin:16px 0 0">
    Shipping to:<br>${escapeHtml(address || '(address provided)')}
  </p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0">We'll email you when it ships.</p>
  <p style="margin:8px 0 0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
}

export function campaignHtml({ message }) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FAF6EF">
<table width="100%" style="max-width:560px;margin:0 auto;padding:40px 20px">
<tr><td style="text-align:center;padding-bottom:20px">
  <h1 style="font-size:28px;color:#16130F;margin:0">REWIND<span style="color:#FF4D14">.</span></h1>
</td></tr>
<tr><td style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
  <p style="color:#16130F;font-size:16px;line-height:1.6;margin:0;white-space:pre-wrap">${escapeHtml(message || '')}</p>
</td></tr>
<tr><td style="text-align:center;padding:20px 0;color:#6E665A;font-size:13px">
  <p style="margin:0"><a href="https://rewind-stores.com/#admin" style="color:#FF4D14">Unsubscribe</a></p>
  <p style="margin:8px 0 0">REWIND — <a href="https://rewind-stores.com" style="color:#FF4D14">rewind-stores.com</a></p>
</td></tr></table></body></html>`;
}
