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
import { APP_VERSION } from './lib/app-version';
import AppResilienceStatus from './components/AppResilienceStatus';

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){window.__ironBrainSyncQueueEvents=window.__ironBrainSyncQueueEvents||[];window.addEventListener('iron-brain:sync-queue',function(event){if(window.__ironBrainSyncQueueReady)return;window.__ironBrainSyncQueueEvents.push(event.detail||{});if(window.__ironBrainSyncQueueEvents.length>10)window.__ironBrainSyncQueueEvents.shift();});function sync(){if(navigator.onLine){document.body.removeAttribute('data-iron-offline')}else{document.body.setAttribute('data-iron-offline','true')}}window.addEventListener('online',sync);window.addEventListener('offline',sync);sync();})();`,
          }}
        />
        <div
          className="app-offline-fallback pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.65rem)] z-[var(--z-toast)] justify-center"
          data-testid="app-resilience-offline"
          role="status"
          aria-live="polite"
        >
          <div className="liquid-sheet-panel flex w-full max-w-md items-center gap-3 px-3 py-2.5 text-amber-200">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
              !
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-70">Offline Mode</p>
              <p className="mt-0.5 truncate text-xs font-black uppercase tracking-[0.08em] text-white">Saving locally</p>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">
                Workout changes stay on this device until connection returns.
              </p>
            </div>
          </div>
        </div>
        <ErrorBoundary>
          <AuthProvider>
            <ProgramProvider>
              <WorkoutDataProvider>
                <SyncQueueListener />
                <AppResilienceStatus currentVersion={APP_VERSION} />
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
