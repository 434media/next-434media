"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { Locale } from "../../i18n-config"
import { i18n } from "../../i18n-config"
import type { Dictionary } from "../types/dictionary"

interface LanguageContextType {
  dictionary: Dictionary | null
  isLoading: boolean
  currentLocale: Locale | null
  switchLanguage: (newLocale: Locale) => Promise<void>
}

const LanguageContext = createContext<LanguageContextType>({
  dictionary: null,
  isLoading: true,
  currentLocale: null,
  switchLanguage: async () => {},
})

export function LanguageProvider({
  children,
  dictionary: initialDictionary,
  locale: initialLocale,
}: {
  children: React.ReactNode
  dictionary: Dictionary
  locale: Locale
}) {
  const [dictionary, setDictionary] = useState<Dictionary | null>(initialDictionary)
  const [isLoading, setIsLoading] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<Locale>(initialLocale)

  // Load saved language preference on initial mount
  useEffect(() => {
    const savedLocale = localStorage.getItem("preferredLanguage") as Locale | null

    if (savedLocale && i18n.locales.includes(savedLocale) && savedLocale !== currentLocale) {
      // Don't switch immediately on page load to avoid flashing
      // Just update the state if different
      setCurrentLocale(savedLocale)
    }
  }, [currentLocale])

  // Function to switch language without page refresh
  const switchLanguage = async (newLocale: Locale): Promise<void> => {
    if (newLocale === currentLocale) return

    setIsLoading(true)

    try {
      // Fetch the dictionary for the new locale
      const response = await fetch(`/api/dictionary?locale=${newLocale}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch dictionary: ${response.status}`)
      }

      const newDictionary = await response.json()

      // Update state with new dictionary and locale
      setDictionary(newDictionary)
      setCurrentLocale(newLocale)

      // Save preference to localStorage
      localStorage.setItem("preferredLanguage", newLocale)

      // Update URL without navigation
      const currentPath = window.location.pathname
      const segments = currentPath.split("/")

      // Replace the locale segment (index 1)
      if (segments.length > 1) {
        segments[1] = newLocale
      }

      const newPath = segments.join("/")

      // Update URL without causing navigation
      window.history.pushState({}, "", newPath)

      // Broadcast language change event for other components
      window.dispatchEvent(
        new CustomEvent("languageChanged", {
          detail: { locale: newLocale },
        }),
      )
    } catch (error) {
      console.error("Error switching language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <LanguageContext.Provider value={{ dictionary, isLoading, currentLocale, switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
