"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { i18n } from "../../../i18n-config"
import type { Locale } from "../../../i18n-config"

export default function LanguageToggle({ currentLocale }: { currentLocale: Locale }) {
  const [isOpen, setIsOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const pathname = usePathname()
  const isSDOHPage = pathname?.includes("/sdoh")

  // Get the redirected path based on the current locale and pathname
  const getRedirectedPath = (locale: string) => {
    if (!pathname) return `/${locale}`

    // Special handling for SDOH page
    if (pathname.includes("/sdoh")) {
      return `/${locale}/sdoh`
    }

    // For other pages, keep the current path structure
    const segments = pathname.split("/")
    if (i18n.locales.includes(segments[1] as Locale)) {
      segments[1] = locale
    } else {
      segments.unshift(locale)
    }
    return segments.join("/")
  }

  // Handle click outside to close dropdown
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

  // Only show this toggle if we're NOT on the SDOH page
  if (isSDOHPage) {
    return null
  }

  // Country flag colors
  const flagColors = {
    en: {
      border: "border-blue-700 border-t-red-700 border-b-red-700",
      bg: "from-blue-50 to-red-50",
      text: "text-blue-800",
      hover: "group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
      active: "bg-gradient-to-r from-blue-100 to-red-100 border-blue-700 border-t-red-700 border-b-red-700",
    },
    es: {
      // Mexican flag colors: green, white, red
      border: "border-green-700 border-r-red-700",
      bg: "from-green-50 to-red-50",
      text: "text-green-800",
      hover: "group-hover:shadow-[0_0_15px_rgba(22,163,74,0.5)]",
      active: "bg-gradient-to-r from-green-100 to-red-100 border-green-700 border-r-red-700",
    },
  }

  return (
    <div
      id="language-toggle"
      className="language-toggle-container fixed top-4 right-4 z-[9999] transition-all duration-500"
      style={{
        pointerEvents: "auto",
        position: "fixed",
        top: "70px", // Added more margin-top to clear the navbar
        right: "16px",
        zIndex: 9999,
      }}
    >
      <div className="relative group">
        {/* Animated glow effect */}
        <div
          className="absolute -z-10 inset-0 rounded-full blur-xl transition-all duration-500 opacity-0 group-hover:opacity-70"
          style={{
            background:
              currentLocale === "en"
                ? "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(239,68,68,0.4))"
                : "linear-gradient(135deg, rgba(22,163,74,0.4), rgba(220,38,38,0.4))",
            transform: hovered ? "scale(1.5)" : "scale(1)",
          }}
        ></div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`flex items-center space-x-1 px-2 py-1 rounded-lg shadow-md transition-all duration-300 border-2 
            ${currentLocale === "en" ? flagColors.en.border : flagColors.es.border}
            bg-gradient-to-r ${currentLocale === "en" ? flagColors.en.bg : flagColors.es.bg}
            hover:shadow-lg hover:translate-y-[-2px] text-xs`} // Made text smaller
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="Toggle language menu"
          data-testid="language-toggle-button"
          style={{ fontSize: "0.75rem" }} // Smaller font size
        >
          <span className={`font-medium ${currentLocale === "en" ? flagColors.en.text : flagColors.es.text}`}>
            {currentLocale === "en" ? "EN" : "ES"}
          </span>
          <div className="relative w-4 h-4 overflow-hidden rounded-full ml-1 border border-gray-300">
            {currentLocale === "en" ? (
              <div className="absolute inset-0 bg-blue-600">
                <div className="absolute top-0 left-0 w-full h-2/5 flex flex-wrap">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="w-1/3 h-1/3">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1/2 h-1/2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute top-2/5 left-0 w-full h-3/5 flex flex-col">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-full h-1/6 ${i % 2 === 0 ? "bg-white" : "bg-red-600"}`}></div>
                  ))}
                </div>
              </div>
            ) : (
              // Mexican flag
              <div className="absolute inset-0 flex flex-row">
                <div className="w-1/3 h-full bg-green-600"></div>
                <div className="w-1/3 h-full bg-white flex items-center justify-center">
                  <div className="w-2/3 h-2/3 rounded-full bg-gray-300 flex items-center justify-center">
                    <div className="w-1/2 h-1/2 bg-brown-600 rounded-full"></div>
                  </div>
                </div>
                <div className="w-1/3 h-full bg-red-600"></div>
              </div>
            )}
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 ml-1 transition-transform duration-300 ${
              currentLocale === "en" ? flagColors.en.text : flagColors.es.text
            } ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border overflow-hidden z-50"
            style={{
              animation: "fadeInDown 0.3s ease-out forwards",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
              fontSize: "0.875rem", // Smaller font size
            }}
          >
            <div className="py-1">
              {i18n.locales.map((locale) => (
                <Link
                  key={locale}
                  href={getRedirectedPath(locale)}
                  className={`block px-3 py-2 text-xs transition-all duration-200 items-center space-x-2
                    ${
                      locale === currentLocale
                        ? locale === "en"
                          ? flagColors.en.active
                          : flagColors.es.active
                        : "hover:bg-gray-50"
                    }`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="relative w-5 h-5 overflow-hidden rounded-full border border-gray-300">
                    {locale === "en" ? (
                      <div className="absolute inset-0 bg-blue-600">
                        <div className="absolute top-0 left-0 w-full h-2/5 flex flex-wrap">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="w-1/3 h-1/3">
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="w-1/2 h-1/2 bg-white rounded-full"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute top-2/5 left-0 w-full h-3/5 flex flex-col">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className={`w-full h-1/6 ${i % 2 === 0 ? "bg-white" : "bg-red-600"}`}></div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Mexican flag
                      <div className="absolute inset-0 flex flex-row">
                        <div className="w-1/3 h-full bg-green-600"></div>
                        <div className="w-1/3 h-full bg-white flex items-center justify-center">
                          <div className="w-2/3 h-2/3 rounded-full bg-gray-300 flex items-center justify-center">
                            <div className="w-1/2 h-1/2 bg-brown-600 rounded-full"></div>
                          </div>
                        </div>
                        <div className="w-1/3 h-full bg-red-600"></div>
                      </div>
                    )}
                  </div>
                  <span className={`font-medium ${locale === "en" ? "text-blue-800" : "text-green-800"}`}>
                    {locale === "en" ? "English" : "Español"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
