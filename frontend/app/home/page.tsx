'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { LogOut, BarChart3, Target } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    axios.get('/api/auth/me', { withCredentials: true })
      .then(r => { 
        setUserName(r.data.name || r.data.srn || ''); 
        setChecking(false); 
      })
      .catch(() => router.replace('/'));
  }, [router]);

  if (checking) return <LoadingScreen />;

  const features = [
    {
      id: 'attendance',
      icon: <BarChart3 className="w-8 h-8 text-white mb-4" strokeWidth={1.5} />,
      title: 'Attendance Tracker',
      desc: 'View your subject-wise attendance, safe bunk count, and recovery targets.',
      href: '/dashboard',
    },
    {
      id: 'cgpa',
      icon: <Target className="w-8 h-8 text-white mb-4" strokeWidth={1.5} />,
      title: 'CGPA Tracker',
      desc: 'See your ISA & ESA marks, minimum scores needed, and CGPA projection for placements.',
      href: '/cgpa',
    },
  ];

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          PESU Tracker
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Welcome back, <span style={{ color: '#ffffff', fontWeight: 600 }}>{userName}</span>
        </p>
      </motion.div>

      {/* Feature Cards */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '800px', width: '100%' }}>
        {features.map((f, i) => (
          <motion.button
            key={f.id}
            id={`feature-${f.id}`}
            onClick={() => router.push(f.href)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="glass-card flex flex-col text-left cursor-pointer"
            style={{
              flex: '1 1 300px',
              maxWidth: '360px',
              padding: '2rem',
              background: 'transparent',
            }}
          >
            {f.icon}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.5rem' }}>{f.title}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>{f.desc}</p>
            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Open <span style={{ fontSize: '1.1rem' }}>→</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Logout */}
      <motion.button
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={async () => { await axios.post('/api/auth/logout', {}, { withCredentials: true }); router.replace('/'); }}
        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-800 rounded-lg"
        style={{ marginTop: '5rem' }}
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </motion.button>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}
        style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Loading...
      </motion.div>
    </main>
  );
}
