import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Mission Control',
  description: 'Visualize and simulate AI coding agents in real time',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-amc-panel text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
