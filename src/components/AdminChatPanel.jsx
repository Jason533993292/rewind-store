import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function AdminChatPanel({ chatUnread, setChatUnread }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showBlockPanel, setShowBlockPanel] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockCustomReason, setBlockCustomReason] = useState('');
  const [blockMsg, setBlockMsg] = useState('');
  const [showPromoPanel, setShowPromoPanel] = useState(false);
  const [chatRefreshing, setChatRefreshing] = useState(false);
  const [promoPercent, setPromoPercent] = useState(10);
  const [promoCustomValue, setPromoCustomValue] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const scrollRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/chat/sessions');
      const d = await r.json();
      setSessions(Array.isArray(d.sessions) ? d.sessions : []);
    } catch {}
  }, []);

  const loadMessages = useCallback(async (sessionId) => {
    try {
      const r = await fetch('/api/admin/chat/messages?session_id=' + encodeURIComponent(sessionId));
      const d = await r.json();
      setMessages(Array.isArray(d.messages) ? d.messages : []);
    } catch {}
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/api/admin/chat/sessions');
        const d = await r.json();
        const newSessions = Array.isArray(d.sessions) ? d.sessions : [];
        setSessions(prev => {
          if (prev.length > 0 && newSessions.length > prev.length) {
            setChatUnread(newSessions.length - prev.length);
          }
          return newSessions;
        });
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [setChatUnread]);

  useEffect(() => {
    if (selectedId) { loadMessages(selectedId); }
  }, [selectedId, loadMessages]);

  const handleReply = async () => {
    if (!reply.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      await fetch('/api/admin/chat/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedId, message: reply.trim() }),
      });
      setReply('');
      await loadMessages(selectedId);
    } catch {}
    setSending(false);
  };

  const handleClose = async () => {
    if (!selectedId) return;
    try {
      await fetch('/api/admin/chat/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedId }),
      });
      setSelectedId(null);
      setMessages([]);
      await loadSessions();
    } catch {}
    setShowCloseConfirm(false);
  };

  const now = Date.now();
  const agents = ['REWIND Assistant', 'Support Agent', 'Style Advisor'];
  const agentColors = ['#FF4D14', '#2563EB', '#7C3AED'];
  const session = sessions.find(s => s.session_id === selectedId);
  const selectedEmail = session?.customer_email || '';

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
          💬 Customer chats{' '}
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>
            ({sessions.length} active)
            {chatUnread > 0 && <span style={{ color: 'var(--accent)', fontWeight: 700 }}> · {chatUnread} new</span>}
          </span>
        </h3>
        <button onClick={() => { loadSessions(); setChatRefreshing(true); setTimeout(() => setChatRefreshing(false), 1000); }}
          style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--line)', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}>
          {chatRefreshing ? '🔄' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', minHeight: '300px' }}>
        <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '13px', padding: '8px' }}>No active chat sessions.</p>
          ) : sessions.map(s => (
            <button key={s.session_id} onClick={() => setSelectedId(s.session_id)}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px',
                fontWeight: selectedId === s.session_id ? 700 : 500,
                background: selectedId === s.session_id ? 'var(--ink)' : 'var(--line)',
                color: selectedId === s.session_id ? 'var(--surface)' : 'var(--ink)',
                textAlign: 'left', transition: 'all 0.15s',
              }}>
              <div style={{ fontWeight: 600 }}>{s.customer_name || s.customer_email || 'Anonymous'}</div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>{s.last_message?.slice(0, 30) || '...'}</div>
              <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>
                {s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}
              </div>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedId ? (
            <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
              Select a chat session to view messages
            </p>
          ) : (
            <div>
              <div ref={scrollRef} style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '8px', background: 'var(--line)', borderRadius: '8px' }}>
                {messages.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>No messages in this session.</p>
                ) : messages.map(m => {
                  const isCustomer = m.sender === 'customer';
                  const agentIdx = !isCustomer && m.sender !== 'ai' ? agents.indexOf(m.sender) : -1;
                  return (
                    <div key={m.id || m.timestamp || Math.random()}
                      style={{
                        alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                        maxWidth: '80%',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: isCustomer ? 'var(--surface)' : (m.sender === 'ai' ? 'color-mix(in oklab, var(--accent) 10%, var(--line))' : 'var(--accent)'),
                        color: isCustomer ? 'var(--ink)' : (m.sender === 'ai' ? 'var(--ink)' : '#fff'),
                        fontSize: '13px',
                      }}>
                      {!isCustomer && (
                        <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '2px', color: agentIdx >= 0 ? agentColors[agentIdx] : 'var(--accent)' }}>
                          {m.sender === 'ai' ? 'AI Assistant' : m.sender}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message || m.text || ''}</div>
                      {m.timestamp && <div style={{ fontSize: '10px', color: isCustomer ? 'var(--muted)' : (m.sender === 'ai' ? 'var(--muted)' : 'rgba(255,255,255,0.7)'), marginTop: '4px', textAlign: 'right' }}>
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                  placeholder="Type a reply..." style={{
                    flex: 1, padding: '10px 14px', border: '1px solid var(--line-2)', borderRadius: '8px',
                    fontSize: '14px', background: 'var(--surface)',
                  }} />
                <button onClick={handleReply} disabled={!reply.trim() || sending}
                  style={{ padding: '10px 16px', borderRadius: '8px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s' }}>
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
