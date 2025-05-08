import { redirect } from "next/navigation"
import { i18n, type Locale } from "../../i18n-config"
import { cookies, headers } from "next/headers"

// Detect the user's preferred language
async function getPreferredLocale(): Promise<string> {
  // Check for cookies first
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get("NEXT_LOCALE")
  if (localeCookie?.value && i18n.locales.includes(localeCookie.value as Locale)) {
    return localeCookie.value
  }

  // Check Accept-Language header
  const headersList = await headers()
  const acceptLanguage = headersList.get("accept-language") || ""

  // Simple parsing of Accept-Language header
  // This is a simplified version - in production you might want a more robust solution
  if (acceptLanguage.includes("es")) {
    return "es"
  }

  // Default to English
  return i18n.defaultLocale
}

// Instead of using [lang] dynamic route, we'll use a single SDOH page that redirects
export default async function SDOHRedirectPage() {
  // Get the preferred locale
  const locale = await getPreferredLocale()

  // Redirect to the appropriate locale
  redirect(`/${locale}/sdoh`)
}
