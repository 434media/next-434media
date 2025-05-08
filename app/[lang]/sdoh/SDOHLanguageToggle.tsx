"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { i18n, type Locale } from "@/i18n-config"
import { useLanguage } from "@/app/context/language-context"
import { motion, AnimatePresence } from "motion/react"

interface SDOHLanguageToggleProps {
  showOnScroll?: boolean
}

export default function SDOHLanguageToggle({ showOnScroll = false }: SDOHLanguageToggleProps) {
  const pathname = usePathname()
  const { currentLocale, switchLanguage } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(!showOnScroll)
  const [isHovered, setIsHovered] = useState(false)

  // Determine the active locale
  const activeLocale = currentLocale || (pathname?.split("/")[1] as Locale) || i18n.defaultLocale

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

  // Handle language change
  const handleLanguageChange = async (newLocale: Locale) => {
    if (newLocale === activeLocale) return

    setIsLoading(true)

    try {
      // Use the switchLanguage function from context
      await switchLanguage(newLocale)
    } catch (error) {
      console.error("Error changing language:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 0.9, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="fixed top-20 right-4 z-100 opacity-90 hover:opacity-100 transition-opacity"
          style={{ maxWidth: "fit-content", transform: "scale(0.9)" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            className={`bg-white/40 backdrop-blur-md rounded-full shadow-sm border border-gray-200/50 p-1 flex items-center transition-all duration-300 ${
              isHovered ? "shadow-md" : ""
            }`}
          >
            {i18n.locales.map((locale) => (
              <button
                key={locale}
                onClick={() => handleLanguageChange(locale)}
                disabled={isLoading || locale === activeLocale}
                className={`relative rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                  locale === activeLocale
                    ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
                    : "text-gray-700 hover:bg-gray-100/80"
                }`}
                aria-label={`Switch to ${locale === "en" ? "English" : "Spanish"} language`}
                aria-current={locale === activeLocale ? "true" : "false"}
              >
                <span className="flex items-center">
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

                {isLoading && locale === activeLocale && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
