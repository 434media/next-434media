"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Download, Trash2, Film, RefreshCw, X } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { GeneratePanel } from "@/components/crm/GeneratePanel"
import { ProviderLogo } from "@/components/crm/ProviderLogo"
import { HowItWorks } from "@/components/admin/HowItWorks"
import type { StoredAsset } from "@/components/crm/types"
import { sanitizeAssetUrl as sanitizeUrl, toDownloadUrl } from "@/lib/asset-url"

// Studio — the AI generation home + reusable asset library. Generate image/video
// (auto-saved to the library), download for the blog/feed/social, or spin a new
// content post from any asset. Sibling of the content Calendar; not the default.

type KindFilter = "all" | "image" | "video"

// Starter prompts for the empty library — one click to try, so a first-time
// admin isn't staring at a blank box. Kept generic/brand-neutral.
const EXAMPLE_PROMPTS = [
  "A minimalist product shot on a clean studio background, soft lighting",
  "A bold, colorful social graphic announcing a community event",
  "A cinematic 16:9 hero image of a city skyline at golden hour",
]

// model id is "creator/model-name" (e.g. "openai/gpt-image-2"). Split for the
// provider logo and a short display name.
function providerOf(modelId?: string): string {
  return modelId?.split("/")[0] ?? ""
}
function modelShort(modelId?: string): string {
  if (!modelId) return ""
  return modelId.split("/")[1] ?? modelId
}

// Compact relative time ("2h ago", "3d ago") from an ISO string.
function timeAgo(iso?: string): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}


export default function StudioPage() {
  const [assets, setAssets] = useState<StoredAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [filter, setFilter] = useState<KindFilter>("all")
  // Remix seed handed to the GeneratePanel (bump nonce to re-trigger same url).
  const [seed, setSeed] = useState<{ url: string; nonce: number } | null>(null)
  // Asset opened in the detail lightbox (full-size + prompt/model metadata).
  const [detail, setDetail] = useState<StoredAsset | null>(null)
  // Example prompt pushed into the generator (bump nonce to re-fire same text).
  const [seedPrompt, setSeedPrompt] = useState<{ text: string; nonce: number } | null>(null)

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
    setDetail((cur) => (cur?.id === id ? null : cur))
    await fetch(`/api/admin/crm/assets?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => loadFirst())
  }

  // Load an existing image into the generator as a reference, then scroll up.
  const handleRemix = (asset: StoredAsset) => {
    setSeed({ url: asset.url, nonce: Date.now() })
    setDetail(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Close the detail lightbox on Escape.
  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [detail])

  // Fill the generator with an example prompt and scroll to it.
  const applyExamplePrompt = (text: string) => {
    setSeedPrompt({ text, nonce: Date.now() })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const shown = filter === "all" ? assets : assets.filter((a) => a.kind === filter)

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-medium text-neutral-900">AI Studio</h2>
            <p className="text-[13px] text-neutral-600 mt-0.5 max-w-xl">
              Generate images and video for social, blog, and campaigns. Pick a model, describe what you
              want, and every result is saved to your library to reuse anywhere.
            </p>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-xl">
              One API key, hundreds of models — unified billing and observability across your entire AI
              stack, via the Vercel AI Gateway.
            </p>
          </div>

          {/* How it works — dismissible first-run intro */}
          <HowItWorks
            storageKey="aiStudioIntroDismissed"
            steps={[
              { title: "Pick a model", detail: "Each has a “good for…” hint — try one you haven't used." },
              { title: "Describe or upload", detail: "Write a prompt, or attach a reference image to edit & remix." },
              { title: "Generate & reuse", detail: "Every result is saved to your library for social, blog, and campaigns." },
            ]}
          />

          {/* Generate */}
          <GeneratePanel open seed={seed} seedPrompt={seedPrompt} onGenerated={() => loadFirst()} />

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
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 px-6 text-center">
                <p className="text-sm text-neutral-500">No assets yet — try one of these to get started:</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyExamplePrompt(p)}
                      className="text-left max-w-xs px-3 py-1.5 rounded-full ring-1 ring-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50 hover:ring-neutral-300 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {shown.map((asset) => (
                    <div
                      key={asset.id}
                      className="group rounded-lg overflow-hidden ring-1 ring-neutral-200 bg-white"
                    >
                      {/* Media — click to open the detail view */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetail(asset)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setDetail(asset)
                          }
                        }}
                        className="relative block w-full aspect-square bg-neutral-900 cursor-zoom-in"
                      >
                        {asset.kind === "video" ? (
                          <>
                            <video
                              src={sanitizeUrl(asset.url)}
                              muted
                              loop
                              playsInline
                              preload="metadata"
                              onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}) }}
                              onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                              <Film className="w-3 h-3" /> video
                            </span>
                          </>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sanitizeUrl(asset.url)} alt={asset.title || asset.prompt || "Asset"} className="w-full h-full object-cover" />
                        )}

                        {/* Hover actions — stopPropagation so they don't open detail */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end opacity-0 group-hover:opacity-100">
                          <div className="w-full p-2 flex items-center gap-1.5">
                            <a
                              href={toDownloadUrl(asset.url) || "#"}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white/90 text-neutral-800 hover:bg-white text-xs font-medium"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>
                            {asset.kind === "image" && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemix(asset) }}
                                title="Remix — use as a reference"
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white/90 text-neutral-800 hover:bg-white text-xs font-medium"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Remix
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDelete(asset.id) }}
                              title="Remove from library"
                              className="ml-auto grid place-items-center h-8 w-8 rounded-md bg-white/90 text-red-600 hover:bg-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Caption — provider logo + model + when */}
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        {asset.model ? (
                          <>
                            <ProviderLogo provider={providerOf(asset.model)} size={14} />
                            <span className="text-[11px] text-neutral-700 truncate" title={asset.model}>
                              {modelShort(asset.model)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] text-neutral-500 truncate capitalize">{asset.source ?? asset.kind}</span>
                        )}
                        <span className="ml-auto shrink-0 text-[10px] text-neutral-400">{timeAgo(asset.created_at)}</span>
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

        {/* Detail lightbox — full-size asset + the prompt/model that made it.
            For a team learning unfamiliar models, "what produced this" is the
            key signal, so the prompt + model are front and center. */}
        {detail && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setDetail(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-4xl max-h-[88vh] flex flex-col md:flex-row rounded-xl bg-white shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Media */}
              <div className="md:flex-1 min-h-0 bg-neutral-900 flex items-center justify-center">
                {detail.kind === "video" ? (
                  <video src={sanitizeUrl(detail.url)} controls autoPlay loop playsInline className="max-w-full max-h-[50vh] md:max-h-[88vh] object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sanitizeUrl(detail.url)} alt={detail.prompt || "Asset"} className="max-w-full max-h-[50vh] md:max-h-[88vh] object-contain" />
                )}
              </div>

              {/* Info + actions */}
              <div className="md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-neutral-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
                  <h3 className="text-sm font-medium text-neutral-900">Asset details</h3>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="grid place-items-center h-7 w-7 rounded-md text-neutral-500 hover:bg-neutral-100"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {/* Model */}
                  {detail.model && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 mb-1">Model</p>
                      <div className="flex items-center gap-2">
                        <ProviderLogo provider={providerOf(detail.model)} size={18} />
                        <span className="text-sm text-neutral-900" title={detail.model}>{detail.model}</span>
                      </div>
                    </div>
                  )}

                  {/* Prompt */}
                  {detail.prompt && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 mb-1">Prompt</p>
                      <p className="text-[13px] text-neutral-700 leading-snug whitespace-pre-wrap">{detail.prompt}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-neutral-600">
                    <span className="capitalize">{detail.kind}</span>
                    {detail.aspectRatio && <span>{detail.aspectRatio}</span>}
                    {detail.durationSec ? <span>{detail.durationSec}s</span> : null}
                    {detail.created_at && <span>{timeAgo(detail.created_at)}</span>}
                  </div>
                  {detail.created_by && (
                    <p className="text-[11px] text-neutral-400">Created by {detail.created_by}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-200">
                  <a
                    href={toDownloadUrl(detail.url) || "#"}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  {detail.kind === "image" && (
                    <button
                      type="button"
                      onClick={() => handleRemix(detail)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Remix
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(detail.id)}
                    title="Remove from library"
                    className="ml-auto grid place-items-center h-9 w-9 rounded-lg text-red-600 ring-1 ring-neutral-300 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRoleGuard>
  )
}
