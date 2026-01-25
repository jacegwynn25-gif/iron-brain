import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import { ProgramProvider } from "./providers/ProgramProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import BottomNav from "./components/BottomNav";
import OnboardingWrapper from "./components/onboarding/OnboardingWrapper";
import SyncQueueListener from "./components/SyncQueueListener";
import RouteTransition from "./components/RouteTransition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Iron Brain - Training Planner",
  description: "Workout tracking, planning, and analytics",
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
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0b0d12',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="app-gradient">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh safe-top app-gradient`}>
        <ErrorBoundary>
          <AuthProvider>
            <ProgramProvider>
              <SyncQueueListener />
              <OnboardingWrapper>
                <main className="pb-20">
                  <RouteTransition>{children}</RouteTransition>
                </main>
                <BottomNav />
              </OnboardingWrapper>
            </ProgramProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
