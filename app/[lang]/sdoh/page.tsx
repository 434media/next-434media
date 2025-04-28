import { i18n } from "../../../i18n-config"
import SDOHClientWrapper from "./SDOHClientWrapper"
import type { Locale } from "@/i18n-config"

// Force static rendering with client-side navigation
export const dynamic = "error"
export const dynamicParams = false

// Pre-render all supported locales at build time
export function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// Simplified page component with defensive programming
export default function SDOHPage({ params }: { params?: { lang?: string } }) {
  // Ensure we have a valid locale, defaulting to "en" if not provided
  const safeLocale =
    params?.lang && i18n.locales.includes(params.lang as Locale) ? (params.lang as Locale) : i18n.defaultLocale

  return <SDOHClientWrapper initialLocale={safeLocale} />
}
