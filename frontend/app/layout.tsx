import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'PESU Tracker',
  description: 'Track your PESU Academy attendance with smart analytics — bunk calculator, recovery guide, and subject-wise breakdown.',
  keywords: 'PESU, attendance, tracker, PES University, bunk calculator',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
