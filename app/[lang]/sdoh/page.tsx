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
  // Defensive programming - ensure params exists and has a valid lang property
  const locale = params?.lang && isValidLocale(params.lang) ? params.lang : i18n.defaultLocale

  try {
    // Get the dictionary
    const dict = await getDictionary(locale)

    return (
      <>
        {/* Language toggle positioned to avoid navbar */}
        <div className="fixed top-[70px] right-5 z-[9999]">
          <SDOHLanguageToggle currentLocale={locale} />
        </div>

        {/* Full content client page */}
        <SDOHClientPage lang={locale} dict={dict} />
      </>
    )
  } catch (error) {
    console.error("Error in SDOH Page:", error)

    // Fallback to a minimal rendering to prevent build failures
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold">SDOH Page</h1>
          <p className="mt-4">There was an error loading this page. Please try again later.</p>
        </div>
      </div>
    )
  }
}
