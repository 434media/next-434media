import type { Locale } from "../../i18n-config"
import type { Dictionary } from "../types/dictionary"
import { i18n } from "../../i18n-config"

// Dictionary implementation without server-only
const dictionaries = {
  en: () => import("../dictionaries/en.json").then((module) => module.default),
  es: () => import("../dictionaries/es.json").then((module) => module.default),
}

// Cache dictionaries to avoid repeated imports
const cachedDictionaries: Record<string, any> = {}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  // Validate locale with fallback to default
  const validLocale = i18n.locales.includes(locale) ? locale : i18n.defaultLocale

  // Return from cache if available
  if (cachedDictionaries[validLocale]) {
    return cachedDictionaries[validLocale] as Dictionary
  }

  try {
    // Load dictionary and cache it
    const dictionary = await dictionaries[validLocale]()

    // Log the structure for debugging
    console.log(
      `Loaded dictionary for ${validLocale}:`,
      Object.keys(dictionary).length > 0
        ? `Found ${Object.keys(dictionary).length} top-level keys`
        : "Empty dictionary",
    )

    cachedDictionaries[validLocale] = dictionary
    return dictionary as Dictionary
  } catch (error) {
    console.error(`Error loading dictionary for ${validLocale}:`, error)

    // Try to load the default dictionary as a fallback
    if (validLocale !== i18n.defaultLocale) {
      try {
        const defaultDictionary = await dictionaries[i18n.defaultLocale]()
        cachedDictionaries[i18n.defaultLocale] = defaultDictionary
        return defaultDictionary as Dictionary
      } catch (fallbackError) {
        console.error(`Error loading fallback dictionary:`, fallbackError)
      }
    }

    // Return a minimal dictionary to prevent crashes
    return { sdoh: { title: "Error loading dictionary" } } as Dictionary
  }
}

// Re-export the Dictionary type
export type { Dictionary } from "../types/dictionary"
