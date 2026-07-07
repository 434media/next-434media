"use client"

// THROWAWAY — Phase 1b verification only. Renders the default deck read-only to
// confirm the ported slide renderer works on the admin stack (fonts, container
// queries, layout). Replaced by the real /admin/deck editor + /deck/[id] view.

import { useMemo } from "react"
import { buildSlides } from "@/lib/deck/slides"
import { buildDefaultDeckSlides } from "@/lib/deck/default-deck"

export default function DeckLabPage() {
  const slides = useMemo(() => buildDefaultDeckSlides(), [])
  const built = useMemo(() => buildSlides(slides, { editable: false }), [slides])

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Deck renderer — preview</h1>
          <p className="text-sm text-neutral-500">
            Phase 1b sanity check: default 12-slide template, read-only. {built.length} slides.
          </p>
        </div>
        {built.map((s, i) => (
          <div key={s.instance_id} className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
              {String(i + 1).padStart(2, "0")} · {s.type}
            </p>
            <div className="@container aspect-video w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5">
              {s.node}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
