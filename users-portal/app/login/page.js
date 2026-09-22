'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isSuperAdmin, session } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
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
        throw new Error('Access restricted: this portal is for Super Admin only.');
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
    <div className="login-page" style={{ position: 'relative' }}>
      <div className="login-tools">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <div className="mark">
            GOCs <span>Users</span>
          </div>
          <div className="subtag">Users Portal · UAE</div>
        </div>
        <h1>{t('loginTitle')}</h1>
        <p className="lead">{t('loginLead')}</p>
        {error ? <div className="error-box">{error}</div> : null}
        <form className="form" onSubmit={submit}>
          <label>
            {t('email')}
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
            {t('password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? t('signingIn') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
