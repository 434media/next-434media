"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"

type DrawerWidth = "md" | "lg" | "xl"

const WIDTH_CLASSES: Record<DrawerWidth, string> = {
  md: "md:max-w-[480px]",
  lg: "md:max-w-[640px]",
  xl: "md:max-w-[800px]",
}

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  width?: DrawerWidth
  children: ReactNode
  /** Sticky footer area — primary action(s). Use for Save / Cancel etc. */
  footer?: ReactNode
  /** Disabled when there are unsaved changes; the parent decides what to do. */
  closeOnEscape?: boolean
  closeOnOverlayClick?: boolean
}

/**
 * Right-side slide-over panel. Linear/Vercel pattern:
 * - The list behind stays visible (only a thin scrim, not a fullscreen blur)
 * - Esc and overlay-click both close (parent can disable for unsaved-changes guards)
 * - Sticky header + body scroll + sticky footer
 * - At <md breakpoint, becomes a full-width sheet
 *
 * Renders into document.body via portal so it escapes any parent stacking context.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  width = "lg",
  children,
  footer,
  closeOnEscape = true,
  closeOnOverlayClick = true,
}: DetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Focus management — trap inside, restore on close
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null
    const panel = panelRef.current
    if (panel) {
      const firstFocusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      ;(firstFocusable ?? panel).focus()
    }

    const handleKey = (e: KeyboardEvent) => {
      if (!closeOnEscape) return
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"))
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("keydown", handleKey)
      previouslyFocused.current?.focus?.()
    }
  }, [open, closeOnEscape, onClose])

  // Prevent background scroll while open
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Scrim — thin so the list behind stays visible */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/10"
            onClick={() => closeOnOverlayClick && onClose()}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className={`relative ml-auto h-full w-full ${WIDTH_CLASSES[width]} bg-white shadow-2xl flex flex-col outline-none`}
          >
            {/* Sticky header */}
            <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-200 bg-white">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-base font-semibold text-neutral-900 truncate">{title}</h2>
                  {badge && <div className="shrink-0">{badge}</div>}
                </div>
                {subtitle && (
                  <div className="mt-0.5 text-[12px] text-neutral-500 truncate">{subtitle}</div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 p-1.5 -mr-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">{children}</div>

            {/* Sticky footer */}
            {footer && (
              <footer className="shrink-0 px-5 py-3 border-t border-neutral-200 bg-white">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
