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
    languages: {
      "en-US": `${siteUrl}/`,
      "es-ES": `${siteUrl}/es`,
    },
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
  {/* Basic hreflang links for primary locales */}
  <link rel="alternate" hrefLang="en" href={`${siteUrl}/`} />
  <link rel="alternate" hrefLang="es" href={`${siteUrl}/es`} />
  <link rel="alternate" hrefLang="x-default" href={`${siteUrl}/`} />

        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-569XSBBR');
          `}
        </Script>
        {/* End Google Tag Manager */}

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

        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '2997115723796668');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=2997115723796668&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}

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
        {/* Simpli.fi Retargeting Script */}
        <Script
          src="https://tag.simpli.fi/sifitag/5ea76a26-ff7f-46cf-b7d3-47031c857acb"
          strategy="afterInteractive"
          async
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mendaBlack.variable} ${ggx88Font.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Structured Data: Organization & WebSite with potential SearchAction */}
        <script
          type="application/ld+json"
          // Keep this lightweight & generated server-side (no dynamic client data required)
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: '434 MEDIA',
              url: siteUrl,
              logo: `${siteUrl}/opengraph-image.png`,
              sameAs: [
                'https://www.facebook.com/434media',
                'https://www.linkedin.com/company/434media',
                'https://x.com/434media',
                'https://www.instagram.com/digitalcanvas.community'
              ],
              contactPoint: [{
                '@type': 'ContactPoint',
                contactType: 'customer support',
                email: 'build@434media.com',
                availableLanguage: ['en','es']
              }]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: '434 MEDIA',
              url: siteUrl,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${siteUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string'
              }
            })
          }}
        />
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-569XSBBR"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

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
