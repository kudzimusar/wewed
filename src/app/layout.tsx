import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { PWARegister } from "@/components/wedding/pwa-register";
import { InstallPrompt } from "@/components/wedding/install-prompt";
import { AdminTrigger } from "@/components/wedding/admin-trigger";
import { ProgressTrigger } from "@/components/wedding/progress-trigger";
import { AiTrigger } from "@/components/wedding/ai-trigger";
import { WhatsAppRSVP } from "@/components/wedding/whatsapp-rsvp";
import { CoupleLogin } from "@/components/wedding/couple-login";
import { ContributionTrigger } from "@/components/wedding/contribution-trigger";
import { HelpPopups } from "@/components/wedding/help-popups";
import { OnboardingTrigger } from "@/components/wedding/onboarding-trigger";
import { StoreRehydrator } from "@/components/wedding/store-rehydrator";
import { ScrollProgressBackToTop } from "@/components/wedding/scroll-progress";
import { AmbientMusicPlayer } from "@/components/wedding/ambient-music-player";
import { SectionTracker } from "@/components/wedding/section-tracker";
import { KeyboardSectionNav } from "@/components/wedding/keyboard-section-nav";
import { KeyboardShortcutsHelp } from "@/components/wedding/keyboard-shortcuts-help";
import { SkipToContent } from "@/components/wedding/skip-to-content";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wewed.app"),
  title: "wewed — Charity & Kudzie | 23.12.26",
  description:
    "Charity & Kudzie (Mr & Mrs Musarurwa) invite you to celebrate their union at Imba Manor, Harare, Zimbabwe on December 23, 2026. wewed — where love lives forever.",
  keywords: [
    "wewed",
    "wedding",
    "Charity",
    "Kudzie",
    "Musarurwa",
    "Imba Manor",
    "Harare",
    "Zimbabwe",
    "23.12.26",
  ],
  authors: [{ name: "wewed" }],
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "wewed — Charity & Kudzie | 23.12.26",
    description:
      "You are cordially invited to celebrate the union of Charity & Kudzie at Imba Manor, Harare, Zimbabwe.",
    type: "website",
    locale: "en_ZW",
    images: [{ url: "/hero-wedding.png", width: 1344, height: 768, alt: "Charity & Kudzie Wedding" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "wewed — Charity & Kudzie | 23.12.26",
    description: "You are cordially invited to celebrate Charity & Kudzie at Imba Manor, Harare.",
    images: ["/hero-wedding.png"],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#BF9B5F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${inter.variable} ${cormorant.variable} antialiased bg-background text-foreground font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <SkipToContent />
          {children}
          <StoreRehydrator />
          <Toaster />
          <PWARegister />
          <InstallPrompt />
          <AdminTrigger />
          <ProgressTrigger />
          <AiTrigger />
          <WhatsAppRSVP />
          <CoupleLogin />
          <ContributionTrigger />
          <HelpPopups />
          <OnboardingTrigger />
          <ScrollProgressBackToTop />
          <AmbientMusicPlayer />
          <SectionTracker />
          <KeyboardSectionNav />
          <KeyboardShortcutsHelp />
        </ThemeProvider>
      </body>
    </html>
  );
}
