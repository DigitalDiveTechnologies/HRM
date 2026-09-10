'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, session, value } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

const nav = [
  ['/', 'Dashboard', '▦'],
  ['/attendance', 'Attendance', '◷'],
  ['/leaves', 'Leaves', '◫'],
  ['/onboarding', 'Onboarding', '✓'],
  ['/profile', 'My Profile', '◉'],
];

export default function PortalShell({ title, subtitle, children }) {
  const router = useRouter(); const pathname = usePathname();
  const [user, setUser] = useState(null); const [open, setOpen] = useState(false); const [notificationCount, setNotificationCount] = useState(0);
  useEffect(() => {
    const current = session.get();
    if (!current?.token || current?.user?.role?.toLowerCase() !== 'employee') { router.replace('/login'); return; }
    setUser(current.user);
    api('/notifications').then((rows) => setNotificationCount((rows || []).filter((x) => !value(x, 'isRead', 'is_read')).length)).catch(() => {});
  }, [router]);
  function logout() { session.clear(); router.replace('/login'); }
  if (!user) return <div className="loading">Loading your portal…</div>;
  return <div className="shell">
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">☰</button>
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand"><b>digitaldive</b><span>HR</span><small>EMPLOYEE PORTAL</small></div>
      <nav>{nav.map(([href, label, icon]) => <Link key={href} href={href} className={pathname === href ? 'active' : ''} onClick={() => setOpen(false)}><i>{icon}</i>{label}</Link>)}</nav>
      <div className="sidebar-user"><strong>{user.fullName || user.email}</strong><small>{user.jobTitle || 'Employee'}</small><button onClick={logout}>Sign out</button></div>
    </aside>
    <main className="main"><header><div><h1>{title}</h1><p>{subtitle}</p></div><div className="top-actions"><span className="bell">♢{notificationCount ? <b>{notificationCount}</b> : null}</span><ThemeToggle /><div className="avatar">{(user.fullName || user.email || 'E').slice(0, 1).toUpperCase()}</div></div></header>{children}</main>
  </div>;
}
