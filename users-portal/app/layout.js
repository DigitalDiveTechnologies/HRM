import './globals.css';

export const metadata = {
  title: 'GOCs | Users Portal',
  description: 'Super Admin — users and role-based access',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
