import React, { useState, useEffect, useRef, useCallback } from 'react';

const SESSION_KEY = 'rw_chat_session';
const OPEN_POLL_MS = 5000;
const BADGE_POLL_MS = 30000;
const WELCOME = "Hey! Ask us anything about sizing, an item, or your order. We usually reply within a few hours — this isn't 24/7 live support.";

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    try { return localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('open');
  const [customerEmail, setCustomerEmail] = useState('');
  const [showEmailScreen, setShowEmailScreen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState('');
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const fetchMessages = useCallback(async (markRead) => {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/chat/messages?session_id=${encodeURIComponent(sessionId)}`);
      const d = await r.json();
      const msgs = Array.isArray(d.messages) ? d.messages : [];
      setMessages(msgs);
      setSessionStatus(d.status || 'open');

      const unreadAdmin = msgs.filter(m => (m.sender === 'admin' || m.sender === 'ai') && !m.read_by_customer).length;
      if (!open) {
        if (unreadAdmin > lastCountRef.current) beep();
        setUnread(unreadAdmin);
      } else if (markRead && unreadAdmin > 0) {
        setUnread(0);
        fetch('/api/chat/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        }).catch(() => {});
      }
      lastCountRef.current = unreadAdmin;
    } catch {}
  }, [sessionId, open]);

  useEffect(() => {
    if (!sessionId) return;
    const tick = () => { fetchMessages(open); };
    tick();
    const interval = setInterval(tick, open ? OPEN_POLL_MS : BADGE_POLL_MS);
    return () => clearInterval(interval);
  }, [sessionId, open, fetchMessages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      if (!sessionId) {
        const r = await fetch('/api/chat/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, customer_email: customerEmail || undefined }),
        });
        const d = await r.json();
        if (d.session_id) {
          localStorage.setItem(SESSION_KEY, d.session_id);
          setSessionId(d.session_id);
          setMessages([{ sender: 'customer', message: text, created_at: new Date().toISOString() }]);
        }
      } else {
        setMessages((prev) => [...prev, { sender: 'customer', message: text, created_at: new Date().toISOString() }]);
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, message: text }),
        });
        fetchMessages(true);
      }
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    setUnread(0);
    if (!sessionId) setShowEmailScreen(true);
    if (sessionId) fetchMessages(true);
  }

  const showGreeting = messages.length === 0;

  // Don't render on admin pages
  if (typeof window !== 'undefined' && window.location.hash === '#admin') return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 10000, fontFamily: 'inherit' }}>
      {mounted && (
        <div style={{
          width: '360px', height: '480px', background: '#fff', borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column',
          marginBottom: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,.06)',
          opacity: open ? 1 : 0, transition: 'opacity 0.3s ease',
        }}>
          <div style={{
            padding: '14px 16px', background: 'var(--ink, #16130F)', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          }}>
            <strong style={{ fontSize: '14px' }}>Chat with REWIND</strong>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {sessionId && (
                <button onClick={() => { localStorage.removeItem(SESSION_KEY); setSessionId(null); setMessages([]); setSessionStatus('open'); setCustomerEmail(''); setShowEmailScreen(true); setShowVerificationScreen(false); setVerificationCode(''); setVerificationMsg(''); }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: '11px', cursor: 'pointer', borderRadius: '6px', padding: '3px 8px' }}>
                  New
                </button>
              )}
              <button onClick={() => fetchMessages(true)} aria-label="Refresh messages"
                style={{ background: 'none', border: '1px solid rgba(255,255,255,.3)', color: '#fff', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', padding: '3px 8px', lineHeight: 1 }}>
                ↻
              </button>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {showGreeting && (
              <div style={{ fontSize: '13px', color: 'var(--muted, #6E665A)', background: '#FAF6EF', borderRadius: '10px', padding: '10px 12px' }}>
                {WELCOME}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.sender === 'admin' || m.sender === 'ai' ? 'flex-start' : 'flex-end',
                background: m.sender === 'admin' || m.sender === 'ai' ? '#F1EEE7' : 'var(--accent, #FF4D14)',
                color: m.sender === 'admin' || m.sender === 'ai' ? '#16130F' : '#fff',
                borderRadius: '12px', padding: '8px 12px', fontSize: '13px', maxWidth: '80%',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.message}
              </div>
            ))}
          </div>

          {sessionStatus === 'closed' ? (
            <div style={{ padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>💬 Session closed</p>
              <button onClick={() => setOpen(false)}
                style={{ padding: '8px 16px', marginRight: '8px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px' }}>
                Close
              </button>
              <button onClick={() => { localStorage.removeItem(SESSION_KEY); setSessionId(null); setMessages([]); setSessionStatus('open'); setCustomerEmail(''); setShowEmailScreen(true); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                Open a new one
              </button>
            </div>
          ) : !sessionId && showEmailScreen && !showVerificationScreen ? (
            <div style={{ padding: '14px' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>Enter your email to start chatting</p>
              <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value.slice(0, 200))}
                placeholder="your@email.com" type="email"
                onKeyDown={(e) => { if (e.key === 'Enter' && customerEmail.includes('@')) document.getElementById('rw-send-code-btn')?.click(); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }} />
              <button id="rw-send-code-btn" onClick={async () => {
                if (!customerEmail.includes('@')) return;
                setVerifying(true);
                setVerificationMsg('');
                try {
                  const r = await fetch('/api/chat/send-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: customerEmail }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    setShowVerificationScreen(true);
                    setVerificationMsg('');
                  } else {
                    setVerificationMsg(d.error || 'Failed to send code');
                  }
                } catch { setVerificationMsg('Network error'); }
                setVerifying(false);
              }}
                disabled={!customerEmail.includes('@') || verifying}
                style={{ display: 'block', width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: 'none', background: customerEmail.includes('@') && !verifying ? 'var(--accent)' : 'var(--line-2)', color: '#fff', cursor: customerEmail.includes('@') && !verifying ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}>
                {verifying ? 'Sending code...' : 'Send verification code'}
              </button>
              {verificationMsg && <p style={{ fontSize: '12px', color: 'var(--accent)', margin: '6px 0 0', textAlign: 'center' }}>{verificationMsg}</p>}
            </div>
          ) : !sessionId && showVerificationScreen ? (
            <div style={{ padding: '14px' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 4px' }}>A 6-digit code was sent to</p>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 8px', wordBreak: 'break-all' }}>{customerEmail}</p>
              <input value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code" type="text" inputMode="numeric"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && verificationCode.length === 6) {
                    setVerifying(true); setVerificationMsg('');
                    try {
                      const r = await fetch('/api/chat/verify-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: customerEmail, code: verificationCode }),
                      });
                      const d = await r.json();
                      if (d.verified) {
                        setShowVerificationScreen(false);
                        setShowEmailScreen(false);
                      } else {
                        setVerificationMsg(d.error || 'Invalid code');
                      }
                    } catch { setVerificationMsg('Network error'); }
                    setVerifying(false);
                  }
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '18px', letterSpacing: '6px', textAlign: 'center', boxSizing: 'border-box' }} />
              <button disabled={verificationCode.length !== 6 || verifying}
                onClick={async () => {
                  setVerifying(true); setVerificationMsg('');
                  try {
                    const r = await fetch('/api/chat/verify-code', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: customerEmail, code: verificationCode }),
                    });
                    const d = await r.json();
                    if (d.verified) {
                      setShowVerificationScreen(false);
                      setShowEmailScreen(false);
                    } else {
                      setVerificationMsg(d.error || 'Invalid code');
                    }
                  } catch { setVerificationMsg('Network error'); }
                  setVerifying(false);
                }}
                style={{ display: 'block', width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: 'none', background: verificationCode.length === 6 && !verifying ? 'var(--accent)' : 'var(--line-2)', color: '#fff', cursor: verificationCode.length === 6 && !verifying ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}>
                {verifying ? 'Verifying...' : 'Verify'}
              </button>
              {verificationMsg && <p style={{ fontSize: '12px', color: 'var(--accent)', margin: '6px 0 0', textAlign: 'center' }}>{verificationMsg}</p>}
              <button onClick={() => { setShowVerificationScreen(false); setVerificationCode(''); setVerificationMsg(''); }}
                style={{ display: 'block', width: '100%', marginTop: '6px', padding: '6px', borderRadius: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--muted)', textDecoration: 'underline' }}>
                Use a different email
              </button>
            </div>
          ) : (
          <div style={{ display: 'flex', gap: '8px', padding: '10px', borderTop: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={sessionId ? "Type a message..." : "Type your first message..."}
              style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}
            />
            <button onClick={handleSend} disabled={sending || !input.trim()}
              style={{
                background: 'var(--accent, #FF4D14)', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '0 14px', fontSize: '13px', fontWeight: 600, cursor: sending ? 'default' : 'pointer',
                opacity: sending || !input.trim() ? 0.6 : 1,
              }}>
              Send
            </button>
          </div>
          )}
        </div>
      )}

      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        aria-label={open ? 'Close chat' : 'Open chat'}
        style={{
          width: '56px', height: '56px', borderRadius: '50%', border: 'none',
          background: 'var(--accent, #FF4D14)', color: '#fff', fontSize: '22px',
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.2)', position: 'relative',
        }}>
        {open ? '\u00d7' : '\u{1F4AC}'}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px', background: '#16130F', color: '#fff',
            borderRadius: '999px', fontSize: '11px', fontWeight: 700, minWidth: '20px', height: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
