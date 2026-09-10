'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const saved = localStorage.getItem('employee_portal_theme') === 'dark'; setDark(saved); document.documentElement.dataset.theme = saved ? 'dark' : 'light'; }, []);
  function toggle() { const next = !dark; setDark(next); localStorage.setItem('employee_portal_theme', next ? 'dark' : 'light'); document.documentElement.dataset.theme = next ? 'dark' : 'light'; }
  return <button className="theme-toggle-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">{dark ? '☀' : '◐'}</button>;
}
