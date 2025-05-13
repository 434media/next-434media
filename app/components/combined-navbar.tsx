"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { usePathname } from "next/navigation"
import CartModal from "./shopify/cart/modal"
import Search from "./shopify/layout/navbar/search"
import { useCart } from "./shopify/cart/cart-context"
import { ScrambleText } from "./ScrambleText"
import NavMenu from "./Navmenu"
import { MarqueeText } from "./MarqueeText"
import { useMobile } from "../hooks/use-mobile"
import { AIMLogo } from "./AIMLogo"

interface CombinedNavbarProps {
  menu: Array<{
    title: string
    path: string
  }>
}

export function CombinedNavbar({ menu }: CombinedNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [hoveredLogo, setHoveredLogo] = useState<string | null>(null)
  const pathname = usePathname()
  const { cart } = useCart()
  const isMobile = useMobile()

  // Check if cart has items
  const hasCartItems = typeof cart?.totalQuantity === "number" && cart.totalQuantity > 0

  // Check if we're in the shop section
  const isInShop = pathname?.startsWith("/shop") || pathname?.startsWith("/product") || pathname?.startsWith("/search")

  // Handle scroll events with throttling for performance
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close search on route change
  useEffect(() => {
    setShowSearch(false)
  }, [pathname])

  // Handle keyboard navigation
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSearch) {
          setShowSearch(false)
        }
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [showSearch])

  // Focus management for search
  useEffect(() => {
    if (showSearch) {
      // Small delay to ensure the search input is visible
      setTimeout(() => {
        const searchInput = document.querySelector('#search-panel input[type="text"]') as HTMLInputElement
        if (searchInput) searchInput.focus()
      }, 100)
    }
  }, [showSearch])

  // Animation variants
  const searchVariants = {
    open: {
      height: "auto",
      opacity: 1,
      transition: {
        height: {
          type: "spring",
          stiffness: 300,
          damping: 30,
        },
        opacity: { duration: 0.2 },
      },
    },
    closed: {
      height: 0,
      opacity: 0,
      transition: {
        height: { duration: 0.2 },
        opacity: { duration: 0.1 },
      },
    },
  }

  const toggleActionMenu = () => {
    setIsActionMenuOpen(!isActionMenuOpen)
  }

  return (
    <>
      {/* Mobile Marquee - Only on mobile */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-50 w-full overflow-hidden py-2 border-b border-emerald-500/10 bg-black/80 backdrop-blur-md">
          <MarqueeText
            text="ACTION SPEAKS LOUDER"
            className="text-lg font-bold cursor-pointer"
            speed={15}
            onClick={toggleActionMenu}
          />
        </div>
      )}
      <motion.header
        className={`fixed ${isMobile ? "top-[40px]" : "top-0"} left-0 right-0 z-40 transition-all duration-300 backdrop-blur-md ${
          isScrolled ? "bg-black/80 shadow-lg py-2" : "bg-gradient-to-b from-black/70 to-black/10 py-4"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link
              href="/"
              className="text-white font-menda-black text-base sm:text-xl flex items-center group"
              aria-label="434 Media - Home"
            >
              <ScrambleText
                text="434 MEDIA"
                className="inline-block cursor-pointer transition-transform duration-300 group-hover:scale-105"
                scrambleOnMount={false}
                scrambleOnHover={true}
              />
            </Link>

            {/* Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
              {/* SDOH Logo - Fixed hover state */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="relative"
              >
                <Link
                  href="/sdoh"
                  className="group relative flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black"
                  aria-label="Learn about SDOH"
                  onMouseEnter={() => setHoveredLogo("sdoh")}
                  onMouseLeave={() => setHoveredLogo(null)}
                >
                  <motion.div
                    className="relative z-10 h-6 w-auto"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                      alt="¿Qué es SDOH?"
                      width={100}
                      height={24}
                      className="w-auto h-full grayscale"
                      priority={true}
                    />
                  </motion.div>
                  <AnimatePresence>
                    {hoveredLogo === "sdoh" && (
                      <motion.span
                        className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-400/20 via-sky-400/20 to-purple-500/20 rounded-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      ></motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>

              {/* AIM Logo - Fixed hover state */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="relative"
              >
                <Link
                  href="https://www.aimsatx.com/"
                  className="group relative flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black"
                  aria-label="Visit AIM page"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={() => setHoveredLogo("aim")}
                  onMouseLeave={() => setHoveredLogo(null)}
                >
                  <motion.div
                    className="w-6 h-6 relative flex items-center justify-center"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <AIMLogo variant="white" className="w-full h-full" />
                  </motion.div>
                  <AnimatePresence>
                    {hoveredLogo === "aim" && (
                      <motion.span
                        className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-400/20 via-sky-400/20 to-purple-500/20 rounded-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      ></motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </motion.div>

              {isInShop ? (
                <>
                  {/* Search Toggle - Only in shop */}
                  <button
                    onClick={() => setShowSearch(!showSearch)}
                    className="group flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                    aria-expanded={showSearch}
                    aria-controls="search-panel"
                    aria-label={showSearch ? "Close search" : "Open search"}
                  >
                    <i className="ri-search-line text-xl transition-transform group-hover:scale-110"></i>
                  </button>

                  {/* Cart - Always shown in shop */}
                  <div className="flex items-center">
                    <CartModal />
                  </div>
                </>
              ) : (
                <>
                  {/* Shopify Store Link - Fixed hover state */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="relative"
                  >
                    <Link
                      href="/shop"
                      className="group relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                      aria-label="Shopify Store"
                      onMouseEnter={() => setHoveredLogo("shop")}
                      onMouseLeave={() => setHoveredLogo(null)}
                    >
                      <motion.div className="w-5 h-5 relative" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Image
                          src="https://ampd-asset.s3.us-east-2.amazonaws.com/shopify_glyph_white.svg"
                          alt="Shopify Store"
                          fill
                          priority={true}
                        />
                      </motion.div>
                      <AnimatePresence>
                        {hoveredLogo === "shop" && (
                          <motion.span
                            className="absolute inset-0 z-0 bg-white/10 rounded-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          ></motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </motion.div>

                  {/* Action Speaks Louder Button - Only on desktop outside shop, now fourth */}
                  {!isMobile && (
                    <motion.button
                      onClick={toggleActionMenu}
                      className="relative text-white px-4 py-2 text-sm font-geist-sans rounded-md flex items-center transition-all duration-300 shadow-md hover:shadow-lg border border-white/20 hover:border-white/40"
                      aria-expanded={isActionMenuOpen}
                      aria-haspopup="true"
                      aria-controls="nav-menu"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5, duration: 0.3 }}
                    >
                      <span className="relative z-10 flex items-center">
                        <span className="mr-2">Action Speaks Louder</span>
                        <motion.svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          animate={{ rotate: isActionMenuOpen ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </motion.svg>
                      </span>
                    </motion.button>
                  )}
                </>
              )}

              {/* Cart - Show on all pages when items exist */}
              {!isInShop && hasCartItems && (
                <div className="flex items-center">
                  <CartModal />
                </div>
              )}
            </div>
          </div>

          {/* Search Dropdown - Only visible in shop section */}
          {isInShop && (
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  id="search-panel"
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={searchVariants}
                  className="overflow-hidden border-t border-neutral-700/50 bg-black/80 backdrop-blur-md shadow-md"
                  aria-label="Search panel"
                >
                  <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <Search />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.header>

      {/* Action Speaks Louder Menu */}
      <NavMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} id="nav-menu" />
    </>
  )
}
