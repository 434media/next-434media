"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import CartModal from "./shopify/cart/modal"
import { useCart } from "./shopify/cart/cart-context"
import { ScrambleText } from "./ScrambleText"
import NavMenu from "./Navmenu"
import { MarqueeText } from "./MarqueeText"
import { useMobile } from "../hooks/use-mobile"
import type { Menu } from "../../app/lib/shopify/types"

type CombinedNavbarProps = {
  menu?: Menu[]
}

// Custom hook to check if component has mounted
function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  return hasMounted
}

export function CombinedNavbar(_props: CombinedNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const pathname = usePathname()
  const { cart } = useCart()
  const isMobile = useMobile()
  const hasMounted = useHasMounted()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Check if cart has items - only after component has mounted
  const hasCartItems = hasMounted && typeof cart?.totalQuantity === "number" && cart.totalQuantity > 0

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

  // Animation variants
  const toggleActionMenu = () => {
    setIsActionMenuOpen(!isActionMenuOpen)
  }

  return (
    <>
      {/* Mobile Marquee - Only on mobile */}
      {hasMounted && isMobile && (
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
        className={`fixed ${hasMounted && isMobile ? "top-[40px]" : "top-0"} left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md ${
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
              {/* Mobile Menu Icon - Only on mobile */}
              {hasMounted && isMobile && (
                <motion.button
                  onClick={toggleActionMenu}
                  className="relative text-white p-2 rounded-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-expanded={isActionMenuOpen}
                  aria-haspopup="true"
                  aria-controls="nav-menu"
                  aria-label="Open navigation menu"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <motion.div
                    className="relative w-6 h-6 flex flex-col justify-center items-center"
                    animate={isActionMenuOpen ? "open" : "closed"}
                  >
                    <motion.span
                      className="absolute w-5 h-0.5 bg-white rounded-full"
                      variants={{
                        closed: { rotate: 0, y: -4 },
                        open: { rotate: 45, y: 0 },
                      }}
                      transition={{ duration: 0.3 }}
                    />
                    <motion.span
                      className="absolute w-5 h-0.5 bg-white rounded-full"
                      variants={{
                        closed: { opacity: 1 },
                        open: { opacity: 0 },
                      }}
                      transition={{ duration: 0.3 }}
                    />
                    <motion.span
                      className="absolute w-5 h-0.5 bg-white rounded-full"
                      variants={{
                        closed: { rotate: 0, y: 4 },
                        open: { rotate: -45, y: 0 },
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.div>
                </motion.button>
              )}

              {/* Action Speaks Louder Button - Always shown on desktop */}
              {hasMounted && !isMobile && (
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

              {/* Cart - Show when in shop or when items exist */}
              {hasMounted && (isInShop || hasCartItems) && (
                <div className="flex items-center">
                  <CartModal />
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Action Speaks Louder Menu */}
      <NavMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} id="nav-menu" />
    </>
  )
}
