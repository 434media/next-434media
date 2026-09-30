"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { XIcon } from "lucide-react"

interface NavMenuProps {
  isOpen: boolean
  onClose: () => void
  id?: string
  /**
   * Whether to offer the Work item. Decided on the server by the root layout,
   * from the same condition as the `/work` redirect — see
   * lib/work-page-visibility.ts. A client component cannot read `VERCEL_ENV`.
   */
  showWork?: boolean
}

interface NavigationItem {
  id: string
  title: string
  subtitle: string
  href: string
  delay: number
}

// This IS the navigation, at every width. There is no desktop link row any
// more: one menu, two items, the same on a phone and on a 27-inch display.
//
// Work is offered only when it resolves. `/work` redirects to `/` in
// production until the asset pass lands, and a menu item pointing at a redirect
// is worse than no item — nothing errors, the visitor just arrives at the
// homepage and assumes they misclicked. The condition is shared with the
// redirect itself rather than restated; see lib/work-page-visibility.ts.
function buildNavigationItems(showWork: boolean): NavigationItem[] {
  const items: NavigationItem[] = []

  if (showWork) {
    items.push({
      id: "work",
      title: "Work",
      subtitle: "Original IP, platforms, and productions",
      href: "/work",
      delay: 0.15,
    })
  }

  items.push({
    id: "contact",
    title: "Start a project",
    subtitle: "Take the next step",
    href: "/contact",
    // The first slot's delay, so a one-item menu does not start late.
    delay: showWork ? 0.2 : 0.15,
  })

  return items
}


export default function NavMenu({ isOpen, onClose, id = "nav-menu", showWork = false }: NavMenuProps) {
  const navigationItems = useMemo(() => buildNavigationItems(showWork), [showWork])
  const menuRef = useRef<HTMLDivElement>(null)

  const renderNavigationItems = useCallback(() => {
    return navigationItems.map((item) => (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: item.delay, ease: "easeOut" }}
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
      </motion.div>
    ))
  }, [navigationItems, onClose])

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-menu-title"
          id={id}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Panel — full on mobile, ~40% on desktop, slides from right */}
          <motion.div
            ref={menuRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              duration: 0.5,
            }}
            className="absolute right-0 top-0 bottom-0 w-full md:w-105 lg:w-115 bg-neutral-950 border-l border-white/6 overflow-y-auto"
          >
            <div className="flex flex-col h-full px-6 md:px-8 py-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="opacity-30"
                >
                  <Image
                    src="/brand/434-mark-light.svg"
                    alt="434 MEDIA"
                    width={176}
                    height={44}
                    className="h-auto w-[44px]"
                  />
                </motion.span>
                <motion.button
                  onClick={onClose}
                  className="text-white/40 hover:text-white p-1.5 rounded-md hover:bg-white/6 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20"
                  whileTap={{ scale: 0.9 }}
                  aria-label="Close menu"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <XIcon className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Nav items */}
              <nav className="flex-1">
                {renderNavigationItems()}
              </nav>

              {/* Footer */}
              <motion.div
                className="mt-auto pt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="font-geist-sans t-caption text-white/20 tracking-tight">
                  &copy; {new Date().getFullYear()} 434 Media. All rights reserved.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
