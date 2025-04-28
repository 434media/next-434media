"use client"

import { useState, useEffect } from "react"
import { i18n, type Locale } from "../../../i18n-config"
import dynamic from "next/dynamic"
import Loading from "./loading"
import { usePathname } from "next/navigation"

// Dynamic import with ssr: false (now in a Client Component)
const SDOHClientPageDynamic = dynamic(() => import("./SDOHClientPage"), {
  ssr: false,
  loading: () => <Loading />,
})

// Client Component wrapper that handles the dynamic import
export default function SDOHClientLoader({ locale: initialLocale }: { locale: Locale }) {
  const [isMounted, setIsMounted] = useState(false)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const pathname = usePathname()

  // Get the actual locale from the URL path on the client side
  useEffect(() => {
    setIsMounted(true)

    // Extract locale from URL path
    const pathLocale = pathname.split("/")[1] as Locale
    if (pathLocale && i18n.locales.includes(pathLocale)) {
      setLocale(pathLocale)
    }
  }, [pathname])

  // Don't render anything on the server or during initial client render
  if (!isMounted) {
    return <Loading />
  }

  return <SDOHClientPageDynamic locale={locale} />
}
