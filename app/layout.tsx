import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './providers/AuthProvider';
import { ProgramProvider } from './providers/ProgramProvider';
import { WorkoutDataProvider } from './providers/WorkoutDataProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import OnboardingWrapper from './components/onboarding/OnboardingWrapper';
import SyncQueueListener from './components/SyncQueueListener';
import RouteTransition from './components/RouteTransition';
import AppLayout from './components/layout/AppLayout';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Iron Brain - Training Planner',
  description: 'Workout tracking, planning, and analytics',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Iron Brain',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b0d12',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className} min-h-dvh bg-zinc-950 text-zinc-100 antialiased`}>
        <ErrorBoundary>
          <AuthProvider>
            <ProgramProvider>
              <WorkoutDataProvider>
                <SyncQueueListener />
                <OnboardingWrapper>
                  <AppLayout>
                    <RouteTransition>{children}</RouteTransition>
                  </AppLayout>
                </OnboardingWrapper>
              </WorkoutDataProvider>
            </ProgramProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
