"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Images,
  Upload,
  AlertCircle,
  Globe,
  Link2,
  Check,
  ExternalLink,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { AssetLibraryPicker } from "@/components/crm/AssetLibraryPicker"
import { DeckImageGenerateModal } from "@/components/crm/DeckImageGenerateModal"
import { sanitizeAssetUrl } from "@/lib/asset-url"
import { buildSlides } from "@/lib/deck/slides"
import { SLIDE_META } from "@/lib/deck/slide-meta"
import { buildBlankSlide } from "@/lib/deck/default-deck"
import {
  SLIDE_TYPES,
  type DeckSlide,
  type DeckStatus,
  type SalesDeck,
  type SlideMediaKind,
  type SlideType,
} from "@/types/deck-types"

type SaveState = "idle" | "saving" | "saved" | "error"
type MediaSlot = "image" | "image2"
type MediaTarget = { id: string; slot: MediaSlot }

export default function DeckEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const deckId = params.id

  const [deck, setDeck] = useState<SalesDeck | null>(null)
  const [name, setName] = useState("")
  const [slides, setSlides] = useState<DeckSlide[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [addOpen, setAddOpen] = useState(false)

  // Media picking — which slide + slot is targeted, and which surface is open.
  const [mediaTarget, setMediaTarget] = useState<MediaTarget | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<MediaSlot | null>(null)

  // Drag-to-reorder state (native HTML5 DnD): index of the slide being dragged.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // Publish / share.
  const [isPublishing, setIsPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  // Debounced autosave bookkeeping.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const latest = useRef<{ name: string; slides: DeckSlide[] }>({ name: "", slides: [] })
  useEffect(() => {
    latest.current = { name, slides }
  }, [name, slides])

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/admin/crm/decks/${deckId}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || "Failed to load deck")
        }
        const data = await res.json()
        if (cancelled) return
        const d = data.deck as SalesDeck
        setDeck(d)
        setName(d.name)
        setSlides(d.slides)
        setSelectedId(d.slides[0]?.instance_id ?? null)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load deck")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deckId])

  // ── Save ──────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    setSaveState("saving")
    try {
      const res = await fetch(`/api/admin/crm/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: latest.current.name, slides: latest.current.slides }),
      })
      if (!res.ok) throw new Error("save failed")
      setSaveState("saved")
    } catch {
      dirtyRef.current = true
      setSaveState("error")
    }
  }, [deckId])

  // Mark dirty + schedule a save. Called by every mutation.
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    setSaveState("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(save, 900)
  }, [save])

  // Flush on unmount + warn on unsaved navigation away.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (dirtyRef.current) save()
    }
  }, [save])

  // ── Mutations ─────────────────────────────────────────────────────────
  const updateName = (v: string) => {
    setName(v)
    scheduleSave()
  }

  const updateText = useCallback(
    (instanceId: string, key: string, value: string) => {
      setSlides((prev) =>
        prev.map((s) => (s.instance_id === instanceId ? { ...s, texts: { ...s.texts, [key]: value } } : s)),
      )
      scheduleSave()
    },
    [scheduleSave],
  )

  // Set (or clear, when url is "") a slide's media on the given slot. Clearing
  // resets both the url and the kind so the slide falls back to its stock image.
  const updateMedia = useCallback(
    (instanceId: string, slot: MediaSlot, url: string, kind: SlideMediaKind = "image") => {
      const urlKey = slot === "image" ? "image" : "image2"
      const kindKey = slot === "image" ? "imageKind" : "image2Kind"
      setSlides((prev) =>
        prev.map((s) =>
          s.instance_id === instanceId
            ? { ...s, [urlKey]: url || undefined, [kindKey]: url ? kind : undefined }
            : s,
        ),
      )
      scheduleSave()
    },
    [scheduleSave],
  )

  // Upload a local file → Vercel Blob → set as the target slide's media. Uses the
  // client upload flow (browser → Blob direct) so it isn't bound by the ~4.5MB
  // serverless body limit — local videos up to 50MB work.
  const handleUploadMedia = async (file: File, instanceId: string, slot: MediaSlot) => {
    setUploadError(null)
    setUploadingSlot(slot)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const blob = await upload(`decks/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      })
      const kind: SlideMediaKind = (file.type || "").startsWith("video/") ? "video" : "image"
      updateMedia(instanceId, slot, sanitizeAssetUrl(blob.url), kind)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingSlot(null)
    }
  }

  // Flip published state. Flushes any pending edit first so the published deck
  // reflects the latest slides.
  const setPublishState = async (next: DeckStatus) => {
    setIsPublishing(true)
    try {
      if (dirtyRef.current) await save()
      const res = await fetch(`/api/admin/crm/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error("Failed to update publish state")
      const data = await res.json()
      setDeck(data.deck as SalesDeck)
    } catch (err) {
      console.error("[deck] publish toggle failed:", err)
    } finally {
      setIsPublishing(false)
    }
  }

  const shareUrl =
    deck && typeof window !== "undefined" ? `${window.location.origin}/deck/${deck.share_id}` : ""

  const copyShareLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const addSlide = (type: SlideType) => {
    const blank = buildBlankSlide(type)
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.instance_id === selectedId)
      const at = idx === -1 ? prev.length : idx + 1
      return [...prev.slice(0, at), blank, ...prev.slice(at)]
    })
    setSelectedId(blank.instance_id)
    setAddOpen(false)
    scheduleSave()
  }

  const removeSlide = (instanceId: string) => {
    setSlides((prev) => {
      if (prev.length <= 1) return prev
      const idx = prev.findIndex((s) => s.instance_id === instanceId)
      const next = prev.filter((s) => s.instance_id !== instanceId)
      if (selectedId === instanceId) {
        const fallback = next[Math.min(idx, next.length - 1)]
        setSelectedId(fallback?.instance_id ?? null)
      }
      return next
    })
    scheduleSave()
  }

  // Native HTML5 drag-to-reorder: move the slide at `from` to `to`.
  const reorderSlides = (from: number, to: number) => {
    if (from === to) return
    setSlides((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    scheduleSave()
  }

  // ── Derived renders ───────────────────────────────────────────────────
  // Read-only mini renders for the rail thumbnails.
  const thumbs = useMemo(() => buildSlides(slides, { editable: false }), [slides])
  // Editable render of the selected slide for the center stage.
  const editableBuilt = useMemo(
    () =>
      buildSlides(slides, {
        editable: true,
        onTextChange: updateText,
        // Clicking a slide's media opens the library picker for that slide + slot.
        onImageEdit: (id, slot) => {
          setSelectedId(id)
          setMediaTarget({ id, slot })
          setLibraryOpen(true)
        },
      }),
    [slides, updateText],
  )
  const selectedSlide = slides.find((s) => s.instance_id === selectedId) ?? null
  const selectedNode = editableBuilt.find((b) => b.instance_id === selectedId)?.node ?? null
  const selectedMeta = selectedSlide ? SLIDE_META[selectedSlide.type] : null

  const saveLabel =
    saveState === "saving"
      ? { dot: "bg-neutral-900 animate-pulse", text: "Saving" }
      : saveState === "saved"
        ? { dot: "bg-emerald-500", text: "Saved" }
        : saveState === "error"
          ? { dot: "bg-red-500", text: "Save failed" }
          : null

  // ── UI ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
        <div className="flex items-center justify-center min-h-[60vh] text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading deck…</span>
        </div>
      </AdminRoleGuard>
    )
  }

  if (loadError || !deck) {
    return (
      <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
        <div className="max-w-md mx-auto mt-16 bg-white rounded-md ring-1 ring-neutral-200/70 p-8 text-center">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">Couldn&apos;t load this deck</p>
          <p className="text-xs text-neutral-500 mb-3">{loadError}</p>
          <button
            onClick={() => router.push("/admin/deck")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to decks
          </button>
        </div>
      </AdminRoleGuard>
    )
  }

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
      <div className="flex flex-col h-full bg-neutral-50 text-neutral-900">
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/admin/deck")}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors shrink-0"
              title="Back to decks"
              aria-label="Back to decks"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              value={name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Untitled deck"
              className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-neutral-900 bg-transparent border-0 outline-none focus:ring-0 placeholder:text-neutral-300"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveLabel && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px] tabular-nums">
                <span className={`inline-block h-1 w-1 rounded-full ${saveLabel.dot}`} aria-hidden="true" />
                {saveLabel.text}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 text-[11px] capitalize ${
                deck.status === "published"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200"
              }`}
            >
              {deck.status}
            </span>

            {deck.status === "published" ? (
              <>
                <button
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  title={shareUrl}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={`/deck/${deck.share_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                  title="View shared deck"
                  aria-label="View shared deck"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => setPublishState("draft")}
                  disabled={isPublishing}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Unpublish
                </button>
              </>
            ) : (
              <button
                onClick={() => setPublishState("published")}
                disabled={isPublishing}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                Publish
              </button>
            )}
          </div>
        </div>

        {/* Body: rail · stage · panel */}
        <div className="flex-1 min-h-0 flex">
          {/* Slide rail */}
          <div className="w-44 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {thumbs.map((t, i) => {
                const active = t.instance_id === selectedId
                const isDragging = dragIndex === i
                const isDropTarget = dropIndex === i && dragIndex !== null && dragIndex !== i
                return (
                  <div
                    key={t.instance_id}
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(i)
                      e.dataTransfer.effectAllowed = "move"
                      e.dataTransfer.setData("text/plain", String(i))
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = "move"
                      if (dropIndex !== i) setDropIndex(i)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragIndex !== null) reorderSlides(dragIndex, i)
                      setDragIndex(null)
                      setDropIndex(null)
                    }}
                    onDragEnd={() => {
                      setDragIndex(null)
                      setDropIndex(null)
                    }}
                    className={`group rounded-md transition-opacity ${isDragging ? "opacity-40" : ""} ${
                      isDropTarget ? "ring-2 ring-neutral-900 ring-offset-1" : ""
                    }`}
                  >
                    <div className="relative">
                      <button
                        onClick={() => setSelectedId(t.instance_id)}
                        className={`block w-full overflow-hidden rounded-md ring-1 transition-all ${
                          active ? "ring-2 ring-neutral-900" : "ring-neutral-200 hover:ring-neutral-300"
                        }`}
                        title={SLIDE_META[t.type].label}
                      >
                        <div className="@container aspect-video w-full overflow-hidden bg-white pointer-events-none">
                          {t.node}
                        </div>
                      </button>
                      <span
                        className="absolute left-1 top-1 grid h-5 w-5 cursor-grab place-items-center rounded bg-white/80 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                        title="Drag to reorder"
                        aria-hidden
                      >
                        <GripVertical className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between px-0.5">
                      <span className="truncate text-[10px] tabular-nums text-neutral-400">
                        {String(i + 1).padStart(2, "0")} · {SLIDE_META[t.type].label}
                      </span>
                      <button
                        onClick={() => removeSlide(t.instance_id)}
                        disabled={thumbs.length <= 1}
                        className="rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 disabled:opacity-30 group-hover:opacity-100"
                        title="Remove slide"
                        aria-label="Remove slide"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Add slide */}
            <div className="relative border-t border-neutral-200 p-2">
              <button
                onClick={() => setAddOpen((o) => !o)}
                className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add slide
              </button>
              {addOpen && (
                <div className="absolute bottom-12 left-2 right-2 max-h-72 overflow-y-auto rounded-md bg-white ring-1 ring-neutral-200 shadow-lg z-10 p-1">
                  {SLIDE_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => addSlide(type)}
                      className="w-full text-left px-2 py-1.5 rounded text-[12px] text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                      {SLIDE_META[type].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stage */}
          <div className="flex-1 min-w-0 overflow-auto bg-neutral-100 p-4 md:p-8 flex items-start justify-center">
            {selectedNode ? (
              <div className="@container aspect-video w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5">
                {selectedNode}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 mt-16">Select a slide to edit.</p>
            )}
          </div>

          {/* Field panel */}
          <div className="w-72 shrink-0 border-l border-neutral-200 bg-white overflow-y-auto">
            {selectedSlide && selectedMeta ? (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Slide</p>
                  <p className="text-sm font-medium text-neutral-900">{selectedMeta.label}</p>
                </div>

                {selectedMeta.hasImage &&
                  (
                    [
                      {
                        slot: "image" as MediaSlot,
                        label: selectedMeta.imageLabel ?? "Image",
                        url: selectedSlide.image,
                        kind: selectedSlide.imageKind ?? "image",
                      },
                      ...(selectedMeta.hasImage2
                        ? [
                            {
                              slot: "image2" as MediaSlot,
                              label: selectedMeta.image2Label ?? "Second image",
                              url: selectedSlide.image2,
                              kind: selectedSlide.image2Kind ?? "image",
                            },
                          ]
                        : []),
                    ] as { slot: MediaSlot; label: string; url?: string; kind: SlideMediaKind }[]
                  ).map(({ slot, label, url, kind }) => (
                    <div key={slot} className="space-y-2">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-600">
                        <ImageIcon className="h-3 w-3 text-neutral-400" />
                        {label}
                      </label>
                      <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200">
                        {url ? (
                          kind === "video" ? (
                            <video src={sanitizeAssetUrl(url)} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sanitizeAssetUrl(url)} alt="" className="h-full w-full object-cover" />
                          )
                        ) : (
                          <span className="text-[10px] text-neutral-400">Template stock image</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => {
                            setMediaTarget({ id: selectedSlide.instance_id, slot })
                            setLibraryOpen(true)
                          }}
                          className="inline-flex flex-col items-center gap-1 rounded-md bg-white py-2 text-[10px] font-medium text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
                        >
                          <Images className="h-3.5 w-3.5" />
                          Library
                        </button>
                        <button
                          onClick={() => {
                            setMediaTarget({ id: selectedSlide.instance_id, slot })
                            setGenerateOpen(true)
                          }}
                          className="inline-flex flex-col items-center gap-1 rounded-md bg-white py-2 text-[10px] font-medium text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                          Generate
                        </button>
                        <label className="inline-flex cursor-pointer flex-col items-center gap-1 rounded-md bg-white py-2 text-[10px] font-medium text-neutral-700 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50">
                          {uploadingSlot === slot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Upload
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleUploadMedia(f, selectedSlide.instance_id, slot)
                              e.target.value = ""
                            }}
                          />
                        </label>
                      </div>
                      {url && (
                        <button
                          onClick={() => updateMedia(selectedSlide.instance_id, slot, "")}
                          className="text-[10px] text-neutral-400 transition-colors hover:text-neutral-700"
                        >
                          Use template stock image
                        </button>
                      )}
                    </div>
                  ))}
                {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}

                {selectedMeta.fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-600">{field.label}</label>
                    {field.multiline ? (
                      <textarea
                        value={selectedSlide.texts[field.key] ?? ""}
                        onChange={(e) => updateText(selectedSlide.instance_id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={4}
                        className="w-full px-2 py-1.5 ring-1 ring-neutral-200 rounded-md bg-white text-xs text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-y"
                      />
                    ) : (
                      <input
                        value={selectedSlide.texts[field.key] ?? ""}
                        onChange={(e) => updateText(selectedSlide.instance_id, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full h-8 px-2 ring-1 ring-neutral-200 rounded-md bg-white text-xs text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                      />
                    )}
                    {field.multiline && (
                      <p className="text-[10px] text-neutral-400">One item per line.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-neutral-400">No slide selected.</div>
            )}
          </div>
        </div>
      </div>

      {/* Media pickers — target the slide + slot captured in mediaTarget. Images
          and videos are both selectable (a web deck can autoplay looping video). */}
      <AssetLibraryPicker
        open={libraryOpen}
        title="Choose slide media"
        onClose={() => setLibraryOpen(false)}
        onSelect={(asset) => {
          if (mediaTarget) {
            const kind: SlideMediaKind = asset.kind === "video" ? "video" : "image"
            updateMedia(mediaTarget.id, mediaTarget.slot, sanitizeAssetUrl(asset.url), kind)
          }
          setLibraryOpen(false)
        }}
      />
      <DeckImageGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onUse={(url, kind) => {
          if (mediaTarget) updateMedia(mediaTarget.id, mediaTarget.slot, url, kind)
          setGenerateOpen(false)
        }}
      />
    </AdminRoleGuard>
  )
}
