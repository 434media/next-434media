import { i18n, type Locale } from "../../../i18n-config"
import { LanguageProvider } from "@/app/context/language-context"
import SDOHClientPage from "./SDOHClientPage"
import { getDictionary } from "@/app/lib/dictionary"

// Define the correct type for Next.js App Router page props
interface PageProps {
  params: {
    lang: string
  }
  searchParams?: Record<string, string | string[] | undefined>
}

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }))
}

export default async function Page({ params }: PageProps) {
  // Validate and type-cast locale
  const validLocale = i18n.locales.includes(params.lang as Locale) ? (params.lang as Locale) : i18n.defaultLocale

  // Get dictionary for server-side rendering
  const dictionary = await getDictionary(validLocale)

  return (
    <LanguageProvider dictionary={dictionary} locale={validLocale}>
      <SDOHClientPage locale={validLocale} />
    </LanguageProvider>
  )
}
