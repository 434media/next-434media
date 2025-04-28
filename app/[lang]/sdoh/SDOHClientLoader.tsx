"use client"

import { useEffect, useState } from "react"
import { i18n, type Locale } from "../../../i18n-config"
import { getDictionaryClient } from "@/app/lib/client-dictionary"
import { usePathname } from "next/navigation"
import SDOHClientPage from "./SDOHClientPage"
import { LanguageProvider } from "@/app/context/language-context"

// Create a minimal fallback dictionary
const fallbackDict = {
  sdoh: {
    title: "¿Qué es SDOH?",
    newsletter: {
      title: 'Signup for "Que es SDOH" newsletter',
      subtitle: "Join the conversation now.",
    },
  },
}

export default function SDOHClientLoader({ locale: initialLocale }: { locale: Locale }) {
  const [dictionary, setDictionary] = useState<any>(fallbackDict)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // Extract locale from URL path on client side
    const pathLocale = pathname.split("/")[1] as string
    const validLocale: Locale = i18n.locales.includes(pathLocale as Locale) ? (pathLocale as Locale) : initialLocale

    // Set the validated locale
    setLocale(validLocale)

    // Load dictionary
    const loadDictionary = async () => {
      try {
        const dict = await getDictionaryClient(validLocale)
        setDictionary(dict)
      } catch (error) {
        console.error("Error loading dictionary:", error)
        // Continue with fallback dictionary
      } finally {
        setIsLoading(false)
      }
    }

    loadDictionary()
  }, [pathname, initialLocale])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <LanguageProvider initialLocale={locale} initialDictionary={dictionary}>
      <SDOHClientPage locale={locale} />
    </LanguageProvider>
  )
}
