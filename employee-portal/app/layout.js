import './globals.css';

export const metadata = { title: 'Digital Dive HR | Employee Portal', description: 'Employee self-service portal' };

export default function RootLayout({ children }) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
