'use client';

import { useEffect, useRef } from 'react';

interface Props {
  percentage: number;
}

export default function ProgressBar({ percentage }: Props) {
  const pct = Math.min(100, Math.max(0, percentage));
  const fillRef = useRef<HTMLDivElement>(null);

  const color =
    pct >= 75 ? 'var(--safe)' : pct >= 65 ? 'var(--warn)' : 'var(--danger)';

  useEffect(() => {
    if (!fillRef.current) return;
    fillRef.current.style.width = '0%';
    const timer = setTimeout(() => {
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [pct]);

  return (
    <div className="progress-track" aria-label={`${pct}% attendance`}>
      <div
        ref={fillRef}
        className="progress-fill"
        style={{ width: 0, background: color }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
