"use client"

import { type ReactNode, useEffect } from "react"
import { LanguageProvider } from "@/context/language-context"
import type { Dictionary } from "@/types/dictionary"
import type { Locale } from "../../i18n-config"

export default function ClientLayout({
  children,
  dict,
  lang,
}: {
  children: ReactNode
  dict: Dictionary
  lang: Locale
}) {
  // Add analytics or other client-side effects here
  useEffect(() => {
    // Example: Track page view
    console.log(`Page viewed in ${lang}`)
  }, [lang])

  return (
    <LanguageProvider dictionary={dict} locale={lang}>
      {children}
    </LanguageProvider>
  )
}
