"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import type { Asset } from "./types"

const safeUrl = (u: string | null | undefined) => { try { const x = new URL(u ?? ""); return x.protocol === "https:" ? x.toString() : "" } catch { return "" } }
const FOCUSABLE = 'button, [href], video[controls], [tabindex]:not([tabindex="-1"])'

/**
 * Preview (plan v11.1 Step 3 part 3): a design at full size, for review only. It opens over a drawer, steps through a
 * carousel's pages (buttons or the arrow keys), plays a video with its controls, and closes on Esc, the close button or
 * a click on the backdrop. Keys are taken in the capture phase so the drawer underneath neither closes nor traps focus.
 */
export function DesignPreview({ assets, index, label, onIndex, onClose }: { assets: Asset[]; index: number | null; label: string; onIndex(i: number): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const open = index !== null && index < assets.length
  const count = assets.length

  // Focus the close button on open; give focus back to whatever opened the preview on close.
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>("[data-preview-close]")?.focus()
    return () => { before?.focus?.() }
  }, [open])

  useEffect(() => {
    if (!open || index === null) return
    const onKey = (e: KeyboardEvent) => {
      const box = ref.current
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onClose(); return }
      // A focused video keeps its own arrow keys for seeking.
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && count > 1 && !(e.target instanceof HTMLVideoElement)) {
        e.stopPropagation(); e.preventDefault()
        onIndex((index + (e.key === "ArrowRight" ? 1 : count - 1)) % count)
        return
      }
      if (e.key === "Tab" && box) {
        e.stopPropagation()
        const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.hasAttribute("disabled"))
        if (!items.length) { e.preventDefault(); return }
        const first = items[0], last = items[items.length - 1]
        if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus() }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, index, count, onIndex, onClose])

  if (!open || index === null || typeof document === "undefined") return null
  const asset = assets[index]
  const page = count > 1 ? `Page ${index + 1} of ${count}` : ""
  // Clicks on the dark area (the dialog itself or a wrapper marked as backdrop) close; clicks on the design don't.
  const backdrop = (e: React.MouseEvent) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.backdrop !== undefined) onClose() }
  const step = (d: number) => onIndex((index + d + count) % count)

  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`Preview: ${label}`} onClick={backdrop}
      className="fixed inset-0 z-60 flex flex-col bg-black/85 text-white">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3" data-backdrop>
        <p className="text-sm font-medium">Preview · {label}{page && <span className="text-white/60 font-normal"> · {page}</span>}</p>
        <button type="button" data-preview-close onClick={onClose} aria-label="Close preview" className="grid place-items-center h-9 w-9 rounded-md text-white/80 hover:text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 pb-4 sm:px-4" data-backdrop>
        {count > 1 && <button type="button" onClick={() => step(-1)} aria-label="Previous page" className="shrink-0 grid place-items-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20">
          <ChevronLeft className="w-5 h-5" />
        </button>}
        <div className="flex-1 min-w-0 h-full flex items-center justify-center" data-backdrop>
          {asset.kind === "video"
            ? <video key={asset.url} src={safeUrl(asset.url)} controls playsInline className="max-w-full max-h-full rounded bg-black object-contain" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img key={asset.url} src={safeUrl(asset.url)} alt={`${label} design${count > 1 ? `, page ${index + 1}` : ""}`} className="max-w-full max-h-full rounded object-contain" />}
        </div>
        {count > 1 && <button type="button" onClick={() => step(1)} aria-label="Next page" className="shrink-0 grid place-items-center h-10 w-10 rounded-full bg-white/10 hover:bg-white/20">
          <ChevronRight className="w-5 h-5" />
        </button>}
      </div>
    </div>,
    document.body,
  )
}
