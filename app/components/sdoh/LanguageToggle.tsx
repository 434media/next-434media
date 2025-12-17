"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { i18n } from "../../../i18n-config"
import type { Locale } from "../../../i18n-config"

export default function LanguageToggle({ currentLocale }: { currentLocale: Locale }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const isSDOHPage = pathname?.includes("/sdoh")

  const getRedirectedPath = (locale: string) => {
    if (!pathname) return `/${locale}`

    if (pathname.includes("/sdoh")) {
      return `/${locale}/sdoh`
    }

    const segments = pathname.split("/")
    if (i18n.locales.includes(segments[1] as Locale)) {
      segments[1] = locale
    } else {
      segments.unshift(locale)
    }
    return segments.join("/")
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest(".language-toggle-container")) {
        setIsOpen(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  if (isSDOHPage) {
    return null
  }

  const languages = [
    { code: "en", label: "EN", flag: "🇺🇸" },
    { code: "es", label: "ES", flag: "🇲🇽" },
  ]

  const currentLang = languages.find((l) => l.code === currentLocale) || languages[0]
  const otherLang = languages.find((l) => l.code !== currentLocale) || languages[1]

  return (
    <div
      id="language-toggle"
      className="language-toggle-container fixed z-[9999]"
      style={{
        pointerEvents: "auto",
        position: "fixed",
        top: "70px",
        right: "16px",
        zIndex: 9999,
      }}
    >
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-2 bg-white border border-neutral-200 text-neutral-900 font-bold text-sm transition-colors duration-200 hover:border-neutral-400"
          aria-label={`Current language: ${currentLang.label}. Click to change language.`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span>{currentLang.flag}</span>
          <span>{currentLang.label}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-neutral-200 shadow-lg">
            <Link
              href={getRedirectedPath(otherLang.code)}
              className="flex items-center space-x-2 px-3 py-2 text-neutral-900 font-medium text-sm hover:bg-neutral-100 transition-colors duration-200"
              onClick={() => setIsOpen(false)}
              role="option"
              aria-selected={false}
            >
              <span>{otherLang.flag}</span>
              <span>{otherLang.label}</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
