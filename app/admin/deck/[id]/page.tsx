"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { buildSlides } from "@/lib/deck/slides"
import { SLIDE_META } from "@/lib/deck/slide-meta"
import { buildBlankSlide } from "@/lib/deck/default-deck"
import { SLIDE_TYPES, type DeckSlide, type SalesDeck, type SlideType } from "@/types/deck-types"

type SaveState = "idle" | "saving" | "saved" | "error"

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

  const updateImage = useCallback(
    (instanceId: string, value: string) => {
      setSlides((prev) =>
        prev.map((s) => (s.instance_id === instanceId ? { ...s, image: value || undefined } : s)),
      )
      scheduleSave()
    },
    [scheduleSave],
  )

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

  const moveSlide = (instanceId: string, dir: -1 | 1) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.instance_id === instanceId)
      const target = idx + dir
      if (idx === -1 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
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
        onImageEdit: (id) => setSelectedId(id),
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
          <div className="flex items-center gap-3 shrink-0">
            {saveLabel && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px] tabular-nums">
                <span className={`inline-block h-1 w-1 rounded-full ${saveLabel.dot}`} aria-hidden="true" />
                {saveLabel.text}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[11px] capitalize">
              {deck.status}
            </span>
          </div>
        </div>

        {/* Body: rail · stage · panel */}
        <div className="flex-1 min-h-0 flex">
          {/* Slide rail */}
          <div className="w-44 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {thumbs.map((t, i) => {
                const active = t.instance_id === selectedId
                return (
                  <div key={t.instance_id} className="group">
                    <button
                      onClick={() => setSelectedId(t.instance_id)}
                      className={`w-full block rounded-md overflow-hidden ring-1 transition-all ${
                        active ? "ring-2 ring-neutral-900" : "ring-neutral-200 hover:ring-neutral-300"
                      }`}
                      title={SLIDE_META[t.type].label}
                    >
                      <div className="@container aspect-video w-full bg-white overflow-hidden pointer-events-none">
                        {t.node}
                      </div>
                    </button>
                    <div className="flex items-center justify-between mt-0.5 px-0.5">
                      <span className="text-[10px] text-neutral-400 tabular-nums truncate">
                        {String(i + 1).padStart(2, "0")} · {SLIDE_META[t.type].label}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveSlide(t.instance_id, -1)}
                          disabled={i === 0}
                          className="p-0.5 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30"
                          title="Move up"
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveSlide(t.instance_id, 1)}
                          disabled={i === thumbs.length - 1}
                          className="p-0.5 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30"
                          title="Move down"
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeSlide(t.instance_id)}
                          disabled={thumbs.length <= 1}
                          className="p-0.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                          title="Remove slide"
                          aria-label="Remove slide"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
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

                {selectedMeta.hasImage && (
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-600">
                      <ImageIcon className="h-3 w-3 text-neutral-400" />
                      Image URL
                    </label>
                    <input
                      value={selectedSlide.image ?? ""}
                      onChange={(e) => updateImage(selectedSlide.instance_id, e.target.value)}
                      placeholder="Paste an image URL…"
                      className="w-full h-8 px-2 ring-1 ring-neutral-200 rounded-md bg-white text-xs text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                    />
                    <p className="text-[10px] text-neutral-400">
                      Leave blank to use the template&apos;s stock image. Asset picker + AI generation land in the next phase.
                    </p>
                  </div>
                )}

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
    </AdminRoleGuard>
  )
}
