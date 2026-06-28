import { useState, useEffect, useRef } from 'react';

function nextDeadline() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() + 9);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function useCountdown() {
  const target = useRef(nextDeadline());
  const [left, setLeft] = useState(target.current - new Date());

  useEffect(() => {
    const t = setInterval(() => {
      let ms = target.current - new Date();
      if (ms <= 0) { target.current = nextDeadline(); ms = target.current - new Date(); }
      setLeft(ms);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const s = Math.max(0, Math.floor(left / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export const pad = (n) => String(n).padStart(2, '0');

export const money = (n) => '€' + n.toFixed(2).replace(/\.00$/, '');

export function discountPct(p) {
  return p.was ? Math.round((1 - p.price / p.was) * 100) : 0;
}
