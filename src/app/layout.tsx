import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GlobalWeddingTools } from "@/components/wedding/global-wedding-tools";
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
          <Toaster />
          <GlobalWeddingTools />
        </ThemeProvider>
      </body>
    </html>
  );
}
