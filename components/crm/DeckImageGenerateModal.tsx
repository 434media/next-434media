"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { GeneratePanel } from "./GeneratePanel"
import { sanitizeAssetUrl } from "@/lib/asset-url"
import type { Asset } from "./types"

// "Generate media with AI" modal for the Sales Deck. Wraps the shared
// GeneratePanel — image OR video (a web deck can autoplay looping video). Every
// result is persisted to the asset library. On "Use media" the picked Asset's
// URL + kind flow back to the caller, which sets it on the slide.

interface DeckImageGenerateModalProps {
  open: boolean
  onClose: () => void
  onUse: (url: string, kind: "image" | "video") => void
}

export function DeckImageGenerateModal({ open, onClose, onUse }: DeckImageGenerateModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const handleUse = (asset: Asset) => {
    const url = sanitizeAssetUrl(asset.url)
    if (url) onUse(url, asset.kind === "video" ? "video" : "image")
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 shrink-0">
          <h3 className="text-sm font-medium text-neutral-900">Generate slide media</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center h-7 w-7 rounded-md text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <GeneratePanel open onAdd={handleUse} addLabel="Use media" />
        </div>
      </div>
    </div>
  )
}
