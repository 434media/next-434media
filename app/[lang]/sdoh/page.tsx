import { Suspense } from "react"
import { i18n, type Locale } from "../../../i18n-config"
import Loading from "./loading"
import SDOHClientLoader from "./SDOHClientLoader"

// Generate static params for all supported locales
export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }))
}

// Helper function to validate and type-cast the locale
function getValidLocale(lang: string | undefined): Locale {
  if (lang && i18n.locales.includes(lang as Locale)) {
    return lang as Locale
  }
  return i18n.defaultLocale
}

export default function Page({ params }: { params: { lang?: string } }) {
  // Use default locale for server rendering to avoid hydration mismatch
  // The actual locale will be handled by client components
  const defaultLocale = i18n.defaultLocale

  return (
    <Suspense fallback={<Loading />}>
      <SDOHClientLoader locale={defaultLocale} />
    </Suspense>
  )
}
