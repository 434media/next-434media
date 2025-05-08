"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { i18n, type Locale } from "../../i18n-config"
import { getDictionaryClient } from "@/app/lib/client-dictionary"
import type { Dictionary } from "@/app/types/dictionary"

type LanguageContextType = {
  locale: Locale
  dictionary: Dictionary
  setLocale: (locale: Locale) => Promise<void>
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({
  children,
  initialLocale = i18n.defaultLocale,
  initialDictionary = {} as Dictionary,
}: {
  children: ReactNode
  initialLocale?: Locale
  initialDictionary?: Dictionary
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary)
  const [isLoading, setIsLoading] = useState(false)

  // Load dictionary when locale changes
  const loadDictionary = async (locale: Locale) => {
    try {
      const dict = await getDictionaryClient(locale)
      return dict
    } catch (error) {
      console.error("Failed to load dictionary:", error)
      return {} as Dictionary
    }
  }

  // Set locale and update dictionary
  const setLocale = async (newLocale: Locale) => {
    if (newLocale === locale || isLoading) return

    // Save current scroll position
    const scrollPosition = window.scrollY

    setIsLoading(true)

    try {
      // Update URL without refreshing the page
      const currentPath = window.location.pathname
      const newPath = currentPath.replace(`/${locale}/`, `/${newLocale}/`)

      // Update browser history
      window.history.pushState({ scrollPosition, locale: newLocale }, "", newPath)

      // Set cookie for server-side rendering
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`

      // Store in localStorage for persistence
      localStorage.setItem("NEXT_LOCALE", newLocale)

      // Load new dictionary
      const newDictionary = await loadDictionary(newLocale)

      // Update state
      setLocaleState(newLocale)
      setDictionary(newDictionary)

      // Restore scroll position after a short delay to ensure content has updated
      setTimeout(() => {
        window.scrollTo(0, scrollPosition)
      }, 100)
    } catch (error) {
      console.error("Error changing language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize dictionary on mount
  useEffect(() => {
    const initDictionary = async () => {
      if (Object.keys(dictionary).length === 0) {
        setIsLoading(true)
        const dict = await loadDictionary(locale)
        setDictionary(dict)
        setIsLoading(false)
      }
    }

    initDictionary()

    // Handle browser back/forward navigation
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.locale) {
        setLocaleState(event.state.locale)
        loadDictionary(event.state.locale).then(setDictionary)

        // Restore scroll position if available
        if (event.state?.scrollPosition !== undefined) {
          setTimeout(() => {
            window.scrollTo(0, event.state.scrollPosition)
          }, 100)
        }
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [dictionary, locale])

  return (
    <LanguageContext.Provider value={{ locale, dictionary, setLocale, isLoading }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
