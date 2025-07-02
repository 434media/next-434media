import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import "remixicon/fonts/remixicon.css"
import { CombinedNavbar } from "./components/combined-navbar"
import Footer from "./components/Footer"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { getCart, getMenu } from "./lib/shopify"
import { CartProvider } from "./components/shopify/cart/cart-context"
import { PageTransition } from "./components/shopify/page-transition"
import { Suspense } from "react"
import Script from "next/script"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

const mendaBlack = localFont({
  src: "./fonts/Menda-Black.otf",
  variable: "--font-menda-black",
  display: "swap",
})

const ggx88Font = localFont({
  src: "./fonts/GGX88.otf",
  variable: "--font-ggx88",
  display: "swap",
})

// Define the base URL for the site
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | 434 MEDIA",
    default: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
  },
  description:
    "434 MEDIA connects enterprises in San Antonio and South Texas through ROI-driven brand media strategies that move audiences and deliver measurable results.",
  keywords: [
    "434 MEDIA",
    "San Antonio",
    "Texas",
    "creative media",
    "smart marketing",
    "brand storytelling",
    "media strategy",
    "video production",
    "web development",
    "event production",
  ],
  authors: [{ name: "434 MEDIA" }],
  creator: "434 MEDIA",
  publisher: "434 MEDIA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "434 MEDIA",
    title: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
    description:
      "434 MEDIA connects enterprises in San Antonio and South Texas through ROI-driven brand media strategies that move audiences and deliver measurable results.",
    images: [
      {
        url: `${siteUrl}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
    description:
      "434 MEDIA connects enterprises in San Antonio and South Texas through ROI-driven brand media strategies that move audiences and deliver measurable results.",
    images: [`${siteUrl}/opengraph-image.png`],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Don't await the fetch, pass the Promise to the context provider
  const cart = getCart()
  const menu = await getMenu("next-js-frontend-header-menu")

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Google tag (gtag.js) */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-FTWW298D70" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-FTWW298D70');
        `}
        </Script>
        {/* LinkedIn Pixel */}
        <Script id="linkedin-pixel-init" strategy="afterInteractive">
          {`
            _linkedin_partner_id = "7445314";
            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
            window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          `}
        </Script>
        <Script id="linkedin-pixel" strategy="afterInteractive">
          {`
            (function(l) {
              if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
              window.lintrk.q=[]}
              var s = document.getElementsByTagName("script")[0];
              var b = document.createElement("script");
              b.type = "text/javascript";b.async = true;
              b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
              s.parentNode.insertBefore(b, s);
            })(window.lintrk);
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src="https://px.ads.linkedin.com/collect/?pid=7445314&fmt=gif"
          />
        </noscript>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mendaBlack.variable} ${ggx88Font.variable} antialiased min-h-screen flex flex-col`}
      >
        <CartProvider cartPromise={cart}>
          <Suspense>
            <CombinedNavbar menu={menu} />
          </Suspense>
          <main>
            <PageTransition>{children}</PageTransition>
            <Toaster closeButton />
          </main>
          <Analytics />
          <Footer />
        </CartProvider>
      </body>
    </html>
  )
}
