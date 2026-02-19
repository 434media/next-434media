"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { Locale } from "../i18n-config"
import { i18n } from "../i18n-config"
import type { Dictionary } from "../types/dictionary"

// Cache for dictionaries to avoid repeated fetching
const dictionaryCache: Record<string, Dictionary> = {}

interface LanguageContextType {
  dictionary: Dictionary
  currentLocale: Locale
  isLoading: boolean
  switchLanguage: (newLocale: Locale) => Promise<void>
}

const defaultContext: LanguageContextType = {
  dictionary: {} as Dictionary,
  currentLocale: i18n.defaultLocale,
  isLoading: false,
  switchLanguage: async () => {},
}

const LanguageContext = createContext<LanguageContextType>(defaultContext)

export function LanguageProvider({
  children,
  dictionary: initialDictionary,
  locale: initialLocale,
}: {
  children: React.ReactNode
  dictionary: Dictionary
  locale: Locale
}) {
  const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary)
  const [currentLocale, setCurrentLocale] = useState<Locale>(initialLocale)
  const [isLoading, setIsLoading] = useState(false)

  // Cache the initial dictionary
  useEffect(() => {
    dictionaryCache[initialLocale] = initialDictionary
  }, [initialLocale, initialDictionary])

  // Load saved language preference on initial mount
  useEffect(() => {
    const savedLocale = localStorage.getItem("preferredLanguage") as Locale | null

    if (savedLocale && i18n.locales.includes(savedLocale) && savedLocale !== currentLocale) {
      // If we have the dictionary cached, use it immediately
      if (dictionaryCache[savedLocale]) {
        setDictionary(dictionaryCache[savedLocale])
        setCurrentLocale(savedLocale)
      } else {
        // Otherwise fetch it
        fetchDictionary(savedLocale).then((newDictionary) => {
          if (newDictionary) {
            setDictionary(newDictionary)
            setCurrentLocale(savedLocale)
          }
        })
      }
    }
  }, [])

  // Function to fetch dictionary
  const fetchDictionary = async (locale: Locale): Promise<Dictionary | null> => {
    try {
      // Check cache first
      if (dictionaryCache[locale]) {
        return dictionaryCache[locale]
      }

      const response = await fetch(`/api/dictionary?locale=${locale}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dictionary: ${response.status}`)
      }

      const newDictionary = await response.json()

      // Cache the dictionary
      dictionaryCache[locale] = newDictionary

      return newDictionary
    } catch (error) {
      console.error("Error fetching dictionary:", error)
      return null
    }
  }

  // Function to switch language without page refresh
  const switchLanguage = useCallback(
    async (newLocale: Locale): Promise<void> => {
      if (newLocale === currentLocale || !i18n.locales.includes(newLocale)) return

      setIsLoading(true)
      console.log(`Switching language to: ${newLocale}`)

      try {
        // Save the current scroll position
        const scrollPosition = window.scrollY

        // Get dictionary (from cache or fetch)
        const newDictionary = await fetchDictionary(newLocale)

        if (!newDictionary) {
          throw new Error("Failed to get dictionary")
        }

        // Update state with new dictionary and locale
        setDictionary(newDictionary)
        setCurrentLocale(newLocale)

        // Save preference to localStorage
        localStorage.setItem("preferredLanguage", newLocale)

        // Restore scroll position
        window.scrollTo(0, scrollPosition)

        console.log(`Language switched to: ${newLocale}`)
      } catch (error) {
        console.error("Error switching language:", error)
      } finally {
        setIsLoading(false)
      }
    },
    [currentLocale],
  )

  const contextValue = {
    dictionary,
    currentLocale,
    isLoading,
    switchLanguage,
  }

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
