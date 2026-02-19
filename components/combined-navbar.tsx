"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import CartModal from "./shopify/cart/modal"
import { useCart } from "./shopify/cart/cart-context"
import { ScrambleText } from "./ScrambleText"
import NavMenu from "./Navmenu"
import { useMobile } from "../hooks/use-mobile"
import type { Menu } from "../lib/shopify/types"

type CombinedNavbarProps = {
  menu?: Menu[]
}

const desktopLinks = [
  { href: "/work", label: "Work" },
  { href: "https://www.digitalcanvas.community/thefeed", label: "The Feed" },
  { href: "/shop", label: "Shop" },
  { href: "https://www.devsa.community/events", label: "Events" },
  { href: "/contact", label: "Contact" },
]

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

  const toggleActionMenu = () => {
    setIsActionMenuOpen(!isActionMenuOpen)
  }

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md ${
          isScrolled ? "bg-black/95 shadow-lg py-2" : "bg-black/85 py-3 md:py-4"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="text-white font-menda-black text-base sm:text-lg flex items-center group leading-none shrink-0"
              aria-label="434 Media - Home"
            >
              <ScrambleText
                text="434 MEDIA"
                className="inline-block cursor-pointer transition-transform duration-300 group-hover:scale-105"
                scrambleOnMount={false}
                scrambleOnHover={true}
              />
            </Link>

            {/* Desktop Nav Links + Cart */}
            {hasMounted && !isMobile && (
              <div className="hidden md:flex items-center gap-1">
                <nav className="flex items-center gap-1">
                  {desktopLinks.map((link) => {
                    const isActive = pathname === link.href || pathname?.startsWith(link.href + "/")
                    const isExternal = link.href.startsWith("http")
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={`font-geist-sans text-[13px] font-medium leading-none px-3 py-1.5 rounded-md transition-all duration-200 ${
                          isActive
                            ? "text-white bg-white/10"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </nav>
                {(isInShop || hasCartItems) && (
                  <div className="flex items-center ml-1">
                    <CartModal />
                  </div>
                )}
              </div>
            )}

            {/* Mobile: hamburger + cart */}
            <div className="flex items-center gap-2 md:hidden shrink-0">
              {hasMounted && isMobile && (isInShop || hasCartItems) && (
                <div className="flex items-center">
                  <CartModal />
                </div>
              )}
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
            </div>
          </div>
        </div>
      </motion.header>

      {/* Action Speaks Louder Menu */}
      <NavMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} id="nav-menu" />
    </>
  )
}
