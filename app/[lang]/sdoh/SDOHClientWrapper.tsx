"use client"

import { i18n } from "../../../i18n-config"
import type { Locale } from "../../../i18n-config"
import dynamic from "next/dynamic"
import { useState, useEffect } from "react"

// Import the language toggle directly
import SDOHLanguageToggle from "./SDOHLanguageToggle"

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

interface SDOHClientWrapperProps {
  initialLocale?: string
}

export default function SDOHClientWrapper({ initialLocale = i18n.defaultLocale }: SDOHClientWrapperProps) {
  // Ensure we have a valid locale
  const safeLocale =
    initialLocale && i18n.locales.includes(initialLocale as Locale) ? (initialLocale as Locale) : i18n.defaultLocale

  // Add state to track if we're in the browser
  const [isMounted, setIsMounted] = useState(false)

  // Only render client components after mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Don't render anything during SSR to prevent hydration errors
  if (!isMounted) {
    return <LoadingFallback />
  }

  return (
    <>
      {/* Language toggle positioned to avoid navbar */}
      <div className="fixed top-[70px] right-5 z-[9999]">
        <SDOHLanguageToggle showOnScroll={true} />
      </div>

      {/* Client page that doesn't rely on server props */}
      <SDOHClientPageDynamic locale={safeLocale as Locale} />
    </>
  )
}
