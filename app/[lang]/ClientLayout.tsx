"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import type { Locale } from "../../i18n-config"

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

  // Use a data attribute on the wrapper to enable language-specific styling
  return <div data-language={language}>{children}</div>
}
