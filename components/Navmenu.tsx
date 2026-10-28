"use client"

import Link from "next/link"
import Image from "next/image"
import type React from "react"
import { useCallback, useEffect, useRef } from "react"
import { XIcon } from "lucide-react"

interface NavMenuProps {
  isOpen: boolean
  onClose: () => void
  id?: string
}

interface NavigationItem {
  id: string
  title: string
  subtitle: string
  href: string
  delay: number
}

// This IS the navigation, at every width. There is no desktop link row: one
// menu, two items, the same on a phone and on a 27-inch display.
//
// Work was conditional until 2026-09-29, offered only where `/work` resolved,
// because it redirected to the homepage in production and a menu item pointing
// at a redirect is worse than no item. The founder launched the page, the
// redirect went, and the condition went with it — the item is simply here now.
const navigationItems: NavigationItem[] = [
  {
    id: "work",
    title: "Work",
    subtitle: "Original IP, platforms, and productions",
    href: "/work",
    delay: 0.06,
  },
  {
    id: "contact",
    title: "Start a production",
    subtitle: "Take the next step",
    href: "/contact",
    delay: 0.12,
  },
]

export default function NavMenu({ isOpen, onClose, id = "nav-menu" }: NavMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const renderNavigationItems = useCallback(() => {
    return navigationItems.map((item) => (
      <div
        key={item.id}
        className="m-nav-item"
        style={{ "--m-delay": `${item.delay}s` } as React.CSSProperties}
      >
        <Link
          href={item.href}
          onClick={onClose}
          className="group flex items-center gap-4 py-4 border-b border-(--color-chrome-divider) transition-colors duration-200 hover:bg-white/5 -mx-2 px-2"
        >
          <div className="flex-1 min-w-0">
            <span className="font-geist-sans t-heading-s text-(--color-chrome-text) block mb-1">
              {item.title}
            </span>
            <span className="font-geist-sans t-body-s text-(--color-chrome-text-secondary) block">
              {item.subtitle}
            </span>
          </div>
          <svg
            className="shrink-0 w-4 h-4 text-(--color-chrome-icon) group-hover:text-(--color-chrome-text) transition-colors duration-200"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </Link>
      </div>
    ))
  }, [onClose])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  // The menu stays mounted and is shown and hidden by data-open, so its
  // closing fade and slide play in CSS (globals.css, .m-navmenu*). `inert` and
  // visibility: hidden keep it out of the tab order and the accessibility tree
  // while closed (2b fix 10).
  return (
    <aside
      className="m-navmenu fixed inset-0 z-50"
      data-open={isOpen ? "true" : "false"}
      inert={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nav-menu-title"
      id={id}
    >
      {/* Backdrop. A plain scrim: a backdrop blur here was re-rendered on
          every frame of the opening fade. */}
      <div className="m-navmenu-backdrop absolute inset-0 bg-black/70" />

      {/* Panel — full on mobile, ~40% on desktop, slides from right */}
      <div
        ref={menuRef}
        className="m-navmenu-panel absolute right-0 top-0 bottom-0 w-full md:w-105 lg:w-115 bg-(--color-chrome-bg) border-l border-(--color-chrome-divider) overflow-y-auto"
      >
        <div className="flex flex-col h-full px-(--site-gutter) pb-6">
          {/* Header: the same height as the site header, so on a phone the
              logo and the close button land exactly where the logo and the
              menu button were.

              The full primary lockup, not the standalone 434 mark: the mark
              alone read as "434", which is not the company's name. 128px, as
              in the site header at phone width. */}
          <div className="flex h-(--site-header-h) shrink-0 items-center justify-between mb-4">
            <h2 id="nav-menu-title" className="leading-none">
              <span className="sr-only">Menu</span>
              <Image
                src="/brand/434-primary-light.svg"
                alt="434 MEDIA"
                width={160}
                height={14}
                className="h-auto w-[128px]"
              />
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="m-tap-close -mr-2 flex h-10 items-center gap-3 px-2 text-(--color-chrome-text) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Close menu"
            >
              <span className="font-geist-mono t-label" aria-hidden="true">Close</span>
              <XIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1">
            {renderNavigationItems()}
          </nav>

          {/* Footer */}
          <div className="mt-auto pt-8">
            <p className="font-geist-sans t-caption text-(--color-chrome-label)">
              &copy; {new Date().getFullYear()} 434 Media. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
