'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isSuperAdmin, session } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = session.get();
    if (s?.token && isSuperAdmin(s.user)) router.replace('/');
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
      if (!isSuperAdmin(user)) {
        throw new Error('Access restricted: Users portal is for Super Admin only.');
      }
      session.set({ token: data.token || data.Token, user });
      router.replace('/');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ textAlign: 'center' }}>
          GOCs <span>Users</span>
        </div>
        <div className="brand-tag" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Super Admin · RBAC
        </div>
        <h1>Sign in</h1>
        <p className="sub">Manage users and assign portal roles</p>
        {error ? <div className="error-box">{error}</div> : null}
        <form className="form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@digitaldive.demo"
              required
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
