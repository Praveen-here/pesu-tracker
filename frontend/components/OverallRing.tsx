'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Props {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export default function OverallRing({ percentage, size = 140, strokeWidth = 10 }: Props) {
  const pct = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  const color =
    pct >= 75 ? 'var(--safe)' : pct >= 65 ? 'var(--warn)' : 'var(--danger)';

  const glowColor =
    pct >= 75
      ? 'rgba(34,197,94,0.4)'
      : pct >= 65
      ? 'rgba(245,158,11,0.4)'
      : 'rgba(239,68,68,0.4)';

  const progressRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!progressRef.current) return;
    progressRef.current.style.strokeDashoffset = String(circumference);
    const timer = setTimeout(() => {
      if (progressRef.current) {
        progressRef.current.style.strokeDashoffset = String(offset);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [offset, circumference]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{ position: 'relative', width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#18181b"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          ref={progressRef}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
      </svg>

      {/* Center label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{ fontSize: size * 0.22, color, lineHeight: 1, fontWeight: 700 }}
        >
          {pct}%
        </span>
        <span style={{ fontSize: size * 0.09, color: 'var(--text-muted)', marginTop: 2 }}>
          overall
        </span>
      </div>
    </motion.div>
  );
}
