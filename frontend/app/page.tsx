'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [srn, setSrn] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    if (!srn.trim() || !password.trim()) {
      setError('Please enter both SRN and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/login', { srn: srn.trim(), password }, { withCredentials: true });
      router.push('/home');
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [srn, password, router]);

  // Global Enter key listener — handles autofill case where no input is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) handleSubmit(e);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleSubmit, loading]);


  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      {/* Logo / Title */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ textAlign: 'center', marginBottom: '2.5rem' }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 7vw, 3rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            lineHeight: 1.2,
            marginBottom: '0.5rem',
          }}
        >
          PESU Tracker
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '0.04em' }}>
          Track · Bunk · Stay Safe
        </p>
      </motion.div>

      {/* Login Card */}
      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}
      >
        <h2
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            marginBottom: '1.75rem',
            color: '#ffffff',
            letterSpacing: '0.02em',
          }}
        >
          Sign in with PESU Academy
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* SRN */}
          <div>
            <label
              htmlFor="srn-input"
              style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em' }}
            >
              SRN / Username
            </label>
            <input
              id="srn-input"
              className="pesu-input"
              type="text"
              placeholder="e.g. PES1PG25CA317"
              value={srn}
              onChange={(e) => setSrn(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e as unknown as FormEvent); }}
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="characters"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password-input"
              style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.06em' }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password-input"
                className="pesu-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Your PESU Academy password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e as unknown as FormEvent); }}
                autoComplete="current-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                id="toggle-password"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPass ? <EyeOff className="w-4 h-4 text-zinc-500" /> : <Eye className="w-4 h-4 text-zinc-500" />}
              </button>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  color: 'var(--danger)',
                  fontSize: '0.83rem',
                  background: 'var(--danger-dim)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            id="login-btn"
            className="pesu-btn"
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <SpinnerIcon />
                Authenticating...
              </span>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>

        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Your credentials are never stored. They are used only to fetch your attendance and marks from PESU Academy and are discarded immediately.
        </p>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}
      >
        Not affiliated with PES University
      </motion.p>
    </main>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#000"
      strokeWidth="2"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
