import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

// Geist Mono and Menda Black are NOT preloaded.
//
// Measured on the Work page at both Lighthouse presets: the first screen renders
// in Geist and GGX88 only, and those are the only two faces the browser reports
// as loaded. next/font preloads every face by default, so all four were being
// fetched in the critical window — about 105 KB competing with the LCP image on
// a throttled link.
//
// web.dev's font best practices: preload "comes at the cost of taking away
// browser resources from the loading of other resources", and preloading should
// be selective. Both keep display: swap, so when a later screen needs them the
// text renders immediately in the fallback and swaps.
//
// SITE-WIDE — these are declared in the root layout. No typeface, weight or
// visual changes; only when the file is fetched.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
})

const mendaBlack = localFont({
  src: "../fonts/Menda-Black.otf",
  variable: "--font-menda-black",
  display: "swap",
  preload: false,
})

const ggx88Font = localFont({
  src: "../fonts/GGX88.otf",
  variable: "--font-ggx88",
  display: "swap",
})

// Define the base URL for the site
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

const defaultTitle = `${BRAND.name} — ${BRAND_RECORDS.shortDescriptor}`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s | ${BRAND.name}`,
    default: defaultTitle,
  },
  description: BRAND.description,
  keywords: [
    BRAND.name,
    "brand campaigns",
    "event production",
    "brand storytelling",
    "video production",
    "San Antonio",
    "Texas",
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": `${siteUrl}/`,
      "es-ES": `${siteUrl}/es`,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: BRAND.name,
    title: defaultTitle,
    description: BRAND.description,
    // Image is auto-wired by app/opengraph-image.tsx (Next file convention)
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: BRAND.description,
    creator: "@434media",
    site: "@434media",
    // Image is auto-wired by app/twitter-image.tsx (Next file convention)
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
    other: {
      rel: "apple-touch-icon-precomposed",
      url: "/apple-touch-icon-precomposed.png",
    },
  },
  verification: {
    // Add your verification codes if you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
}

/**
 * The root layout carries only what every route shares: the document, the
 * stylesheet, the fonts, the metadata defaults and the hreflang links.
 *
 * It reads no cookies or headers and fetches nothing, so it never makes a page
 * dynamic. Public pages get their structured data, trackers and chrome from
 * app/(site)/layout.tsx and app/(shop)/layout.tsx (components/PublicShell.tsx);
 * /admin, /travel and /squads get none of it (2b fix 9).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Basic hreflang links for primary locales */}
        <link rel="alternate" hrefLang="en" href={`${siteUrl}/`} />
        <link rel="alternate" hrefLang="es" href={`${siteUrl}/es`} />
        <link rel="alternate" hrefLang="x-default" href={`${siteUrl}/`} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mendaBlack.variable} ${ggx88Font.variable} antialiased min-h-screen flex flex-col`}
      >
        {children}
      </body>
    </html>
  )
}
