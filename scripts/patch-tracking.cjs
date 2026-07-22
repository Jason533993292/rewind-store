const fs = require('fs');
let c = fs.readFileSync('src/components/OrderTracking.jsx', 'utf8');

// Fix status labels
c = c.replace(
  'pending: \'Processing\'',
  'pending: \'\u23f3 Pending\''
);
c = c.replace(
  'ordered: \'Confirmed\'',
  'ordered: \'\u{1F4E6} Ordered\''
);
c = c.replace(
  'shipped: \'Shipped\'',
  'shipped: \'\u{1F69A} Shipped\''
);
c = c.replace(
  'delivered: \'Delivered\'',
  'delivered: \'\u2705 Delivered\''
);
c = c.replace(
  'cancelled: \'Cancelled\'',
  'cancelled: \'\u274C Cancelled\''
);

// Add refresh button wrapper
c = c.replace(
  '              <span style={{\n                padding: \'4px 12px\', borderRadius: \'999px\', fontSize: \'12px\', fontWeight: 600,\n                background: result.status === \'shipped\' || result.status === \'delivered\' ? \'#d1fae5\' :\n                            result.status === \'cancelled\' ? \'#fee2e2\' : \'#fef3c7\',\n                color: result.status === \'shipped\' || result.status === \'delivered\' ? \'#065f46\' :\n                       result.status === \'cancelled\' ? \'#991b1b\' : \'#92400e\',\n              }}>\n                {statusLabels[result.status] || result.status}\n              </span>',
  '              <div style={{ display: \'flex\', alignItems: \'center\', gap: \'8px\' }}>\n                <button onClick={async () => {\n                  setLoading(true);\n                  try {\n                    const r = await fetch(\'/api/lookup-order\', { method: \'POST\', headers: { \'Content-Type\': \'application/json\' }, body: JSON.stringify({ email: email.trim(), orderNum: orderNum.trim() }) });\n                    const d = await r.json();\n                    if (d.found) setResult(d.order);\n                    else setError(\'Order no longer found\');\n                  } catch { setError(\'Refresh failed\'); }\n                  setLoading(false);\n                }}\n                  style={{ padding: \'4px 10px\', borderRadius: \'6px\', border: \'1px solid var(--line-2)\', background: \'var(--surface)\', cursor: \'pointer\', fontSize: \'11px\', fontWeight: 600, color: \'var(--muted)\' }}\n                  onMouseOver={e => { e.target.style.color = \'var(--ink)\'; e.target.style.borderColor = \'var(--ink)\'; }}\n                  onMouseOut={e => { e.target.style.color = \'var(--muted)\'; e.target.style.borderColor = \'var(--line-2)\'; }}>\n                  {loading ? \'...\' : \'\u{1F504}\'}\n                </button>\n                <span style={{\n                  padding: \'4px 12px\', borderRadius: \'999px\', fontSize: \'12px\', fontWeight: 600,\n                  background: result.status === \'shipped\' || result.status === \'delivered\' ? \'#d1fae5\' :\n                              result.status === \'cancelled\' ? \'#fee2e2\' : \'#fef3c7\',\n                  color: result.status === \'shipped\' || result.status === \'delivered\' ? \'#065f46\' :\n                         result.status === \'cancelled\' ? \'#991b1b\' : \'#92400e\',\n                }}>\n                  {statusLabels[result.status] || result.status}\n                </span>\n              </div>'
);

// Fix tracking display
c = c.replace(
  '                <p style={{ fontSize: \'14px\', fontWeight: 600, marginBottom: \'2px\' }}>\n                  {result.courier}: {result.tracking_number}\n                </p>\n                <a href={result.tracking_url || \'https://www.17track.net/en\'}',
  '                <div style={{ display: \'flex\', alignItems: \'center\', gap: \'6px\' }}>\n                  <p style={{ fontSize: \'14px\', fontWeight: 600, margin: 0 }}>\n                    {result.courier ? result.courier + \': \' : \'\'}{result.tracking_number}\n                  </p>\n                  <button onClick={() => { navigator.clipboard.writeText(result.tracking_number); }}\n                    style={{ padding: \'2px 6px\', borderRadius: \'4px\', border: \'1px solid var(--line-2)\', background: \'var(--surface)\', cursor: \'pointer\', fontSize: \'11px\', fontWeight: 600, color: \'var(--muted)\' }}\n                    onMouseOver={e => { e.target.style.color = \'var(--ink)\'; }}\n                    onMouseOut={e => { e.target.style.color = \'var(--muted)\'; }}>\n                    \u2398\n                  </button>\n                </div>\n                <a href={result.tracking_url || (\'https://www.17track.net/en?nums=\' + result.tracking_number)}'
);

fs.writeFileSync('src/components/OrderTracking.jsx', c);
console.log('Patched OK');
