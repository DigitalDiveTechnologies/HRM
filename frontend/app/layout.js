import './globals.css';
import { BRAND } from '../lib/brand';

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

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
