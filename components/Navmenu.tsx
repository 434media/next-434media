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
    delay: 0.15,
  },
  {
    id: "contact",
    title: "Start a production",
    subtitle: "Take the next step",
    href: "/contact",
    delay: 0.2,
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
          className="group flex items-center gap-4 py-4 border-b border-white/6 transition-colors duration-200 hover:bg-white/3 -mx-2 px-2 rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <span className="font-geist-sans t-control-emphasis text-white tracking-tight block mb-1">
              {item.title}
            </span>
            <span className="font-geist-sans t-body-s text-white/40 tracking-tight block">
              {item.subtitle}
            </span>
          </div>
          <svg
            className="shrink-0 w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors duration-200"
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
      {/* Backdrop */}
      <div className="m-navmenu-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel — full on mobile, ~40% on desktop, slides from right */}
      <div
        ref={menuRef}
        className="m-navmenu-panel absolute right-0 top-0 bottom-0 w-full md:w-105 lg:w-115 bg-neutral-950 border-l border-white/6 overflow-y-auto"
      >
        <div className="flex flex-col h-full px-6 md:px-8 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <span
              className="m-delayed-fade opacity-30"
              style={{ "--m-delay": "0.2s" } as React.CSSProperties}
            >
              <Image
                src="/brand/434-mark-light.svg"
                alt="434 MEDIA"
                width={176}
                height={44}
                className="h-auto w-[44px]"
              />
            </span>
            <button
              onClick={onClose}
              className="m-tap-close text-white/40 hover:text-white p-1.5 rounded-md hover:bg-white/6 focus:outline-none focus:ring-2 focus:ring-white/20"
              aria-label="Close menu"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1">
            {renderNavigationItems()}
          </nav>

          {/* Footer */}
          <div
            className="m-delayed-fade mt-auto pt-8"
            style={{ "--m-delay": "0.5s" } as React.CSSProperties}
          >
            <p className="font-geist-sans t-caption text-white/20 tracking-tight">
              &copy; {new Date().getFullYear()} 434 Media. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
