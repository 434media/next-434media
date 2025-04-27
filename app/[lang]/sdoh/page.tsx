import { notFound } from "next/navigation"
import type { Locale } from "../../../i18n-config"
import { i18n } from "../../../i18n-config"
import { getDictionary } from "../../lib/dictionary"
import SDOHClientPage from "./SDOHClientPage"
import SDOHLanguageToggle from "./SDOHLanguageToggle"

// Define the props type explicitly
type Props = {
  params: { lang: string }
}

// Validate the language parameter
function isValidLocale(lang: string): lang is Locale {
  return i18n.locales.includes(lang as Locale)
}

// Generate static params to pre-render these pages at build time
export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// This is the updated page component with extra validation and error handling
export default async function SDOHPage({ params }: Props) {
  // Ensure params exists and has a valid lang property
  const lang = params?.lang || i18n.defaultLocale

  // Validate the language parameter
  if (!isValidLocale(lang)) {
    console.error(`Invalid language parameter: ${lang}`)
    return notFound()
  }

  try {
    // Get the dictionary
    const dict = await getDictionary(lang)

    return (
      <>
        {/* Language toggle positioned to avoid navbar */}
        <div className="fixed top-[70px] right-5 z-[9999]">
          <SDOHLanguageToggle currentLocale={lang} />
        </div>

        {/* Full content client page */}
        <SDOHClientPage lang={lang} dict={dict} />
      </>
    )
  } catch (error) {
    console.error("Error in SDOH Page:", error)
    // Fallback to default locale if there's an error
    const defaultLocale = i18n.defaultLocale
    const dict = await getDictionary(defaultLocale)

    return (
      <>
        <div className="fixed top-[70px] right-5 z-[9999]">
          <SDOHLanguageToggle currentLocale={defaultLocale} />
        </div>
        <SDOHClientPage lang={defaultLocale} dict={dict} />
      </>
    )
  }
}
