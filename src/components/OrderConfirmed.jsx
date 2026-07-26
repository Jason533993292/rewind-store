import React, { useEffect, useState } from 'react';
import { nav } from '../lib/router';

const CONFETTI_COLORS = ['#FF4D14', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4'];

function createConfetti() {
  const pieces = [];
  for (let i = 0; i < 60; i++) {
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 2;
    const size = 6 + Math.random() * 8;
    const rotation = Math.random() * 360;
    pieces.push({ color, left, delay, size, rotation, id: i });
  }
  return pieces;
}

export default function OrderConfirmed({ orderNum, onClose }) {
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    setConfetti(createConfetti());
    const t = setTimeout(() => setConfetti([]), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '40px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Confetti */}
      {confetti.map(p => (
        <div key={p.id} className="rw-confetti-piece"
          style={{
            left: p.left + '%',
            background: p.color,
            width: p.size + 'px',
            height: p.size + 'px',
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: p.delay + 's',
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}

      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
      <h1 style={{ fontSize: '24px', margin: '0 0 8px', color: 'var(--ink)' }}>Order confirmed!</h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 4px' }}>
        Thank you for your purchase.
      </p>
      {orderNum && (
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 24px' }}>
          Order #: <strong style={{ color: 'var(--ink)' }}>{orderNum}</strong>
        </p>
      )}
      <p style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '400px', lineHeight: 1.6, marginBottom: '24px' }}>
        We'll send you a confirmation email with tracking once your order ships.
        You can also track your order anytime.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="rw-btn rw-btn-pri" onClick={() => nav('/')}>
          Continue shopping
        </button>
        <button className="rw-btn" onClick={() => nav('/track')}>
          Track your order
        </button>
      </div>
    </div>
  );
}
