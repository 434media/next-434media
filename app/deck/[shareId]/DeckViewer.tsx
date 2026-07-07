"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { buildSlides } from "@/lib/deck/slides"
import type { DeckSlide } from "@/types/deck-types"

// Public, read-only presentation viewer for a shared deck. Keyboard + click
// navigation, one 16:9 slide at a time. No editing affordances.

export function DeckViewer({ slides, name }: { slides: DeckSlide[]; name: string }) {
  const built = useMemo(() => buildSlides(slides, { editable: false }), [slides])
  const [current, setCurrent] = useState(0)
  const count = built.length

  const go = useCallback(
    (d: number) => setCurrent((c) => Math.min(Math.max(c + d, 0), count - 1)),
    [count],
  )
  const goTo = useCallback((i: number) => setCurrent(i), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        go(1)
      }
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go])

  if (count === 0) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-400 text-sm">
        This deck has no slides.
      </div>
    )
  }

  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white">
      {/* Stage */}
      <div className="flex flex-1 items-center justify-center bg-neutral-900 md:bg-transparent md:p-4 min-h-0">
        <div className="@container relative h-full w-full overflow-hidden bg-white shadow-2xl md:aspect-video md:h-auto md:max-w-[min(100vw,calc((100vh-4rem)*16/9))] md:rounded-lg md:ring-1 md:ring-white/10">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden md:overflow-hidden">
            {built[current].node}
          </div>
          {/* Click zones (desktop) */}
          <button
            aria-label="Previous slide"
            onClick={() => go(-1)}
            disabled={current === 0}
            className="absolute bottom-0 left-0 top-0 hidden w-[12%] cursor-w-resize disabled:cursor-default md:block"
          />
          <button
            aria-label="Next slide"
            onClick={() => go(1)}
            disabled={current === count - 1}
            className="absolute bottom-0 right-0 top-0 hidden w-[12%] cursor-e-resize disabled:cursor-default md:block"
          />
        </div>
      </div>

      {/* Controls */}
      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-neutral-900 bg-neutral-950 px-4 md:px-6">
        <div className="w-28 truncate font-geist-mono text-xs text-neutral-400" title={name}>
          <span className="font-bold text-white tabular-nums">{String(current + 1).padStart(2, "0")}</span>{" "}
          / <span className="tabular-nums">{String(count).padStart(2, "0")}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => go(-1)}
            disabled={current === 0}
            className="grid place-items-center h-8 w-8 rounded-full border border-neutral-700 transition-colors hover:bg-white hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-1.5 sm:flex">
            {built.map((s, i) => (
              <button
                key={s.instance_id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-6 bg-white" : "w-1.5 bg-neutral-600 hover:bg-neutral-400"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => go(1)}
            disabled={current === count - 1}
            className="grid place-items-center h-8 w-8 rounded-full border border-neutral-700 transition-colors hover:bg-white hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden w-28 flex-col text-right sm:flex">
          <p className="font-geist-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">434 Media</p>
        </div>
      </footer>
    </section>
  )
}
