"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import { i18n } from "../../../i18n-config"
import type { Locale } from "../../../i18n-config"
import SDOHLanguageToggle from "./SDOHLanguageToggle"
import dynamic from "next/dynamic"

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Loading SDOH Page...</h1>
        <p className="mt-4">Please wait while we load the content.</p>
      </div>
    </div>
  )
}

// Dynamically import the client page with no SSR
const SDOHClientPageDynamic = dynamic(() => import("./SDOHClientPage"), {
  ssr: false,
  loading: () => <LoadingFallback />,
})

export default function SDOHClientWrapper() {
  // Get the locale from the URL client-side instead of relying on server props
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()

  // Determine locale from URL path
  const [currentLocale, setCurrentLocale] = useState<Locale>(i18n.defaultLocale)

  // Set locale based on URL when component mounts
  useEffect(() => {
    // Extract locale from URL path
    let detectedLocale: Locale = i18n.defaultLocale

    if (pathname) {
      // Check for /es/ or /en/ in the path
      if (pathname.includes("/es/")) {
        detectedLocale = "es"
      } else if (pathname.includes("/en/")) {
        detectedLocale = "en"
      } else {
        // If no locale in path, check params
        const langParam = params?.lang
        if (typeof langParam === "string" && i18n.locales.includes(langParam as Locale)) {
          detectedLocale = langParam as Locale
        }
      }
    }

    setCurrentLocale(detectedLocale)
  }, [pathname, params])

  // Handle language change
  const handleLanguageChange = (newLocale: Locale) => {
    try {
      // Navigate to the new locale
      const newPath = pathname?.replace(/\/(en|es)\//, `/${newLocale}/`) || `/${newLocale}/sdoh`
      router.push(newPath)
      setCurrentLocale(newLocale)
    } catch (error) {
      console.error("Error changing language:", error)
      router.push(`/${i18n.defaultLocale}/sdoh`)
    }
  }

  return (
    <>
      {/* Language toggle positioned to avoid navbar */}
      <div className="fixed top-[70px] right-5 z-[9999]">
        <SDOHLanguageToggle currentLocale={currentLocale} onLanguageChange={handleLanguageChange} />
      </div>

      {/* Client page that doesn't rely on server props */}
      <SDOHClientPageDynamic locale={currentLocale} />
    </>
  )
}
