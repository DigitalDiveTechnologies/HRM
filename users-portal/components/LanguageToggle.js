'use client';

import { useLocale } from '@/lib/LocaleContext';

export default function LanguageToggle() {
  const { locale, t, toggleLocale } = useLocale();
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggleLocale}
      aria-label={t('language')}
      title={t('language')}
    >
      {locale === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
