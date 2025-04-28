import type { Locale } from "../../i18n-config"

// Client-safe version of the dictionary utility
const dictionaries = {
  en: () => import("../dictionaries/en.json").then((module) => module.default),
  es: () => import("../dictionaries/es.json").then((module) => module.default),
}

// Cache dictionaries to avoid repeated imports
const cachedDictionaries: Record<string, any> = {}

export async function getClientDictionary(locale: Locale) {
  // Return from cache if available
  if (cachedDictionaries[locale]) {
    return cachedDictionaries[locale]
  }

  // Load dictionary and cache it
  const dictionary = await dictionaries[locale]()
  cachedDictionaries[locale] = dictionary
  return dictionary
}

// Add this export to match the function name used in SDOHClientPage
export const getDictionaryClient = getClientDictionary
