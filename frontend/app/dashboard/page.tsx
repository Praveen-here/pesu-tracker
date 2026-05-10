'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import SubjectCard, { Subject } from '@/components/SubjectCard';
import OverallRing from '@/components/OverallRing';
import { getAttendance, refreshAttendance, logout, getMe } from '@/lib/api';
import axios from 'axios';
import { Home, RefreshCw, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [srn, setSrn] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const loadAttendance = useCallback(async (force = false) => {
    try {
      const data = force ? await refreshAttendance() : await getAttendance();
      setSubjects(data.attendance || []);
      setFetchedAt(data.fetchedAt || Date.now());
      setSrn(data.srn || '');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        router.replace('/');
      } else {
        setError('Failed to load attendance. Please try refreshing.');
      }
    }
  }, [router]);

  useEffect(() => {
    async function init() {
      try {
        const me = await getMe();
        if (!me.ok) { router.replace('/'); return; }
        setSrn(me.srn);
        await loadAttendance(false);
      } catch {
        router.replace('/');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadAttendance, router]);

  async function handleRefresh() {
    setRefreshing(true);
    setError('');
    await loadAttendance(true);
    setRefreshing(false);
  }

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
    router.replace('/');
  }

  // Computed overall percentage
  const overallPct = subjects.length
    ? Math.round(
        subjects.reduce((sum, s) => sum + s.attended, 0) /
        subjects.reduce((sum, s) => sum + s.total, 0) * 100
      )
    : 0;

  const dangerCount = subjects.filter((s) => s.status === 'danger').length;
  const safeCount = subjects.filter((s) => s.status === 'safe').length;

  // Shimmer skeleton
  if (loading) {
    return (
      <main style={{ minHeight: '100dvh', padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ height: '56px', marginBottom: '1.5rem' }} className="shimmer" />
        <div style={{ height: '200px', marginBottom: '1.5rem', borderRadius: '12px' }} className="shimmer" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: '160px', borderRadius: '12px' }} className="shimmer" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', padding: '1.5rem 1rem 5rem', maxWidth: '960px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--card-border)',
          marginBottom: '1.5rem',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}
      >
        <h1 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
          Attendance Tracker
        </h1>
        <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
          <button
            className="text-zinc-400 hover:text-white transition-colors"
            onClick={() => router.push('/home')}
            title="Home"
          >
            <Home className="w-5 h-5" />
          </button>
          <button
            className="text-zinc-400 hover:text-white transition-colors"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="text-zinc-400 hover:text-white transition-colors"
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </motion.header>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'var(--danger-dim)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Overall Stats Card ── */}
      <motion.section
        className="glass-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{ padding: '1.5rem', marginBottom: '2rem' }}
        aria-label="Overall attendance summary"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Ring */}
          <OverallRing percentage={overallPct} size={110} strokeWidth={8} />

          {/* Stats */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', marginBottom: '1rem' }}>
              Semester Overview
            </h2>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <StatPill label="Subjects" value={subjects.length} color="#ffffff" />
              <StatPill label="Safe" value={safeCount} color="var(--safe)" />
              <StatPill label="At Risk" value={dangerCount} color="var(--danger)" />
              <StatPill
                label="Total Classes"
                value={subjects.reduce((s, x) => s + x.total, 0)}
                color="var(--text-secondary)"
              />
            </div>
            {fetchedAt && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                Last fetched: {new Date(fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      {/* ── Subject Cards Grid ── */}
      {subjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}
        >
          <p style={{ fontSize: '0.9rem' }}>No attendance data found. Try refreshing.</p>
        </motion.div>
      ) : (
        <section
          aria-label="Subject attendance cards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {subjects.map((subject, i) => (
            <SubjectCard key={subject.courseCode} subject={subject} index={i} />
          ))}
        </section>
      )}
    </main>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}
