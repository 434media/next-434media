"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

/**
 * A small round "?" button beside a field or control; a click (or Enter/Space) opens a one-to-two-line explanation
 * next to it, and a click outside or Esc closes it. Click to open, never hover-only, so it works by touch and keyboard.
 * The popover is drawn in a portal at a fixed position, so a scrolling drawer or table cell never clips it; Esc closes
 * only the tip (not the drawer around it) and focus stays on the button. One component for the drawer and Create.
 */
export function HelpTip({ label, children, className = "" }: { /** What the tip explains, for screen readers ("Help: One-off"). */ label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const id = useId()

  const place = useCallback(() => {
    const b = button.current?.getBoundingClientRect()
    if (!b) return
    const width = Math.min(256, window.innerWidth - 16), height = box.current?.offsetHeight ?? 0
    const left = Math.max(8, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - 8))
    // Below the button, or above it when there's no room below.
    const below = b.bottom + 6
    setPos({ top: height && below + height > window.innerHeight - 8 ? Math.max(8, b.top - 6 - height) : below, left })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation(); e.preventDefault()
      setOpen(false); button.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!button.current?.contains(t) && !box.current?.contains(t)) setOpen(false)
    }
    window.addEventListener("keydown", onKey, true)
    document.addEventListener("pointerdown", onDown, true)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      document.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, place])

  return (
    <>
      <button ref={button} type="button" aria-label={`Help: ${label}`} aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        className={`inline-grid place-items-center h-4 w-4 shrink-0 rounded-full border border-neutral-400 text-[10px] font-semibold leading-none text-neutral-500 align-middle hover:border-neutral-700 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${open ? "border-neutral-800 text-neutral-900" : ""} ${className}`}>
        ?
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={box} id={id} role="note" aria-label={label} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="fixed z-70 w-64 max-w-[calc(100vw-16px)] rounded-md bg-neutral-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed text-white shadow-lg">
          {children}
        </div>, document.body)}
    </>
  )
}
