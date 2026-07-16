import React, { useState, useEffect } from 'react';

export default function BlockedPanel() {
  const [emails, setEmails] = useState([]);
  const [ips, setIps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newIp, setNewIp] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [eRes, iRes] = await Promise.all([
        fetch('/api/admin/blocked-emails').then(r => r.json()),
        fetch('/api/admin/blocked-ips').then(r => r.json()),
      ]);
      setEmails(Array.isArray(eRes.emails) ? eRes.emails : []);
      setIps(Array.isArray(iRes.ips) ? iRes.ips : []);
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
    setMsg(`🚫 ${ip.trim()} blocked`);
    setNewIp('');
    await load();
    setTimeout(() => setMsg(''), 3000);
  };

  const unblockIp = async (ip) => {
    await fetch('/api/admin/unblock-ip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) });
    setMsg(`✅ ${ip} unblocked`);
    await load();
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>🚫 Blocked emails & IPs</h3>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{emails.length} emails · {ips.length} IPs</span>
      </div>
      {msg && <div style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', fontWeight: 600, background: 'color-mix(in oklab, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>{msg}</div>}
      {loading ? <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>Blocked emails</h4>
            {emails.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No blocked emails</p> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {emails.map(e => (
                  <span key={e.email} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--line)', borderRadius: '6px', fontSize: '12px' }}>
                    {e.email}
                    <button onClick={() => unblockEmail(e.email)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '0', fontSize: '14px', lineHeight: '1' }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newEmail.trim()) blockEmail(newEmail.trim()); }}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '6px', fontSize: '13px' }} />
              <button onClick={() => blockEmail(newEmail)} disabled={!newEmail.trim()}
                style={{ padding: '8px 14px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Block</button>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>Blocked IPs</h4>
            {ips.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No blocked IPs</p> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ips.map(ip => (
                  <span key={ip.ip_address} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--line)', borderRadius: '6px', fontSize: '12px' }}>
                    {ip.ip_address}
                    <button onClick={() => unblockIp(ip.ip_address)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: '0', fontSize: '14px', lineHeight: '1' }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input placeholder="192.168.1.1" value={newIp} onChange={e => setNewIp(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newIp.trim()) blockIp(newIp.trim()); }}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: '6px', fontSize: '13px' }} />
              <button onClick={() => blockIp(newIp)} disabled={!newIp.trim()}
                style={{ padding: '8px 14px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Block</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
