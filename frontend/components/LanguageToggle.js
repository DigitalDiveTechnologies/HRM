'use client';

import { useLocale } from '../lib/i18n/LocaleContext';

export default function LanguageToggle({ className = 'lang-toggle' }) {
  const { locale, t, toggleLocale } = useLocale();
  return (
    <button
      type="button"
      className={className}
      onClick={toggleLocale}
      aria-label={t('language')}
      title={t('language')}
    >
      {locale === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
