import './globals.css';

export const metadata = {
  title: 'Digital Dive HR Portal',
  description: 'Digital Dive HR Portal — Next.js + .NET API',
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
