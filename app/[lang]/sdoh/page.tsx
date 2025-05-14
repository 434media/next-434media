import { getDictionary } from "@/app/lib/dictionary"
import type { Locale } from "@/i18n-config"
import { LanguageProvider } from "@/app/context/language-context"
import SDOHClientPage from "./SDOHClientPage"

export default async function SDOHPage({
  params: { lang },
}: {
  params: { lang: Locale }
}) {
  const dictionary = await getDictionary(lang)

  return (
    <LanguageProvider dictionary={dictionary} locale={lang}>
      <SDOHClientPage />
    </LanguageProvider>
  )
}
