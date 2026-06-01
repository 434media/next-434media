"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, X, Film, Check } from "lucide-react"
import type { StoredAsset } from "./types"
import { sanitizeAssetUrl } from "@/lib/asset-url"

// Shared "pick from the asset library" modal. Reuses /api/admin/crm/assets
// (same source as the Studio page). Used by the content-post drawer (kind="all"
// → returns image or video Assets) and by ImageUpload for Feed/Blog (kind="image"
// → single image URL). The host decides what to do with the returned asset.

interface AssetLibraryPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: StoredAsset) => void
  /** Restrict to one media kind. Omit for both (hides the All/Images/Videos toggle). */
  kind?: "image" | "video"
  title?: string
}

type KindFilter = "all" | "image" | "video"

export function AssetLibraryPicker({ open, onClose, onSelect, kind, title }: AssetLibraryPickerProps) {
  const [assets, setAssets] = useState<StoredAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Only relevant when no fixed `kind` is given.
  const [filter, setFilter] = useState<KindFilter>("all")

  const loadFirst = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/crm/assets", { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      setAssets(data.assets ?? [])
      setNextCursor(data.nextCursor ?? null)
    } catch {
      setAssets([])
      setNextCursor(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // (Re)load each time the modal opens so newly generated assets show up.
  useEffect(() => {
    if (open) loadFirst()
  }, [open, loadFirst])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const loadMore = async () => {
    if (!nextCursor) return
    setIsLoadingMore(true)
    try {
      const res = await fetch(`/api/admin/crm/assets?cursor=${encodeURIComponent(nextCursor)}`, {
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      setAssets((prev) => [...prev, ...(data.assets ?? [])])
      setNextCursor(data.nextCursor ?? null)
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (!open) return null

  // A fixed `kind` always wins over the toggle.
  const effectiveKind: KindFilter = kind ?? filter
  const shown = effectiveKind === "all" ? assets : assets.filter((a) => a.kind === effectiveKind)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3 className="text-sm font-medium text-neutral-900">{title ?? "Choose from library"}</h3>
          <div className="flex items-center gap-2">
            {!kind && (
              <div className="inline-flex rounded-lg ring-1 ring-neutral-200 overflow-hidden">
                {(["all", "image", "video"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={filter === k}
                    className={`h-7 px-2.5 text-xs font-medium capitalize transition-colors ${
                      filter === k ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {k === "all" ? "All" : k === "image" ? "Images" : "Videos"}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid place-items-center h-7 w-7 rounded-md text-neutral-500 hover:bg-neutral-100"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading library…
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
              No {effectiveKind === "all" ? "assets" : `${effectiveKind}s`} in the library yet — generate one in the Studio.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {shown.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onSelect(asset)}
                    title={asset.title || asset.prompt || "Use this asset"}
                    className="group relative rounded-lg overflow-hidden ring-1 ring-neutral-200 hover:ring-2 hover:ring-neutral-900 bg-neutral-900 aspect-square transition-all"
                  >
                    {asset.kind === "video" ? (
                      <>
                        <video src={sanitizeAssetUrl(asset.url)} muted playsInline className="w-full h-full object-cover" />
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                          <Film className="w-3 h-3" /> video
                        </span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sanitizeAssetUrl(asset.url)}
                        alt={asset.title || asset.prompt || "Asset"}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {/* Select affordance on hover */}
                    <span className="absolute inset-0 bg-neutral-900/0 group-hover:bg-neutral-900/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white text-neutral-900 text-xs font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Use
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {nextCursor && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
