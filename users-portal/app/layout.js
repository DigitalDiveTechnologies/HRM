import './globals.css';
import { LocaleProvider } from '@/lib/LocaleContext';

export const metadata = {
  title: 'GOCs | Users Portal',
  description: 'Super Admin — users and role-based access',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('users_portal_theme')||'light';if(t!=='dark'&&t!=='light')t='light';document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('users_portal_locale')||'en';if(l!=='ar'&&l!=='en')l='en';document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';document.documentElement.setAttribute('data-locale',l);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
