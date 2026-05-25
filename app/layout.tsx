import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"]
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Thread Theory Home | Premium Bedsheets via Instagram",
    template: "%s | Thread Theory Home"
  },
  description:
    "Premium bedsheets discovered on Instagram, ordered in DMs, and tracked through a simple private link.",
  applicationName: "Thread Theory Home",
  keywords: [
    "bedsheets",
    "premium bedsheets",
    "bedding",
    "Instagram bedsheet store",
    "Thread Theory Home",
    "bedsheets India"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Thread Theory Home | Premium Bedsheets via Instagram",
    description:
      "Instagram-first premium bedding with direct order confirmation and private tracking.",
    siteName: "Thread Theory Home",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Thread Theory Home"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Thread Theory Home | Premium Bedsheets via Instagram",
    description:
      "Instagram-first premium bedding with direct order confirmation and private tracking.",
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <FirebaseAnalytics />
        {children}
      </body>
    </html>
  );
}
