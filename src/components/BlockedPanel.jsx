import React, { useState, useEffect } from 'react';

export default function BlockedPanel() {
  const [emails, setEmails] = useState([]);
  const [ips, setIps] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [eRes, iRes, mRes] = await Promise.all([
        fetch('/api/admin/blocked-emails').then(r => r.json()),
        fetch('/api/admin/blocked-ips').then(r => r.json()),
        fetch('/api/admin/email-ips').then(r => r.json()),
      ]);
      setEmails(Array.isArray(eRes.emails) ? eRes.emails : []);
      setIps(Array.isArray(iRes.ips) ? iRes.ips : []);
      setMappings(Array.isArray(mRes.mappings) ? mRes.mappings : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const blockEmail = async (email) => {
    if (!email.trim()) return;
    await fetch('/api/admin/block-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
    setMsg(`🚫 ${email.trim()} blocked`);
    setNewEmail('');
    await load();
    setTimeout(() => setMsg(''), 3000);
  };

  const unblockEmail = async (email) => {
    await fetch('/api/admin/unblock-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    setMsg(`✅ ${email} unblocked`);
    await load();
    setTimeout(() => setMsg(''), 3000);
  };

  const blockIp = async (ip) => {
    if (!ip.trim()) return;
    await fetch('/api/admin/block-ip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: ip.trim() }) });
    setMsg(`🚫 IP ${ip.trim()} blocked`);
    await load();
    setTimeout(() => setMsg(''), 3000);
  };

  const unblockIp = async (ip) => {
    await fetch('/api/admin/unblock-ip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) });
    setMsg(`✅ IP ${ip} unblocked`);
    await load();
    setTimeout(() => setMsg(''), 3000);
  };

  const blockedEmails = new Set(emails.map(e => e.email));

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>🚫 Blocked emails & IPs</h3>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{emails.length} emails · {ips.length} IPs</span>
      </div>
      {msg && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>{msg}</div>}
      {loading ? <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Block email input */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>Block email</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newEmail.trim()) blockEmail(newEmail.trim()); }}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '6px', fontSize: '13px' }} />
              <button onClick={() => blockEmail(newEmail)} disabled={!newEmail.trim()}
                onMouseOver={e => { if (!e.target.disabled) { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; } }}
                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}
                style={{ padding: '8px 14px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}>Block</button>
            </div>
          </div>

          {/* Emails to IPs map */}
          {mappings.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>Email → IP addresses</h4>
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Email</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>IPs</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map(m => (
                      <tr key={m.email} style={{ borderBottom: '1px solid var(--line)', background: blockedEmails.has(m.email) ? 'color-mix(in oklab, var(--accent) 8%, transparent)' : 'transparent' }}>
                        <td style={{ padding: '6px 10px', fontWeight: blockedEmails.has(m.email) ? 700 : 400 }}>{m.email}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {m.ips.map(ip => <span key={ip} style={{ fontSize: '11px', padding: '1px 6px', background: 'var(--line)', borderRadius: '4px', fontFamily: 'monospace' }}>{ip}</span>)}
                          </div>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {blockedEmails.has(m.email) ? (
                            <button onClick={() => unblockEmail(m.email)}
                              onMouseOver={e => { e.target.style.background = 'var(--ink)'; e.target.style.color = '#fff'; e.target.style.transform = 'translateY(-1px)'; }}
                              onMouseOut={e => { e.target.style.background = 'none'; e.target.style.color = 'var(--ink)'; e.target.style.transform = ''; }}
                              style={{ fontSize: '11px', padding: '2px 8px', background: 'none', border: '1px solid var(--line-2)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s' }}>Unblock</button>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => blockEmail(m.email)}
                                onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                                onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}
                                style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s' }}>Block</button>
                              {m.ips[0] && (
                                <button onClick={() => blockIp(m.ips[0])}
                                  onMouseOver={e => { e.target.style.opacity = '0.85'; e.target.style.transform = 'translateY(-1px)'; }}
                                  onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = ''; }}
                                  style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.15s' }}>Block IP</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Blocked emails list */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>Currently blocked</h4>
            {emails.length === 0 && ips.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Nothing blocked</p> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {emails.map(e => (
                  <span key={e.email} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--line)', borderRadius: '6px', fontSize: '12px' }}>
                    📧 {e.email}
                    <button onClick={() => unblockEmail(e.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '0', fontSize: '14px', lineHeight: '1' }}>×</button>
                  </span>
                ))}
                {ips.map(ip => (
                  <span key={ip.ip_address} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--line)', borderRadius: '6px', fontSize: '12px' }}>
                    🌐 {ip.ip_address}
                    <button onClick={() => unblockIp(ip.ip_address)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '0', fontSize: '14px', lineHeight: '1' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
