"use client"

import { useEffect, useState } from "react"
import type { Locale } from "../../../i18n-config"
import { useRouter } from "next/navigation"

// Update the props interface to include currentLocale and onLanguageChange
interface SDOHLanguageToggleProps {
  currentLocale: Locale
  onLanguageChange?: (newLocale: Locale) => void // Make it optional to prevent errors
  showOnScroll?: boolean // Add option to show only after scrolling
}

export default function SDOHLanguageToggle({
  currentLocale,
  onLanguageChange,
  showOnScroll = false,
}: SDOHLanguageToggleProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(!showOnScroll) // Initially visible if showOnScroll is false
  const router = useRouter()

  // Ensure component is mounted before rendering to avoid hydration issues
  useEffect(() => {
    setMounted(true)

    // Add scroll listener if showOnScroll is true
    if (showOnScroll) {
      const handleScroll = () => {
        // Get the height of the viewport
        const viewportHeight = window.innerHeight
        // Show the toggle when scrolled past 90% of the viewport height
        if (window.scrollY > viewportHeight * 0.9) {
          setIsVisible(true)
        } else {
          setIsVisible(false)
        }
      }

      window.addEventListener("scroll", handleScroll)
      // Initial check
      handleScroll()

      return () => {
        window.removeEventListener("scroll", handleScroll)
      }
    }
  }, [showOnScroll])

  if (!mounted) return null

  // Country flag colors
  const flagColors = {
    en: {
      border: "border-blue-700 border-t-red-700 border-b-red-700",
      bg: "from-blue-100 to-red-100",
      activeBg: "bg-gradient-to-r from-blue-600 to-blue-700",
      text: "text-blue-800",
      activeText: "text-white",
      hover: "hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]",
    },
    es: {
      // Mexican flag colors
      border: "border-green-700 border-r-red-700",
      bg: "from-green-100 to-red-100",
      activeBg: "bg-gradient-to-r from-green-600 to-green-700",
      text: "text-green-800",
      activeText: "text-white",
      hover: "hover:shadow-[0_0_15px_rgba(22,163,74,0.5)]",
    },
  }

  // Update the handleLanguageChange function to prevent full page refresh
  const handleLanguageChange = async (newLocale: Locale) => {
    if (newLocale !== currentLocale && !isLoading) {
      setIsLoading(true)
      try {
        // Check if onLanguageChange is a function before calling it
        if (typeof onLanguageChange === "function") {
          await onLanguageChange(newLocale)
        } else {
          // Instead of using console.error which can trigger unhandled errors,
          // we'll implement a fallback that doesn't cause a full page refresh

          // Get the current path without the locale prefix
          const currentPath = window.location.pathname
          const pathWithoutLocale = currentPath.substring(currentPath.indexOf("/", 1) || currentPath.length)

          // Use Next.js router for client-side navigation
          router.push(`/${newLocale}${pathWithoutLocale}`)
        }
      } catch (error) {
        // Silently handle errors to prevent unhandled errors
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div
      className={`fixed top-20 right-4 bg-white/40 backdrop-blur-md p-2 rounded-xl shadow-sm border border-gray-200/50 transition-all duration-300 ${
        isVisible ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
      } z-[100]`}
      data-testid="sdoh-language-toggle"
      style={{
        fontSize: "0.75rem", // Smaller font size
        maxWidth: "fit-content", // Ensure it's not full width
        transform: "scale(0.9)", // Make it slightly smaller for subtlety
      }}
    >
      <div className="flex gap-2 items-center">
        <button
          onClick={() => handleLanguageChange("en")}
          disabled={isLoading || currentLocale === "en"}
          className={`relative px-2 py-1 rounded-lg transition-all duration-300 border-2 ${
            currentLocale === "en"
              ? `${flagColors.en.activeBg} ${flagColors.en.activeText} border-white`
              : `bg-gradient-to-r ${flagColors.en.bg} ${flagColors.en.border} ${flagColors.en.text}`
          } ${flagColors.en.hover} text-xs`}
          onMouseEnter={() => setHovered("en")}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="flex items-center space-x-1">
            <div className="relative w-4 h-4 overflow-hidden rounded-full border border-gray-300">
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
            </div>
            <span className="font-medium">EN</span>
          </div>

          {/* Glow effect */}
          {hovered === "en" && (
            <div
              className="absolute -z-10 inset-0 rounded-lg blur-lg transition-all duration-300 opacity-70"
              style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(239,68,68,0.4))",
              }}
            ></div>
          )}
        </button>

        <button
          onClick={() => handleLanguageChange("es")}
          disabled={isLoading || currentLocale === "es"}
          className={`relative px-2 py-1 rounded-lg transition-all duration-300 border-2 ${
            currentLocale === "es"
              ? `${flagColors.es.activeBg} ${flagColors.es.activeText} border-white`
              : `bg-gradient-to-r ${flagColors.es.bg} ${flagColors.es.border} ${flagColors.es.text}`
          } ${flagColors.es.hover} text-xs`}
          onMouseEnter={() => setHovered("es")}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="flex items-center space-x-1">
            <div className="relative w-4 h-4 overflow-hidden rounded-full border border-gray-300">
              {/* Mexican flag */}
              <div className="absolute inset-0 flex flex-row">
                <div className="w-1/3 h-full bg-green-600"></div>
                <div className="w-1/3 h-full bg-white flex items-center justify-center">
                  <div className="w-2/3 h-2/3 rounded-full bg-gray-300 flex items-center justify-center">
                    <div className="w-1/2 h-1/2 bg-brown-600 rounded-full"></div>
                  </div>
                </div>
                <div className="w-1/3 h-full bg-red-600"></div>
              </div>
            </div>
            <span className="font-medium">ES</span>
          </div>

          {/* Glow effect */}
          {hovered === "es" && (
            <div
              className="absolute -z-10 inset-0 rounded-lg blur-lg transition-all duration-300 opacity-70"
              style={{
                background: "linear-gradient(135deg, rgba(22,163,74,0.4), rgba(220,38,38,0.4))",
              }}
            ></div>
          )}
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
