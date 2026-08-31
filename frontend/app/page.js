'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, canUsePortal, clearSession, getUser, hasSession, homeForRole, setSession } from '../lib/auth';
import { BRAND } from '../lib/brand';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasSession()) {
      const u = getUser();
      if (u && canUsePortal(u)) router.replace(homeForRole(u));
      else clearSession();
    }
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const user = data.user || data.User;
      if (!data.token && !data.Token) {
        throw new Error('Login succeeded but no token was returned.');
      }
      if (!canUsePortal(user)) {
        throw new Error(
          `This portal is for administrators only. ${BRAND.employeeAppHint}`,
        );
      }
      setSession(data);
      router.replace(homeForRole(user));
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  const hasPassword = password.length > 0;

  return (
    <div className="login-page">
      <div className="login-theme-wrap">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <img src={BRAND.logoSrc} alt={BRAND.logoAlt} className="login-logo" />
          <div>
            <div className="brand-mark">{BRAND.clientName}</div>
            <div className="login-brand-sub">{BRAND.loginTagline}</div>
          </div>
        </div>
        <h1>{BRAND.portalHeading}</h1>
        <p>{BRAND.portalSubtitle}</p>
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
          {BRAND.demoNotice}
        </p>
        {error ? (
          <div className="error" style={{ display: 'block' }}>
            {error}
          </div>
        ) : null}
        <form onSubmit={onSubmit} autoComplete="on">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={`password-toggle${hasPassword ? '' : ' is-hidden'}`}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                tabIndex={hasPassword ? 0 : -1}
                onClick={() => setShowPass((s) => !s)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                  {showPass ? (
                    <path
                      fill="currentColor"
                      d="M3.1 4.5 4.5 3.1 20.9 19.5 19.5 20.9l-2.2-2.2A11.6 11.6 0 0 1 12 19c-7 0-10-7-10-7a18.9 18.9 0 0 1 5.3-5.7L3.1 4.5zM12 7a5 5 0 0 1 4.9 4l-1.6-1.6A3 3 0 0 0 12 9V7zm9.9 5s-1.1 2.5-3.4 4.4l-1.5-1.5A14 14 0 0 0 20.7 12 18.5 18.5 0 0 0 12 7c-.5 0-1 .05-1.5.1L8.9 5.5C9.9 5.2 10.9 5 12 5c7 0 10 7 10 7z"
                    />
                  ) : (
                    <path
                      fill="currentColor"
                      d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
          <button className="btn block login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
