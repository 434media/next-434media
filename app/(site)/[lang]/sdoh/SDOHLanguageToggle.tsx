"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { i18n, type Locale } from "@/i18n-config"
import { useLanguage } from "@/context/language-context"

interface SDOHLanguageToggleProps {
  showOnScroll?: boolean
}

export default function SDOHLanguageToggle({ showOnScroll = false }: SDOHLanguageToggleProps) {
  const { currentLocale, switchLanguage, isLoading } = useLanguage()
  const [isVisible, setIsVisible] = useState(!showOnScroll)
  const [isHovered, setIsHovered] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)

  // Handle scroll events to show/hide the toggle
  useEffect(() => {
    if (showOnScroll) {
      const handleScroll = () => {
        const viewportHeight = window.innerHeight
        if (window.scrollY > viewportHeight * 0.9) {
          setIsVisible(true)
        } else {
          setIsVisible(false)
        }
      }

      window.addEventListener("scroll", handleScroll)
      handleScroll() // Initial check

      return () => {
        window.removeEventListener("scroll", handleScroll)
      }
    }
  }, [showOnScroll])

  // Simple direct language change handler
  const handleLanguageChange = async (e: React.MouseEvent, locale: Locale) => {
    e.preventDefault()

    if (locale === currentLocale || isLoading || localLoading) return

    setLocalLoading(true)
    console.log(`Language toggle clicked: ${locale}`)

    try {
      await switchLanguage(locale)
    } catch (error) {
      console.error("Error in language toggle:", error)
    } finally {
      setLocalLoading(false)
    }
  }

  return (
    <>
      {isVisible && (
        <div
          className="fixed top-20 right-4 z-50 transition-opacity duration-300"
          style={{ maxWidth: "fit-content" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`bg-white border border-neutral-200 p-1 flex items-center transition-shadow duration-200 ${
              isHovered ? "shadow-md" : "shadow-sm"
            }`}
          >
            {i18n.locales.map((locale) => (
              <button
                key={locale}
                onClick={(e) => handleLanguageChange(e, locale)}
                disabled={isLoading || localLoading || locale === currentLocale}
                className={`relative px-3 py-1.5 text-sm font-bold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#A31545] focus:ring-offset-2 ${
                  locale === currentLocale
                    ? "bg-[#A31545] text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
                aria-label={`Switch to ${locale === "en" ? "English" : "Spanish"} language`}
                aria-current={locale === currentLocale ? "true" : "false"}
                type="button"
              >
                <span
                  className={`flex items-center ${(isLoading || localLoading) && locale !== currentLocale ? "opacity-0" : ""}`}
                >
                  {locale === "en" ? (
                    <>
                      <span className="mr-1.5">🇺🇸</span>
                      <span>EN</span>
                    </>
                  ) : (
                    <>
                      <span className="mr-1.5">🇲🇽</span>
                      <span>ES</span>
                    </>
                  )}
                </span>

                {(isLoading || localLoading) && locale !== currentLocale && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="animate-spin h-4 w-4 text-gray-700"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
