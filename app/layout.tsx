import type { Metadata } from 'next';
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
    icon: '/icon-192.png',
    shortcut: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
