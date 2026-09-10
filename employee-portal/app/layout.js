import './globals.css';
import { LocaleProvider } from '@/lib/LocaleContext';

export const metadata = { title: 'Digital Dive HR | Employee Portal', description: 'Employee self-service portal' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('hr_locale')||'en';if(l!=='ar'&&l!=='en')l='en';var d=l==='ar'?'rtl':'ltr';document.documentElement.lang=l;document.documentElement.dir=d;document.documentElement.setAttribute('data-locale',l);}catch(e){document.documentElement.lang='en';document.documentElement.dir='ltr';}})();`,
          }}
        />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
