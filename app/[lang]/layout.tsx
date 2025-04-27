import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "../globals.css"
import { getDictionary } from "../lib/dictionary"
import type { Locale } from "../../i18n-config"
import { i18n } from "../../i18n-config"
import ClientLayout from "./ClientLayout"

const inter = Inter({ subsets: ["latin"], display: "swap" })

// Generate metadata with proper alternates for SEO
export async function generateMetadata({
  params,
}: {
  params: { lang: Locale }
}): Promise<Metadata> {
  // Get dictionary for current locale
  const dict = await getDictionary(params.lang)

  return {
    title: params.lang === "en" ? "SDOH | 434 Media" : "SDOH | 434 Media",
    description:
      params.lang === "en"
        ? "Social Determinants of Health initiative by 434 Media."
        : "Iniciativa de Determinantes Sociales de la Salud por 434 Media.",
    alternates: {
      canonical: `https://434.media/${params.lang}/sdoh`,
      languages: {
        en: "https://434.media/en/sdoh",
        es: "https://434.media/es/sdoh",
      },
    },
    openGraph: {
      title: params.lang === "en" ? "SDOH | 434 Media" : "SDOH | 434 Media",
      description:
        params.lang === "en"
          ? "Social Determinants of Health initiative by 434 Media."
          : "Iniciativa de Determinantes Sociales de la Salud por 434 Media.",
      url: `https://434.media/${params.lang}/sdoh`,
      siteName: "434 Media",
      locale: params.lang,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: params.lang === "en" ? "SDOH | 434 Media" : "SDOH | 434 Media",
      description:
        params.lang === "en"
          ? "Social Determinants of Health initiative by 434 Media."
          : "Iniciativa de Determinantes Sociales de la Salud por 434 Media.",
    },
  }
}

// Generate static params for all supported locales
export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// Define the props type explicitly
type Props = {
  children: React.ReactNode
  params: { lang: string }
}

export default async function Layout({ children, params }: Props) {
  // Add defensive checks to handle potential undefined values
  if (!params || !params.lang) {
    console.error("Missing params or params.lang in Layout")
    // Fallback to default locale
    const defaultLocale = i18n.defaultLocale
    const dict = await getDictionary(defaultLocale as Locale)

    return <ClientLayout params={{ lang: defaultLocale as Locale }}>{children}</ClientLayout>
  }

  try {
    // Get the dictionary with proper error handling
    const dict = await getDictionary(params.lang as Locale)

    return <ClientLayout params={{ lang: params.lang as Locale }}>{children}</ClientLayout>
  } catch (error) {
    console.error("Error in Layout:", error)
    // Fallback to default locale if there's an error
    const defaultLocale = i18n.defaultLocale
    const dict = await getDictionary(defaultLocale as Locale)

    return <ClientLayout params={{ lang: defaultLocale as Locale }}>{children}</ClientLayout>
  }
}
