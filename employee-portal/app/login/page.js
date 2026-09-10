'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, session } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session.get()?.user?.role?.toLowerCase() === 'employee') {
      router.replace('/');
    }
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const user = data.user || data.User;
      if (!user || user.role?.toLowerCase() !== 'employee') {
        throw new Error('Access restricted: This portal is for employee accounts only.');
      }
      session.set({ token: data.token || data.Token, user });
      router.replace('/');
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        padding: '24px 16px',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <ThemeToggle />
      </div>

      <div
        className="panel-card"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '36px 32px',
          boxShadow: 'var(--shadow)',
          borderRadius: 12,
        }}
      >
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div className="brand-logo" style={{ justifyContent: 'center', fontSize: 24 }}>
            GOCs <span className="accent">HR</span>
          </div>
          <div className="brand-tag" style={{ marginTop: 4 }}>EMPLOYEE SELF SERVICE PORTAL</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '20px 0 6px', color: 'var(--ink)' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            Sign in with your registered employee credentials
          </p>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <div className="form-field">
            <label>Work Email</label>
            <input
              type="email"
              placeholder="e.g. employee@digitaldive.demo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={busy}
            style={{ width: '100%', marginTop: 8, padding: '11px' }}
          >
            {busy ? 'Signing in…' : 'Sign In to Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
