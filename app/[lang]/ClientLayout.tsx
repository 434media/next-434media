"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import type { Locale } from "../../i18n-config"

// Create a context to provide dictionary to all child components
import { createContext } from "react"

// Create a dictionary context that can be consumed by child components
export const DictionaryContext = createContext<Record<string, string | Record<string, string>>>({})

interface Props {
  children: React.ReactNode
  dict: Record<string, string | Record<string, string>>
}

export default function ClientLayout({ children, dict }: Props) {
  const pathname = usePathname()
  const [language, setLanguage] = useState<Locale | "">("")

  useEffect(() => {
    const pathParts = pathname.split("/")
    setLanguage(pathParts[1] as Locale)

    // Set HTML lang attribute for accessibility and SEO
    document.documentElement.lang = pathParts[1]

    // Optionally store language preference
    localStorage.setItem("NEXT_LOCALE", pathParts[1])
  }, [pathname])

  // Provide the dictionary to all child components via context
  return (
    <DictionaryContext.Provider value={dict}>
      <div data-language={language}>{children}</div>
    </DictionaryContext.Provider>
  )
}
