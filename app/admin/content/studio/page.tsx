"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Download, Trash2, Film, RefreshCw } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { GeneratePanel } from "@/components/crm/GeneratePanel"
import type { StoredAsset } from "@/components/crm/types"
import { sanitizeAssetUrl as sanitizeUrl, toDownloadUrl } from "@/lib/asset-url"

// Studio — the AI generation home + reusable asset library. Generate image/video
// (auto-saved to the library), download for the blog/feed/social, or spin a new
// content post from any asset. Sibling of the content Calendar; not the default.

type KindFilter = "all" | "image" | "video"


export default function StudioPage() {
  const [assets, setAssets] = useState<StoredAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filter, setFilter] = useState<KindFilter>("all")
  // Remix seed handed to the GeneratePanel (bump nonce to re-trigger same url).
  const [seed, setSeed] = useState<{ url: string; nonce: number } | null>(null)

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

  useEffect(() => {
    loadFirst()
  }, [loadFirst])

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

  const handleDelete = async (id: string) => {
    // Optimistic — remove from the grid; the record-only delete won't touch the
    // Blob, so any content post referencing it keeps working.
    setAssets((prev) => prev.filter((a) => a.id !== id))
    await fetch(`/api/admin/crm/assets?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => loadFirst())
  }

  // Load an existing image into the generator as a reference, then scroll up.
  const handleRemix = (asset: StoredAsset) => {
    setSeed({ url: asset.url, nonce: Date.now() })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const shown = filter === "all" ? assets : assets.filter((a) => a.kind === filter)

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-medium text-neutral-900">AI Studio</h2>
            <p className="text-[13px] text-neutral-500 mt-0.5 max-w-md">
              One API key, hundreds of models. Unified billing and observability across your entire AI stack, with image, and video models.
            </p>
          </div>

          {/* Generate */}
          <GeneratePanel open seed={seed} onGenerated={() => loadFirst()} />

          {/* Library */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-900">Library</h3>
              <div className="inline-flex rounded-lg ring-1 ring-neutral-200 overflow-hidden">
                {(["all", "image", "video"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={filter === k}
                    className={`h-8 px-3 text-xs font-medium capitalize transition-colors ${
                      filter === k ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {k === "all" ? "All" : k === "image" ? "Images" : "Videos"}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 py-12 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading library…
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
                No assets yet — generate one above to start your library.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {shown.map((asset) => (
                    <div
                      key={asset.id}
                      className="group relative rounded-lg overflow-hidden ring-1 ring-neutral-200 bg-neutral-900 aspect-square"
                    >
                      {asset.kind === "video" ? (
                        <>
                          <video src={sanitizeUrl(asset.url)} muted playsInline className="w-full h-full object-cover" />
                          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                            <Film className="w-3 h-3" /> video
                          </span>
                        </>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sanitizeUrl(asset.url)} alt={asset.title || asset.prompt || "Asset"} className="w-full h-full object-cover" />
                      )}

                      {/* Hover actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end opacity-0 group-hover:opacity-100">
                        <div className="w-full p-2 flex items-center gap-1.5">
                          <a
                            href={toDownloadUrl(asset.url) || "#"}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download"
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white/90 text-neutral-800 hover:bg-white text-xs font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </a>
                          {asset.kind === "image" && (
                            <button
                              type="button"
                              onClick={() => handleRemix(asset)}
                              title="Remix — use as a reference"
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white/90 text-neutral-800 hover:bg-white text-xs font-medium"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Remix
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(asset.id)}
                            title="Remove from library"
                            className="ml-auto grid place-items-center h-8 w-8 rounded-md bg-white/90 text-red-600 hover:bg-white"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {nextCursor && filter === "all" && (
                  <div className="flex justify-center pt-2">
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
    </AdminRoleGuard>
  )
}
