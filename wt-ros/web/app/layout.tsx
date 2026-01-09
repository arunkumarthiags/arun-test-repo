import type { Metadata, Viewport } from 'next';
import { Providers } from '@/providers/Providers';

export const metadata: Metadata = {
  title: 'WT-ROS | AI-Native Work Tracking',
  description: 'Real-time work tracking with AI-powered synthesis and automated status reporting',
  keywords: ['work tracking', 'project management', 'AI', 'status reporting'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
