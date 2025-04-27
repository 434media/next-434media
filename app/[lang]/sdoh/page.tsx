import { i18n } from "../../../i18n-config"
import type { Locale } from "../../../i18n-config"
import SDOHLanguageToggle from "./SDOHLanguageToggle"
import SDOHClientWrapper from "./SDOHClientWrapper"

// Define the props type explicitly
type Props = {
  params?: { lang?: string } // Make both params and lang optional
}

// Validate the language parameter
function isValidLocale(lang?: string): lang is Locale {
  if (!lang) return false
  return i18n.locales.includes(lang as Locale)
}

// Generate static params to pre-render these pages at build time
export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// Force dynamic rendering for this page
export const dynamic = "force-dynamic"
export const dynamicParams = true

// This is the updated page component with extremely defensive programming
export default function SDOHPage(props: Props) {
  // Default locale as fallback
  const defaultLocale = i18n.defaultLocale

  // Super defensive check for props and params
  if (!props || typeof props !== "object") {
    console.error("SDOHPage received invalid props")
    return renderWithFallbackLocale(defaultLocale)
  }

  // Check if params exists
  const { params } = props
  if (!params || typeof params !== "object") {
    console.error("SDOHPage missing params object")
    return renderWithFallbackLocale(defaultLocale)
  }

  // Check if lang exists and is valid
  const { lang } = params
  if (!lang || typeof lang !== "string") {
    console.error("SDOHPage missing lang parameter")
    return renderWithFallbackLocale(defaultLocale)
  }

  // Validate the locale
  if (!isValidLocale(lang)) {
    console.error("SDOHPage received invalid locale:", lang)
    return renderWithFallbackLocale(defaultLocale)
  }

  // If we got here, we have a valid locale
  return renderWithFallbackLocale(lang as Locale)
}

// Helper function to render the page with a guaranteed valid locale
function renderWithFallbackLocale(locale: Locale) {
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
