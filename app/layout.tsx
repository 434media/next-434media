import type React from "react"
import type { Metadata } from "next"
import { Geist, Azeret_Mono as Geist_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import "remixicon/fonts/remixicon.css"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const mendaBlack = localFont({
  src: './fonts/Menda-Black.otf', 
  variable: "--font-menda-black",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"),
  title: {
    template: "%s | 434 MEDIA",
    default: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
  },
  description: "434 MEDIA connects enterprises in San Antonio and the South Texas region by leveraging networks to connect people, places, and things through creative media and smart marketing.",
  keywords: ["434 MEDIA", "San Antonio", "Texas", "creative media", "smart marketing", "enterprise", "networks", "people", "places", "things"],
  authors: [{ name: "434 MEDIA"}],
  creator: "434 MEDIA",
  publisher: "434 MEDIA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
    description: "434 MEDIA connects enterprises in San Antonio and the South Texas region by leveraging networks to connect people, places, and things through creative media and smart marketing.",
    url: "https://www.434media.com",
    siteName: "434 MEDIA",
    images: [
      {
        url: "https://www.434media.com/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "434 MEDIA logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "434 MEDIA | Creative Media and Smart Marketing Solutions in San Antonio, TX",
    description: "434 MEDIA connects enterprises in San Antonio and the South Texas region by leveraging networks to connect people, places, and things through creative media and smart marketing.",
    images: ["https://www.434media.com/opengraph-image.png"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} ${mendaBlack.variable} antialiased`}>
        <Navbar />
          {children}
        <Footer />
      </body>
    </html>
  )
}

