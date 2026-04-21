import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Spectrum Outfitters Raffle",
    template: "%s · Spectrum Outfitters",
  },
  description:
    "Enter Spectrum Outfitters giveaways and raffles. One submission per phone number; optional ticket split across prize pools.",
  icons: {
    icon: "/brand/spectrum-outfitters-icon.png",
    apple: "/brand/spectrum-outfitters-icon.png",
  },
  openGraph: {
    siteName: "Spectrum Outfitters",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-neutral-950 text-neutral-50 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
