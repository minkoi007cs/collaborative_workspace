import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SyncSpace | Collaborative work',
  description: 'A shared space for teams to coordinate work.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
