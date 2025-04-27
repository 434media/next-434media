"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import type { Locale } from "../../i18n-config"
import { i18n } from "../../i18n-config"

interface ClientLayoutProps {
  children: React.ReactNode
  params: { lang: Locale }
  dict?: any // Make dict optional since it might not always be passed
}

export default function ClientLayout({ params, children, dict }: ClientLayoutProps) {
  const pathname = usePathname()
  const [isToggleVisible, setIsToggleVisible] = useState(true)

  // Ensure params.lang exists with a fallback to the default locale
  const lang = params?.lang || i18n.defaultLocale

  // Debug logging
  useEffect(() => {
    console.log("ClientLayout mounted with lang:", lang)
    console.log("Current pathname:", pathname)
    console.log("Is SDOH page:", pathname?.includes("/sdoh"))
  }, [lang, pathname])

  // Handle scroll restoration and cleanup on route changes
  useEffect(() => {
    // Scroll to top on route changes
    window.scrollTo(0, 0)
  }, [pathname])

  // Remove Google Translate if it's being injected
  useEffect(() => {
    // Find and remove Google Translate elements if they exist
    const googleTranslateElements = document.querySelectorAll(".goog-te-banner-frame, .skiptranslate")
    googleTranslateElements.forEach((el) => {
      if (el.parentNode) {
        el.parentNode.removeChild(el)
      }
    })

    // Remove Google Translate cookies
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=." + window.location.hostname

    // Remove Google Translate styles
    const googleStyles = document.getElementById("google-translate-styles")
    if (googleStyles && googleStyles.parentNode) {
      googleStyles.parentNode.removeChild(googleStyles)
    }

    // Set body back to visible if Google Translate hid it
    if (document.body.classList.contains("translated-ltr") || document.body.classList.contains("translated-rtl")) {
      document.body.classList.remove("translated-ltr", "translated-rtl")
      document.body.style.top = "0px"
    }

    // Add a class to the html element to indicate the current language
    document.documentElement.lang = lang
    document.documentElement.classList.add(`lang-${lang}`)

    return () => {
      document.documentElement.classList.remove(`lang-${lang}`)
    }
  }, [lang])

  return (
    <div className="lang-wrapper" data-lang={lang}>
      {/* Main content */}
      {children}
    </div>
  )
}
