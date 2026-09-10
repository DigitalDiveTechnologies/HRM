'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, session } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (session.get()?.user?.role?.toLowerCase() === 'employee') router.replace('/'); }, [router]);
  async function submit(e) { e.preventDefault(); setError(''); setBusy(true); try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); const user = data.user || data.User; if (!user || user.role?.toLowerCase() !== 'employee') throw new Error('This portal is for employee accounts only.'); session.set({ token: data.token || data.Token, user }); router.replace('/'); } catch (err) { setError(err.message || 'Unable to sign in.'); } finally { setBusy(false); } }
  return <div className="login"><div className="login-toggle"><ThemeToggle /></div><form onSubmit={submit} className="login-card"><div className="login-brand"><b>digitaldive</b><span>HR</span></div><p className="eyebrow">EMPLOYEE SELF SERVICE</p><h1>Welcome back</h1><p>Sign in to view your HR information.</p>{error && <div className="error">{error}</div>}<label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label><button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></div>;
}
