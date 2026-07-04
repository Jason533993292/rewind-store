import { useState, useEffect, useRef } from 'react';

export default function CountUp({ to, duration = 1, separator = ',', delay = 0 }) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const startTime = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      started.current = true;
      startTime.current = performance.now();
      const frame = (now) => {
        const elapsed = (now - startTime.current) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(to * eased));
        if (progress < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [to, duration, delay]);

  const formatted = count.toLocaleString('en-US', { useGrouping: !!separator });
  return <span>{formatted}</span>;
}
