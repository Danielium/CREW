import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "CREW",
  description: "Gamified social platform for running clubs",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground flex justify-center min-h-screen`}>
        <AuthProvider>
          <div className="w-full max-w-[480px] bg-background h-[100dvh] relative shadow-2xl overflow-hidden flex flex-col mx-auto">
            <div id="main-scroll-container" className="flex-1 overflow-y-auto no-scrollbar relative z-10 pb-24">
              {children}
            </div>
            <BottomNav />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
