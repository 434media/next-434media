"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
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

const navigationItems: NavigationItem[] = [
  {
    id: "work",
    title: "Work",
    subtitle: "See our portfolio",
    href: "/work",
    delay: 0.1,
  },
  {
    id: "feed",
    title: "The Feed",
    subtitle: "Insights & Stories",
    href: "https://www.digitalcanvas.community/thefeed",
    delay: 0.15,
  },
  {
    id: "shop",
    title: "Shop",
    subtitle: "Founders Tee Available Now",
    href: "/shop",
    delay: 0.2,
  },
  {
    id: "events",
    title: "Events",
    subtitle: "Where Networks Meet Action",
    href: "https://www.devsa.community/events",
    delay: 0.25,
  },
  {
    id: "contact",
    title: "Contact",
    subtitle: "Take the next step",
    href: "/contact",
    delay: 0.3,
  },
]

export default function NavMenu({ isOpen, onClose, id = "nav-menu" }: NavMenuProps) {
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
            <span className="font-geist-sans text-[15px] font-medium text-white leading-none tracking-tight block mb-1">
              {item.title}
            </span>
            <span className="font-geist-sans text-[13px] font-normal text-white/40 leading-none tracking-tight block">
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
                  className="font-menda-black text-[11px] font-medium text-white/30 uppercase tracking-widest leading-none"
                >
                  434 MEDIA
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

              {/* Tagline */}
              <motion.p
                className="font-geist-sans text-white/80 font-medium text-lg md:text-xl leading-[1.35] tracking-tight mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                Explore how we blend creativity with community impact through innovative storytelling and design.
              </motion.p>

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
                <p className="font-geist-sans text-[11px] text-white/20 leading-relaxed tracking-tight">
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
