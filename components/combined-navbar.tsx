"use client"

import { useState, useEffect, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import NavMenu from "./Navmenu"

/**
 * `cart` is filled only by the (shop) layout, with <NavCart />. Elsewhere it is
 * empty, so the cart code and its provider never reach the rest of the site
 * (2b fix 9). The icon used to show site-wide whenever the cart had items; that
 * was given up by founder decision on 2026-10-07.
 */
export function CombinedNavbar({ cart }: { cart?: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const pathname = usePathname()

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
      {/* One height, one inset (globals.css, --site-header-h and
          --site-gutter). Scrolling deepens the background and adds the
          divider; it no longer changes the height, so every page clears the
          same 64px. */}
      <header
        className={`m-header-in fixed top-0 left-0 right-0 z-50 h-(--site-header-h) px-(--site-gutter) transition-[background-color,border-color] duration-300 backdrop-blur-md border-b ${
          isScrolled
            ? "bg-[color-mix(in_srgb,var(--color-chrome-bg)_95%,transparent)] border-(--color-chrome-divider)"
            : "bg-[color-mix(in_srgb,var(--color-chrome-bg)_85%,transparent)] border-transparent"
        }`}
      >
        <div className="h-full">
          <div className="h-full flex items-center justify-between">
            {/* The logo is artwork, not type.

                It used to be the string "434 MEDIA" set in Menda Black and
                scrambled on hover. The visual system prohibits that outright —
                "never retype the logo; use the SVG artwork" — so the wordmark is
                now the supplied primary lockup, light variant for this dark bar.

                The scramble went with it. You cannot scramble artwork character
                by character because it has no characters, and the effect is not
                worth reintroducing the prohibition to keep. The hover scale
                stays.

                Width: 128px, 160px from 768px. It was the lockup's 72px
                digital minimum (96px from 640px), which on a lockup this wide
                (11.4:1) is 8px tall: legible, but lost in the bar. At 160px
                it is 14px tall, and the 64px bar leaves 25px above and below
                it, inside the logo standard's 24px clear space. */}
            <Link
              href="/"
              className="flex items-center group leading-none shrink-0"
              aria-label="434 Media - Home"
            >
              <Image
                src="/brand/434-primary-light.svg"
                alt="434 MEDIA"
                width={160}
                height={14}
                priority
                className="h-auto w-[128px] md:w-[160px] transition-opacity duration-200 group-hover:opacity-80"
              />
            </Link>

            {/* One menu, every width.
                There is no desktop link row any more. The desktop "Start a
                project" link is now the menu's second item, which is the point:
                two places that had to be kept in step became one place. */}
            <div className="flex items-center gap-2 shrink-0">
              {cart && <div className="flex items-center">{cart}</div>}
              {/* Not gated on mount. The button's appearance depends on
                  nothing the server cannot know, so it is server-rendered and
                  is in the first paint. It used to wait for `hasMounted`
                  because `useMobile()` decided which of two navigations to
                  draw, and the server cannot measure a viewport — that reason
                  went when the two navigations became one. */}
              {/* Motion lives in globals.css (2b fix 10): .m-menu-button and
                  .m-burger-line reproduce the entrance, hover, tap and the
                  lines-to-cross the motion library drew. */}
              {/* A labelled button rather than a bare three-line icon. The
                  menu holds two items, so it says "Menu" in words, with a
                  two-line icon beside it. The right padding is pulled back
                  with a negative margin so the icon, not the hover fill, sits
                  on the gutter edge. */}
              <button
                  type="button"
                  onClick={toggleActionMenu}
                  className="m-menu-button group -mr-2 flex h-10 items-center gap-3 px-2 text-(--color-chrome-text) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-expanded={isActionMenuOpen}
                  aria-haspopup="dialog"
                  aria-controls="nav-menu"
                >
                  <span className="font-geist-mono t-label">Menu</span>
                  <span className="flex w-5 flex-col items-end gap-1.5" aria-hidden="true">
                    <span className="m-burger-line block h-0.5 w-full bg-current" />
                    <span className="m-burger-line block h-0.5 w-3/5 bg-current" />
                  </span>
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Action Speaks Louder Menu */}
      <NavMenu isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} id="nav-menu" />
    </>
  )
}
