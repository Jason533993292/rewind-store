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
  const [showEmailScreen, setShowEmailScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [continuingClosed, setContinuingClosed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [cookieBannerLikelyVisible, setCookieBannerLikelyVisible] = useState(false);
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);

  useEffect(() => {
    const check = () => setIsNarrowViewport(window.innerWidth < 480);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (localStorage.getItem('rw_cookie_consent')) return;
    setCookieBannerLikelyVisible(true);
    const poll = setInterval(() => {
      if (localStorage.getItem('rw_cookie_consent')) {
        setCookieBannerLikelyVisible(false);
        clearInterval(poll);
      }
    }, 500);
    const timeout = setTimeout(() => clearInterval(poll), 60000);
    return () => { clearInterval(poll); clearTimeout(timeout); };
  }, []);

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
      if ((d.status || 'open') !== 'closed') setContinuingClosed(false);

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

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: `calc(${(isNarrowViewport && cookieBannerLikelyVisible) ? '90px' : '20px'} + env(safe-area-inset-bottom, 0px))`,
      right: 'max(20px, env(safe-area-inset-right, 0px))',
      zIndex: 10000, fontFamily: 'inherit',
      transition: 'bottom 0.2s ease',
    }}>
      {mounted && (
        <div style={{
          width: 'min(360px, calc(100vw - 40px))',
          height: 'min(480px, calc(100vh - 140px))',
          maxHeight: '480px',
          background: '#fff', borderRadius: '16px',
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

          {sessionStatus === 'closed' && !continuingClosed ? (
            <div style={{ padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 12px' }}>Admin has closed this chat.</p>
              <button onClick={() => { localStorage.removeItem(SESSION_KEY); setSessionId(null); setMessages([]); setSessionStatus('open'); setCustomerEmail(''); setShowEmailScreen(true); setContinuingClosed(false); }}
                style={{ padding: '8px 16px', marginRight: '8px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '13px' }}>
                Start new chat
              </button>
              <button onClick={() => setContinuingClosed(true)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                Continue anyway
              </button>
            </div>
          ) : !sessionId && showEmailScreen ? (
            <div style={{ padding: '14px' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>Enter your email to start chatting</p>
              <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value.slice(0, 200))}
                placeholder="your@email.com" type="email"
                onKeyDown={e => { if (e.key === 'Enter' && customerEmail.includes('@')) setShowEmailScreen(false); }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', boxSizing: 'border-box' }} />
              <button onClick={() => setShowEmailScreen(false)}
                disabled={!customerEmail.includes('@')}
                style={{ display: 'block', width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px', border: 'none', background: customerEmail.includes('@') ? 'var(--accent)' : 'var(--line-2)', color: '#fff', cursor: customerEmail.includes('@') ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}>
                Start chatting
              </button>
            </div>
          ) : (
          <div style={{ display: 'flex', gap: '8px', padding: '10px', borderTop: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={sessionId ? "Type a message..." : "Type your first message..."}
              style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '8px 10px', fontSize: '16px' }}
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
