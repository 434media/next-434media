import type { Locale } from "../../i18n-config"
import { i18n } from "../../i18n-config"

// Define a fallback dictionary with minimal content
const fallbackDictionary = {
  sdoh: {
    title: "SDOH",
    description: "Social Determinants of Health",
    // Add other necessary keys with default values
  },
}

export async function getDictionary(locale: Locale) {
  try {
    // Validate locale and use default if invalid
    const validLocale = i18n.locales.includes(locale) ? locale : i18n.defaultLocale

    // Import the dictionary dynamically
    const dictionary = await import(`../dictionaries/${validLocale}.json`).then((module) => module.default)

    return dictionary
  } catch (error) {
    console.error(`Error loading dictionary for locale ${locale}:`, error)

    // Try to load the default locale as a fallback
    try {
      const defaultDictionary = await import(`../dictionaries/${i18n.defaultLocale}.json`).then(
        (module) => module.default,
      )
      return defaultDictionary
    } catch (fallbackError) {
      console.error(`Error loading fallback dictionary:`, fallbackError)

      // Return a minimal fallback dictionary to prevent crashes
      return fallbackDictionary
    }
  }
}
