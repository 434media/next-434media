import { i18n } from "../../../i18n-config"
import type { Locale } from "../../../i18n-config"
import SDOHLanguageToggle from "./SDOHLanguageToggle"
import SDOHClientWrapper from "./SDOHClientWrapper"

// Define the props type explicitly
type Props = {
  params: { lang: string }
}

// Validate the language parameter
function isValidLocale(lang: string): lang is Locale {
  return i18n.locales.includes(lang as Locale)
}

// Generate static params to pre-render these pages at build time
export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// Force dynamic rendering for this page
export const dynamic = "force-dynamic"
export const dynamicParams = true

// This is the updated page component with minimal static content
export default function SDOHPage({ params }: Props) {
  // Defensive programming - ensure params exists and has a valid lang property
  const locale = params?.lang && isValidLocale(params.lang) ? params.lang : i18n.defaultLocale

  return (
    <>
      {/* Language toggle positioned to avoid navbar */}
      <div className="fixed top-[70px] right-5 z-[9999]">
        <SDOHLanguageToggle currentLocale={locale} />
      </div>

      {/* Use the client wrapper to handle dynamic loading */}
      <SDOHClientWrapper lang={locale} />
    </>
  )
}
