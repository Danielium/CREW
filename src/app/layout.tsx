import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/components/AuthProvider";
import { TelegramInit } from "@/components/TelegramInit";
import { TelegramBackButton } from "@/components/TelegramBackButton";
import { MainScrollContainer } from "@/components/MainScrollContainer";
import { SplashLoader } from "@/components/SplashLoader";

export const metadata: Metadata = {
  title: "CREW",
  description: "Gamified social platform for running clubs",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground flex justify-center min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <TelegramInit />
        <TelegramBackButton />
        <AuthProvider>
          <div 
            className="w-full max-w-[480px] bg-background relative shadow-2xl overflow-hidden flex flex-col mx-auto"
            style={{ 
              height: "var(--tg-viewport-stable-height, 100dvh)"
            }}
          >
            <SplashLoader>
              <MainScrollContainer>
                {children}
              </MainScrollContainer>
              <BottomNav />
            </SplashLoader>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
