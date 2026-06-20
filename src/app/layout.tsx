import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/components/AuthProvider";
import { TelegramInit } from "@/components/TelegramInit";
import { MainScrollContainer } from "@/components/MainScrollContainer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

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
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground flex justify-center min-h-screen`}>
        <TelegramInit />
        <AuthProvider>
          <div 
            className="w-full max-w-[480px] bg-background relative shadow-2xl overflow-hidden flex flex-col mx-auto"
            style={{ 
              height: "var(--tg-viewport-stable-height, 100dvh)",
              paddingTop: "calc(var(--tg-content-safe-area-inset-top, var(--tg-safe-area-inset-top, 0px)) + 12px)",
              paddingBottom: "var(--tg-content-safe-area-inset-bottom, var(--tg-safe-area-inset-bottom, 0px))"
            }}
          >
            <MainScrollContainer>
              {children}
            </MainScrollContainer>
            <BottomNav />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
