'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MESSAGES } from './messages';

const LocaleContext = createContext({
  locale: 'en',
  dir: 'ltr',
  t: (key) => key,
  setLocale: () => {},
  toggleLocale: () => {},
});

const STORAGE_KEY = 'hr_locale';

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') setLocaleState(saved);
    } catch { /* ignore */ }
  }, []);

  const applyDom = useCallback((next) => {
    if (typeof document === 'undefined') return;
    const dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute('data-locale', next);
  }, []);

  useEffect(() => {
    applyDom(locale);
  }, [locale, applyDom]);

  const setLocale = useCallback((next) => {
    const loc = next === 'ar' ? 'ar' : 'en';
    setLocaleState(loc);
    try {
      localStorage.setItem(STORAGE_KEY, loc);
    } catch { /* ignore */ }
    // Best-effort persist to API when logged in
    try {
      const token = localStorage.getItem('hr_token');
      if (token) {
        const base = (typeof window !== 'undefined'
          && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? 'http://localhost:5088'
          : (process.env.NEXT_PUBLIC_API_URL || 'https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment');
        fetch(`${String(base).replace(/\/$/, '')}/api/auth/locale`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ locale: loc }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const t = useCallback((key) => {
    const table = MESSAGES[locale] || MESSAGES.en;
    return table[key] || MESSAGES.en[key] || key;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, dir: locale === 'ar' ? 'rtl' : 'ltr', t, setLocale, toggleLocale }),
    [locale, t, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
