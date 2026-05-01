"use client"

import { useEffect, useRef, useState } from "react"
import { Flag, Plus, Loader2, X, Trash2, Calendar } from "lucide-react"

export interface ChartAnnotation {
  id: string
  propertyId: string
  date: string
  label: string
  note?: string
  createdBy: string
  createdAt: string
}

interface AnnotationManagerProps {
  propertyId: string
  /** Receives the current annotation list whenever it changes — chart subscribes
   *  to this to re-render its ReferenceLines. */
  onAnnotationsChange?: (annotations: ChartAnnotation[]) => void
}

/**
 * Compact "Annotations" button next to a chart header. Opens a popover with
 * the list of existing annotations + an inline "Add" form. Annotations are
 * scoped per GA4 property (Firestore-backed).
 */
export function AnnotationManager({ propertyId, onAnnotationsChange }: AnnotationManagerProps) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0])
  const [formLabel, setFormLabel] = useState("")
  const [formNote, setFormNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Load annotations whenever the property changes
  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/admin/analytics/annotations?propertyId=${encodeURIComponent(propertyId)}`,
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const list = (data.annotations ?? []) as ChartAnnotation[]
        setAnnotations(list)
        onAnnotationsChange?.(list)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [propertyId, onAnnotationsChange])

  // Outside-click + Esc to close
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const handleAdd = async () => {
    if (!formLabel.trim()) {
      setError("Label is required")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      setError("Date must be YYYY-MM-DD")
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/analytics/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          date: formDate,
          label: formLabel.trim(),
          note: formNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      const next = [data.annotation, ...annotations].sort((a, b) =>
        b.date.localeCompare(a.date),
      )
      setAnnotations(next)
      onAnnotationsChange?.(next)
      setFormLabel("")
      setFormNote("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this annotation?")) return
    try {
      const res = await fetch(`/api/admin/analytics/annotations?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      const next = annotations.filter((a) => a.id !== id)
      setAnnotations(next)
      onAnnotationsChange?.(next)
    } catch {
      // Silent — re-render will keep the row visible if delete fails
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-neutral-600 border border-neutral-200 bg-white hover:border-neutral-300 transition-colors"
        title="Annotations"
      >
        <Flag className="w-3.5 h-3.5" />
        <span>Annotations</span>
        {annotations.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-semibold bg-neutral-900 text-white rounded-full">
            {annotations.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-80 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Annotations
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Add form */}
          <div className="p-3 border-b border-neutral-100 space-y-2 bg-neutral-50">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="flex-1 px-2 py-1 text-[12px] border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <input
              type="text"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="Label (e.g. Homepage redesign)"
              maxLength={80}
              className="w-full px-2 py-1 text-[12px] border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <textarea
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Optional note — context, links, etc."
              rows={2}
              className="w-full px-2 py-1 text-[12px] border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
            />
            {error && <p className="text-[11px] text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving || !formLabel.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-[12px] font-medium rounded hover:bg-neutral-800 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add annotation
            </button>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              </div>
            ) : annotations.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px] text-neutral-400">
                No annotations yet. Pin context with the form above.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {annotations.map((a) => (
                  <li key={a.id} className="px-3 py-2 flex items-start gap-2 hover:bg-neutral-50 group">
                    <Flag className="w-3 h-3 text-neutral-400 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] tabular-nums text-neutral-400">{a.date}</span>
                        <span className="text-[12px] font-medium text-neutral-900 truncate">{a.label}</span>
                      </div>
                      {a.note && (
                        <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{a.note}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-600 transition-opacity"
                      aria-label="Delete annotation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
