import './globals.css';
import { BRAND } from '../lib/brand';
import ClientProviders from '../components/ClientProviders';

export const metadata = {
  title: BRAND.portalTitle,
  description: `${BRAND.clientName} — ${BRAND.loginTagline}`,
  icons: {
    icon: [{ url: BRAND.logoSrc, type: 'image/webp' }],
    apple: [{ url: BRAND.logoSrc, type: 'image/webp' }],
  },
};

const themeBoot = `
(function(){try{var t=localStorage.getItem('hr_theme')||'light';if(t!=='dark'&&t!=='light')t='light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();
`;

const localeBoot = `
(function(){try{var l=localStorage.getItem('hr_locale')||'en';if(l!=='ar'&&l!=='en')l='en';var d=l==='ar'?'rtl':'ltr';document.documentElement.lang=l;document.documentElement.dir=d;document.documentElement.setAttribute('data-locale',l);}catch(e){document.documentElement.lang='en';document.documentElement.dir='ltr';}})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <script dangerouslySetInnerHTML={{ __html: localeBoot }} />
      </head>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
