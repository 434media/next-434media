import { i18n, type Locale } from "../../../i18n-config"
import { LanguageProvider } from "@/app/context/language-context"
import SDOHClientPage from "./SDOHClientPage"
import { getDictionary } from "@/app/lib/dictionary"

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ lang: locale }))
}

// Use a more generic approach to avoid type conflicts
type Props = {
  params: Promise<{
    lang: string
  }>
}

const Page = async (props: Props) => {
  const params = await props.params;
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

export default Page
