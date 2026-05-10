'use client';

import { motion } from 'framer-motion';
import ProgressBar from './ProgressBar';
import { AlertCircle, Zap, CheckCircle2 } from 'lucide-react';

export interface Subject {
  courseCode: string;
  courseName: string;
  attended: number;
  total: number;
  percentage: number;
  canBunk: number;
  classesNeededFor75: number;
  status: 'safe' | 'warning' | 'danger';
}

interface Props {
  subject: Subject;
  index: number;
}

export default function SubjectCard({ subject, index }: Props) {
  const { courseCode, courseName, attended, total, percentage, canBunk, classesNeededFor75, status } = subject;

  const statusColor =
    status === 'safe' ? 'var(--safe)' : status === 'warning' ? 'var(--warn)' : 'var(--danger)';

  const badgeClass =
    status === 'safe' ? 'badge-safe' : status === 'warning' ? 'badge-warn' : 'badge-danger';

  const analyticsText =
    status === 'danger'
      ? `Attend ${classesNeededFor75} more class${classesNeededFor75 !== 1 ? 'es' : ''} to reach 75%`
      : canBunk === 0
      ? 'At the 75% limit — don\'t miss any class!'
      : `You can bunk ${canBunk} more class${canBunk !== 1 ? 'es' : ''} safely`;

  const AnalyticsIcon = status === 'danger' ? AlertCircle : canBunk === 0 ? Zap : CheckCircle2;

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      style={{
        padding: '1.25rem',
        borderLeft: `3px solid ${statusColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: '0.92rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              marginBottom: '0.2rem',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {courseName}
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {courseCode}
          </span>
        </div>

        {/* Percentage badge */}
        <span
          className={badgeClass}
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attendance</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {attended}/{total} classes
          </span>
        </div>
        <ProgressBar percentage={percentage} />
        {/* 75% marker */}
        <div style={{ position: 'relative', height: 0 }}>
          <div
            style={{
              position: 'absolute',
              left: '75%',
              bottom: '2px',
              width: '1px',
              height: '10px',
              background: '#27272a',
            }}
          />
        </div>
      </div>

      {/* Analytics row */}
      <div
        style={{
          background: status === 'danger' ? 'var(--danger-dim)' : status === 'warning' ? 'var(--warn-dim)' : 'var(--safe-dim)',
          border: `1px solid ${statusColor}22`,
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          fontSize: '0.78rem',
          color: statusColor,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <AnalyticsIcon className="w-3.5 h-3.5" />
        <span>{analyticsText}</span>
      </div>
    </motion.div>
  );
}
