"use client"

import { useState, useEffect } from "react"
import { Loader2, Plus, Download, Upload, Images, X, RefreshCw } from "lucide-react"
import type { Asset } from "./types"
import { sanitizeAssetUrl as sanitizeUrl, toDownloadUrl } from "@/lib/asset-url"
import { ProviderLogo } from "./ProviderLogo"
import { AssetLibraryPicker } from "./AssetLibraryPicker"

// Shared "Generate with AI" panel — used both inside the content-post drawer
// (with onAdd → attach to the post) and on the Studio page (onGenerated →
// refresh the library). Generation goes through the decoupled generate-asset
// route, which also persists every result to the asset library. The panel owns
// all generation state; hosts just react to the produced Asset.

export interface GenModel {
  id: string
  label: string
  kind: "image" | "video"
  provider: string
  supportsImageInput: boolean
  priceLabel: string | null
  available: boolean
}

interface GeneratePanelProps {
  /** Shown only when open. Lets the host gate mounting without unmounting state. */
  open: boolean
  /** When provided, a primary action appears on the preview (e.g. "Add to post"). */
  onAdd?: (asset: Asset) => void
  addLabel?: string
  /** Called after each successful generation (e.g. Studio refreshes its grid). */
  onGenerated?: (asset: Asset) => void
  /** Push a reference image in (e.g. "Remix" from the library). Bump `nonce` to
   *  re-trigger with the same url. */
  seed?: { url: string; nonce: number } | null
}

const MAX_REFS = 4

export function GeneratePanel({ open, onAdd, addLabel = "Add", onGenerated, seed }: GeneratePanelProps) {
  const [genModels, setGenModels] = useState<GenModel[]>([])
  const [genKind, setGenKind] = useState<"image" | "video">("image")
  const [genModelId, setGenModelId] = useState("")
  const [genPrompt, setGenPrompt] = useState("")
  const [refs, setRefs] = useState<string[]>([]) // reference/input images for edit + remix
  const [isUploadingRef, setIsUploadingRef] = useState(false)
  const [showRefPicker, setShowRefPicker] = useState(false)
  const [genAspectRatio, setGenAspectRatio] = useState("1:1")
  const [genDuration, setGenDuration] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genOutOfCredits, setGenOutOfCredits] = useState(false)
  const [genPreview, setGenPreview] = useState<Asset | null>(null)
  const [genStatus, setGenStatus] = useState<"idle" | "working" | "ready">("idle")

  // Load the curated model roster (live pricing/availability) when opened.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch("/api/admin/crm/content-posts/models", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.models) return
        const models = data.models as GenModel[]
        setGenModels(models)
        setGenModelId((cur) => cur || models[0]?.id || "")
      })
      .catch(() => {
        /* leave roster empty — panel hides itself when there are no models */
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Keep the selected model valid when the kind toggle flips.
  const genModelsForKind = genModels.filter((m) => m.kind === genKind)
  useEffect(() => {
    if (genModelsForKind.length === 0) return
    if (!genModelsForKind.some((m) => m.id === genModelId)) {
      setGenModelId(genModelsForKind[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKind, genModels])

  // Remix seed from the host (library "Remix"): add as a reference image, switch
  // to image mode, clear any stale preview.
  useEffect(() => {
    if (!seed?.url) return
    setGenKind("image")
    setGenPreview(null)
    setGenStatus("idle")
    setRefs((cur) => (cur.includes(seed.url) ? cur : [...cur, seed.url].slice(0, MAX_REFS)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce])

  const selectedModel = genModelsForKind.find((m) => m.id === genModelId) ?? null
  // Reference images: image models that accept input images (edit/remix), or any
  // video model (the first image is the i2v source).
  const showRefs = genKind === "video" || !!selectedModel?.supportsImageInput

  const addRef = (url: string) => {
    const clean = sanitizeUrl(url)
    if (!clean) return
    setRefs((cur) => (cur.includes(clean) ? cur : [...cur, clean].slice(0, MAX_REFS)))
  }
  const removeRef = (url: string) => setRefs((cur) => cur.filter((u) => u !== url))

  const handleUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingRef(true)
    setGenError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "content-posts")
      const res = await fetch("/api/upload/crm", { method: "POST", body: fd, credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) addRef(data.url as string)
      else setGenError(data.error || "Upload failed")
    } catch {
      setGenError("Upload failed")
    } finally {
      setIsUploadingRef(false)
      e.target.value = ""
    }
  }

  const pollVideoJob = async (jobId: string) => {
    for (let i = 0; i < 144; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      try {
        const res = await fetch(`/api/admin/crm/generate-asset?jobId=${encodeURIComponent(jobId)}`, {
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (data.status === "completed" && data.asset) {
          setGenPreview(data.asset as Asset)
          setGenStatus("ready")
          onGenerated?.(data.asset as Asset)
          return
        }
        if (data.status === "failed") {
          setGenError(data.error || "Generation failed")
          setGenStatus("idle")
          return
        }
      } catch {
        // transient network error — keep polling
      }
    }
    setGenError("Generation is taking longer than expected — check back shortly.")
    setGenStatus("idle")
  }

  const handleGenerate = async () => {
    if (!genPrompt.trim()) {
      setGenError("A prompt is required.")
      return
    }
    setIsGenerating(true)
    setGenError(null)
    setGenOutOfCredits(false)
    setGenPreview(null)
    setGenStatus("working")
    try {
      const imageRefs = showRefs ? refs : []
      const res = await fetch("/api/admin/crm/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelId: genModelId,
          prompt: genPrompt.trim(),
          image_urls: imageRefs.length > 0 ? imageRefs : undefined,
          aspect_ratio: genAspectRatio,
          duration: genKind === "video" ? genDuration : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === "out_of_credits") setGenOutOfCredits(true)
        else setGenError(data.error || "Generation failed")
        setGenStatus("idle")
        return
      }
      if (data.asset) {
        setGenPreview(data.asset as Asset)
        setGenStatus("ready")
        onGenerated?.(data.asset as Asset)
      } else if (data.jobId) {
        await pollVideoJob(data.jobId as string)
      } else {
        setGenError("Unexpected response from generation.")
        setGenStatus("idle")
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed")
      setGenStatus("idle")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAdd = () => {
    if (!genPreview || !onAdd) return
    onAdd(genPreview)
    setGenPreview(null)
    setGenStatus("idle")
    setGenPrompt("")
  }

  // Use the just-generated image as a reference and start a new round.
  const remixPreview = () => {
    if (!genPreview || genPreview.kind !== "image") return
    setGenKind("image")
    addRef(genPreview.url)
    setGenPreview(null)
    setGenStatus("idle")
  }

  if (!open || genModels.length === 0) return null

  const refLabel = genKind === "video" ? "Source image" : "Reference images"
  const refHint =
    genKind === "video"
      ? "Optional — animate an image (image-to-video). The first image is used."
      : "Optional — upload or pick images to edit / remix."

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3.5">
      <div>
        <h4 className="text-sm font-medium text-neutral-900 leading-tight">Generate with AI Models</h4>
        <p className="text-[11px] text-neutral-500">Powered by the  Vercel AI Gateway</p>
      </div>

      {genOutOfCredits && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-medium">Generation unavailable</span> — the AI Gateway account is out of credits.
          Add credits in the Vercel dashboard.
        </div>
      )}

      {/* Image / Video segmented toggle */}
      <div className="inline-flex rounded-lg ring-1 ring-neutral-200 overflow-hidden">
        {(["image", "video"] as const).map((k) => {
          const active = genKind === k
          const hasModels = genModels.some((m) => m.kind === k)
          return (
            <button
              key={k}
              type="button"
              disabled={!hasModels}
              onClick={() => setGenKind(k)}
              aria-pressed={active}
              className={`flex-1 h-8 px-5 text-xs font-medium capitalize transition-colors ${
                active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {k}
            </button>
          )
        })}
      </div>

      {/* Model picker — logo + name + price cards (Vercel-style) */}
      <div>
        <p className="text-[11px] font-medium text-neutral-500 mb-1.5">Model</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {genModelsForKind.map((m) => {
            const active = m.id === genModelId
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setGenModelId(m.id)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  active
                    ? "border-neutral-900 ring-1 ring-neutral-900 bg-neutral-50"
                    : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                <ProviderLogo provider={m.provider} size={20} />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-neutral-900 truncate" title={m.id}>{m.id}</span>
                  <span className="block text-[10px] text-neutral-500 truncate">
                    {m.priceLabel ?? "usage-based"}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reference images (edit / remix / animate) */}
      {showRefs && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-neutral-500">{refLabel}</p>
            <div className="flex items-center gap-1.5">
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-neutral-200 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-colors">
                <input type="file" accept="image/*" onChange={handleUploadRef} className="hidden" disabled={isUploadingRef} />
                {isUploadingRef ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload
              </label>
              <button
                type="button"
                onClick={() => setShowRefPicker(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md ring-1 ring-neutral-200 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Images className="w-3 h-3" />
                Library
              </button>
            </div>
          </div>
          {refs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {refs.map((url) => (
                <div key={url} className="relative w-14 h-14 rounded-md overflow-hidden ring-1 ring-neutral-200 bg-neutral-100 group/ref">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Reference" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeRef(url)}
                    className="absolute top-0.5 right-0.5 grid place-items-center h-4 w-4 rounded-full bg-black/60 text-white opacity-0 group-hover/ref:opacity-100 transition-opacity"
                    aria-label="Remove reference"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400">{refHint}</p>
          )}
        </div>
      )}

      <textarea
        value={genPrompt}
        onChange={(e) => setGenPrompt(e.target.value)}
        placeholder={
          genKind === "video"
            ? "Describe the motion / scene…"
            : refs.length > 0
            ? "Describe the edit — what to change or add…"
            : "Describe the image…"
        }
        rows={3}
        className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
      />

      {/* Aspect ratio (both) + duration (video) */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          Aspect
          <select
            value={genAspectRatio}
            onChange={(e) => setGenAspectRatio(e.target.value)}
            className="px-2 py-1 rounded-md bg-white border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:border-neutral-400"
          >
            {["1:1", "4:5", "16:9", "9:16", "4:3", "3:4"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        {genKind === "video" && (
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            Duration
            <select
              value={genDuration}
              onChange={(e) => setGenDuration(Number(e.target.value))}
              className="px-2 py-1 rounded-md bg-white border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:border-neutral-400"
            >
              {[5, 8, 10].map((d) => (
                <option key={d} value={d}>{d}s</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {genKind === "video" && genStatus !== "ready" && (
        <p className="text-[11px] text-neutral-500 leading-snug">
          Video can take a few minutes — keep this open while it generates.
        </p>
      )}
      {genError && <p className="text-xs text-red-600">{genError}</p>}

      {genStatus === "working" && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating {genKind === "video" ? "video" : "image"}…
        </div>
      )}

      {/* Preview + actions */}
      {genStatus === "ready" && genPreview && (
        <div className="space-y-2">
          <div className="relative w-full max-h-72 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900">
            {genPreview.kind === "video" ? (
              <video src={sanitizeUrl(genPreview.url)} controls playsInline className="w-full max-h-72 object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sanitizeUrl(genPreview.url)} alt="Generated preview" className="w-full max-h-72 object-contain" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={toDownloadUrl(genPreview.url) || "#"}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            {genPreview.kind === "image" && (
              <button
                type="button"
                onClick={remixPreview}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Remix
              </button>
            )}
            {onAdd && (
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {addLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setGenPreview(null)
                setGenStatus("idle")
              }}
              className="ml-auto text-xs text-neutral-500 hover:text-neutral-800"
            >
              {onAdd ? "Discard" : "Generate another"}
            </button>
          </div>
        </div>
      )}

      {/* Generate button — hidden once a preview is ready */}
      {genStatus !== "ready" && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !genPrompt.trim() || !genModelId}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {refs.length > 0 && genKind === "image" ? "Remix image" : `Generate ${genKind === "video" ? "video" : "image"}`}
          </button>
        </div>
      )}

      {/* Reference-image library picker */}
      <AssetLibraryPicker
        open={showRefPicker}
        kind="image"
        onClose={() => setShowRefPicker(false)}
        onSelect={(asset) => {
          addRef(asset.url)
          setShowRefPicker(false)
        }}
        title="Choose a reference image"
      />
    </div>
  )
}
