import './globals.css';
import { LocaleProvider } from '@/lib/LocaleContext';

export const metadata = { title: 'Digital Dive HR | Employee Portal', description: 'Employee self-service portal' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('hr_locale')||'en';if(l!=='ar'&&l!=='en')l='en';var d=l==='ar'?'rtl':'ltr';document.documentElement.lang=l;document.documentElement.dir=d;document.documentElement.setAttribute('data-locale',l);var th=localStorage.getItem('employee_portal_theme');if(th==='dark'||th==='light'){document.documentElement.setAttribute('data-theme',th);}}catch(e){document.documentElement.lang='en';document.documentElement.dir='ltr';}})();`,
          }}
        />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
