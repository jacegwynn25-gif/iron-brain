import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './providers/AuthProvider';
import { ProgramProvider } from './providers/ProgramProvider';
import { WorkoutDataProvider } from './providers/WorkoutDataProvider';
import { ActiveSessionProvider } from './providers/ActiveSessionProvider';
import { DialogProvider } from './providers/DialogProvider';
import { ErrorBoundary } from './components/ErrorBoundary';

import OnboardingWrapper from './components/onboarding/OnboardingWrapper';
import SyncQueueListener from './components/SyncQueueListener';
import RouteTransition from './components/RouteTransition';
import AppLayout from './components/layout/AppLayout';
import { PUBLIC_APP_URL } from './lib/public-url';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_APP_URL),
  title: {
    default: 'Iron Brain - Smart Workout Planning',
    template: '%s | Iron Brain',
  },
  description: 'Smart workout logging, readiness, and program adjustments for lifters.',
  applicationName: 'Iron Brain',
  creator: 'Iron Brain',
  publisher: 'Iron Brain',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Iron Brain - Smart Workout Planning',
    description: 'Smart workout logging, readiness, and program adjustments for lifters.',
    url: PUBLIC_APP_URL,
    siteName: 'Iron Brain',
    type: 'website',
    images: [
      {
        url: '/icons/iron-brain-ib-1024.png',
        width: 1024,
        height: 1024,
        alt: 'Iron Brain logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Iron Brain - Smart Workout Planning',
    description: 'Smart workout logging, readiness, and program adjustments for lifters.',
    images: ['/icons/iron-brain-ib-1024.png'],
  },
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
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/iron-brain-ib-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/iron-brain-ib-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
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
                <ActiveSessionProvider>
                  <DialogProvider>
                    <OnboardingWrapper>
                      <AppLayout>
                        <RouteTransition>{children}</RouteTransition>
                      </AppLayout>
                    </OnboardingWrapper>
                  </DialogProvider>
                </ActiveSessionProvider>
              </WorkoutDataProvider>
            </ProgramProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>

    </html>
  );
}
