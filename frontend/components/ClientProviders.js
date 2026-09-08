'use client';

import { LocaleProvider } from '../lib/i18n/LocaleContext';

export default function ClientProviders({ children }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
