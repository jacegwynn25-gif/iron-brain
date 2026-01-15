import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import BottomNav from "./components/BottomNav";
import OnboardingWrapper from "./components/onboarding/OnboardingWrapper";
import SyncQueueListener from "./components/SyncQueueListener";
import DevSeedLoader from "./components/DevSeedLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Iron Brain - Smart Workout Planning",
  description: "Advanced workout tracking and periodization app",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Iron Brain',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: '#09090b' }}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ backgroundColor: '#09090b' }}>
        <ErrorBoundary>
          <AuthProvider>
            <SyncQueueListener />
            <DevSeedLoader />
            <OnboardingWrapper>
              <main className="pb-20">
                {children}
              </main>
              <BottomNav />
            </OnboardingWrapper>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
