"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import CartModal from "./shopify/cart/modal"
import { useCart } from "./shopify/cart/cart-context"
import NavMenu from "./Navmenu"
import type { Menu } from "../lib/shopify/types"

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
  void _props
  const [isScrolled, setIsScrolled] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const pathname = usePathname()
  const { cart } = useCart()
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

  // Hide the public navbar on application surfaces that provide their own shell.
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/squads") ||
    pathname?.startsWith("/travel")
  ) {
    return null
  }

  const toggleActionMenu = () => {
    setIsActionMenuOpen(!isActionMenuOpen)
  }

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md ${
          isScrolled
            ? "bg-[color-mix(in_srgb,var(--color-chrome-bg)_95%,transparent)] shadow-lg py-2"
            : "bg-[color-mix(in_srgb,var(--color-chrome-bg)_85%,transparent)] py-3 md:py-4"
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* The logo is artwork, not type.

                It used to be the string "434 MEDIA" set in Menda Black and
                scrambled on hover. The visual system prohibits that outright —
                "never retype the logo; use the SVG artwork" — so the wordmark is
                now the supplied primary lockup, light variant for this dark bar.

                The scramble went with it. You cannot scramble artwork character
                by character because it has no characters, and the effect is not
                worth reintroducing the prohibition to keep. The hover scale
                stays.

                Width is the lockup's digital minimum from the token document
                (--434-min-width-horizontal-digital, 72px) and no smaller. */}
            <Link
              href="/"
              className="flex items-center group leading-none shrink-0"
              aria-label="434 Media - Home"
            >
              <Image
                src="/brand/434-primary-light.svg"
                alt="434 MEDIA"
                width={112}
                height={24}
                priority
                className="h-auto w-[72px] sm:w-[96px] transition-transform duration-300 group-hover:scale-105"
              />
            </Link>

            {/* One menu, every width.
                There is no desktop link row any more. The desktop "Start a
                project" link is now the menu's second item, which is the point:
                two places that had to be kept in step became one place. */}
            <div className="flex items-center gap-2 shrink-0">
              {/* The cart DOES depend on client state - the cart contents are
                  not known to the server - so it keeps the mount gate. */}
              {hasMounted && (isInShop || hasCartItems) && (
                <div className="flex items-center">
                  <CartModal />
                </div>
              )}
              {/* Not gated on mount. The button's appearance depends on
                  nothing the server cannot know, so it is server-rendered and
                  is in the first paint. It used to wait for `hasMounted`
                  because `useMobile()` decided which of two navigations to
                  draw, and the server cannot measure a viewport — that reason
                  went when the two navigations became one. */}
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
            </div>
          </div>
        </div>
      </motion.header>

      {/* Action Speaks Louder Menu */}
      <NavMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} id="nav-menu" />
    </>
  )
}
