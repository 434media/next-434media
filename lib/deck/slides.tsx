"use client"

/**
 * Canonical 434 Media sales-deck slide templates.
 *
 * Ported from the 434-sandbox pitch deck. The visual design of each slide is
 * intact — layout, colors, typography, image placement all match the original.
 * What changed for the admin:
 *   - Data model is `DeckSlide` (instance_id + type), not the sandbox `SlideData`.
 *   - `buildSlides` renders each slide BY ITS `type`, so a deck is an ordered,
 *     reorderable, duplicatable list of slide instances (not 12 fixed slides).
 *   - An `editable` flag serves both the editor (inline text + image picker) and
 *     the read-only public share view from one renderer.
 *   - Images are Asset URLs (Vercel Blob), never inline base64 — the image picker
 *     is provided by the editor via `onImageEdit`; this file never touches files.
 */

import { useState, useRef, useEffect, type ReactNode } from "react"
import type { DeckSlide, SlideType } from "@/types/deck-types"

/* ================================================================== */
/*  Design tokens                                                       */
/* ================================================================== */

export const HEAD =
  "font-ggx88 font-black uppercase tracking-tighter leading-[0.85] text-neutral-900"

// Fallback imagery per slide type — shown when a slide has no Asset image yet.
export const defaultImages = {
  title:
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=2070&auto=format&fit=crop",
  opportunity:
    "https://images.unsplash.com/photo-1551076805-e18690c5e561?q=80&w=2070&auto=format&fit=crop",
  plan: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop",
  why: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=2069&auto=format&fit=crop",
  audience:
    "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=2070&auto=format&fit=crop",
  flowLeft:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
  flowRight:
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop",
  success:
    "https://images.unsplash.com/photo-1576091160550-2173ff9e5eb3?q=80&w=2070&auto=format&fit=crop",
  metrics:
    "https://images.unsplash.com/photo-1581056771107-24ca5f033842?q=80&w=2070&auto=format&fit=crop",
  engagement:
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop",
}

/* ================================================================== */
/*  Shared primitives                                                   */
/* ================================================================== */

/**
 * Grayscale media panel — renders a still image or a muted, looping video (for
 * web-hosted decks), with a stripe fallback when the source fails or is absent.
 * Grayscale is applied to both to keep the deck's monochrome design language.
 */
export function Photo({
  src,
  className = "",
  position,
  kind = "image",
}: {
  src?: string
  className?: string
  position?: { x: number; y: number }
  kind?: "image" | "video"
}) {
  const [errored, setErrored] = useState(false)
  const objectPosition = `${position?.x ?? 50}% ${position?.y ?? 50}%`
  return (
    <div className={`relative overflow-hidden bg-neutral-300 ${className}`}>
      {src && !errored && kind === "video" ? (
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover grayscale"
          style={{ objectPosition }}
        />
      ) : src && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover grayscale"
          style={{ objectPosition }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(135deg, #d4d4d4 0 14px, #c8c8c8 14px 28px)",
          }}
        />
      )}
    </div>
  )
}

/** Faint full-bleed image treatment for slides whose canonical layout is typographic. */
function CustomImageBackground({
  src,
  position,
  kind = "image",
}: {
  src?: string
  position?: { x: number; y: number }
  kind?: "image" | "video"
}) {
  if (!src) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-30">
      <Photo src={src} position={position} className="h-full w-full" kind={kind} />
    </div>
  )
}

/**
 * Image panel. Read-only by default; in editable mode it surfaces a "Change
 * image" affordance that calls `onEdit` (the editor opens the Asset picker).
 * Unlike the sandbox original, this never reads a File / produces base64 —
 * images are always Asset URLs.
 */
export function SlideImage({
  src,
  position,
  className = "",
  editable = false,
  onEdit,
  kind = "image",
}: {
  src?: string
  position?: { x: number; y: number }
  className?: string
  editable?: boolean
  onEdit?: () => void
  kind?: "image" | "video"
}) {
  if (!editable) return <Photo src={src} position={position} className={className} kind={kind} />
  return (
    <div
      className={`group relative cursor-pointer ${className}`}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit?.()
        }
      }}
    >
      <Photo src={src} position={position} className="h-full w-full" kind={kind} />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
          Change media
        </span>
      </div>
    </div>
  )
}

/** Click-to-edit inline text. In read-only mode it renders a plain tag. */
export function EditableText({
  value,
  onChange,
  className = "",
  as: Tag = "p",
  scale = 1,
  editable = false,
}: {
  value: string
  onChange: (newVal: string) => void
  className?: string
  as?: "p" | "h1" | "h2" | "h3" | "li" | "span"
  /** Multiplier applied to this field's rendered font size, relative to its template size. */
  scale?: number
  editable?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Read-only: render the value as a static node (empty → nothing).
  if (!editable) {
    if (!value) return null
    const Component = Tag
    const inner =
      scale !== 1 ? <span style={{ fontSize: `${scale}em` }}>{value}</span> : value
    return <Component className={className}>{inner}</Component>
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      setEditing(false)
    }
    if (e.key === "Escape") setEditing(false)
  }

  if (editing) {
    const common =
      "w-full bg-transparent border-b border-neutral-900 outline-none text-inherit font-inherit resize-none"
    if (Tag === "h1" || Tag === "h2" || Tag === "h3") {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={handleKeyDown}
          className={`${common} ${className}`}
        />
      )
    }
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={handleKeyDown}
        rows={3}
        className={`${common} ${className}`}
      />
    )
  }

  const Component = Tag
  const content = value || <span className="italic text-neutral-400">Click to edit</span>
  return (
    <Component
      onClick={() => setEditing(true)}
      className={`cursor-text rounded px-1 transition-colors hover:bg-neutral-100/50 ${className}`}
    >
      {scale !== 1 ? <span style={{ fontSize: `${scale}em` }}>{content}</span> : content}
    </Component>
  )
}

/** Decorative SVG waveform used on the "what we heard" and "next steps" slides. */
export function Waveform() {
  const bars = Array.from({ length: 90 })
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      preserveAspectRatio="none"
      viewBox="0 0 900 300"
      aria-hidden
    >
      {bars.map((_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.3)) * 240
        return <rect key={i} x={i * 10} y={(300 - h) / 2} width={4} height={h} fill="#111" />
      })}
    </svg>
  )
}

/** Split a newline list into trimmed items, stripping any leading bullet glyphs. */
function listItems(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.replace(/^[•\-–—]\s*/, "").trim())
    .filter(Boolean)
}

/**
 * A multiline list field. Read-only → a bulleted <ul>; editable → a textarea
 * (via EditableText) so the author edits raw newline-separated text.
 */
function BulletList({
  value,
  onChange,
  editable,
  scale = 1,
  ulClassName = "",
}: {
  value: string
  onChange: (v: string) => void
  editable: boolean
  scale?: number
  ulClassName?: string
}) {
  if (editable) {
    return (
      <EditableText
        value={value}
        onChange={onChange}
        as="p"
        className="whitespace-pre-wrap"
        scale={scale}
        editable
      />
    )
  }
  const items = listItems(value)
  if (items.length === 0) return null
  return (
    <ul className={`list-disc ${ulClassName}`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

/* ================================================================== */
/*  Per-type slide renderers                                            */
/* ================================================================== */

interface SlideCtx {
  slide: DeckSlide
  editable: boolean
  /** Update one text field on this slide. */
  updateText: (key: string, val: string) => void
  /** Open the media picker for this slide's primary image (editor-provided). */
  editImage: () => void
  /** Open the media picker for this slide's secondary image (layouts with two). */
  editImage2: () => void
}

// Fallback image key used by each type's photo panel / background.
const FALLBACK_IMAGE: Record<SlideType, keyof typeof defaultImages> = {
  title: "title",
  heard: "opportunity",
  opportunity: "opportunity",
  strategy: "plan",
  plan: "plan",
  why: "why",
  audience: "audience",
  flow: "flowLeft",
  success: "success",
  metrics: "metrics",
  engagement: "engagement",
  nextsteps: "engagement",
}

function imageFor(slide: DeckSlide): string {
  return slide.image || defaultImages[FALLBACK_IMAGE[slide.type]]
}

const RENDERERS: Record<SlideType, (ctx: SlideCtx) => ReactNode> = {
  /* ────────────── 01 · TITLE ────────────── */
  title: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="flex h-full min-h-full w-full flex-col md:flex-row">
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 md:h-full md:min-h-0 md:w-1/2"
        />
        <div className="flex w-full flex-1 flex-col items-center justify-center bg-white px-6 py-12 md:w-1/2 md:px-[3cqw] md:py-0">
          <div className={`${HEAD} w-full text-center text-6xl md:text-[8cqw]`}>
            <EditableText
              value={slide.texts.company || ""}
              onChange={(v) => updateText("company", v)}
              as="h1"
              className="text-inherit whitespace-pre-line"
              scale={fs}
              editable={editable}
            />
          </div>
          <div className="mt-4 text-center text-sm font-bold uppercase tracking-[0.25em] text-neutral-900 md:mt-[2.5cqw] md:text-[1.3cqw]">
            <EditableText
              value={slide.texts.subtitle || "Presented By : 434 Media"}
              onChange={(v) => updateText("subtitle", v)}
              as="span"
              className="text-inherit"
              scale={fs}
              editable={editable}
            />
          </div>
        </div>
      </div>
    )
  },

  /* ────────────── 02 · WHAT WE HEARD ────────────── */
  heard: ({ slide, editable, updateText }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="relative flex h-full min-h-full w-full flex-col items-center justify-center overflow-hidden bg-[#F8F9FA] px-6 py-12 md:px-[5cqw] md:py-0">
        <CustomImageBackground src={slide.image} position={slide.imagePosition} kind={slide.imageKind} />
        <Waveform />
        <h2 className={`${HEAD} relative z-10 w-full text-center text-4xl md:text-[7cqw]`}>
          WHAT WE HEARD
        </h2>
        <div className="relative z-10 mt-8 grid w-full grid-cols-1 gap-8 md:mt-[3cqw] md:grid-cols-3 md:gap-[3cqw]">
          {[
            { h: "Current Challenges", key: "challenge" },
            { h: "Current Opportunities", key: "opportunity" },
            { h: "Desired Outcomes", key: "outcome" },
          ].map((col) => (
            <div key={col.h} className="space-y-3 md:space-y-[1.4cqw]">
              <h3 className="inline-block border-b-2 border-neutral-900 pb-1 text-lg font-bold text-neutral-900 md:pb-[0.3cqw] md:text-[1.7cqw]">
                {col.h}
              </h3>
              <div className="space-y-2 text-sm text-neutral-800 md:space-y-[0.8cqw] md:text-[1.3cqw]">
                <BulletList
                  value={slide.texts[col.key] || ""}
                  onChange={(v) => updateText(col.key, v)}
                  editable={editable}
                  scale={fs}
                  ulClassName="space-y-1 pl-5 marker:text-neutral-900 md:space-y-[0.4cqw] md:pl-[1.2cqw]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },

  /* ────────────── 03 · OPPORTUNITY ────────────── */
  opportunity: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="flex h-full min-h-full w-full flex-col-reverse bg-white md:flex-row">
        <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 md:w-1/2 md:px-[4cqw] md:py-0">
          <h2 className={`${HEAD} mb-4 text-4xl md:mb-[2.5cqw] md:text-[5.5cqw]`}>OPPORTUNITY</h2>
          <div className="mb-4 text-lg font-bold leading-snug text-neutral-900 md:mb-[2cqw] md:text-[1.6cqw]">
            <EditableText
              value={slide.texts.headline || ""}
              onChange={(v) => updateText("headline", v)}
              as="h3"
              className="text-inherit"
              scale={fs}
              editable={editable}
            />
          </div>
          <div className="text-xs font-bold uppercase leading-relaxed tracking-wider text-neutral-800 md:text-[1.1cqw]">
            <BulletList
              value={slide.texts.bullets || ""}
              onChange={(v) => updateText("bullets", v)}
              editable={editable}
              scale={fs}
              ulClassName="space-y-2 pl-5 md:space-y-[0.9cqw] md:pl-[1.4cqw]"
            />
          </div>
        </div>
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 md:h-full md:min-h-0 md:w-1/2"
        />
      </div>
    )
  },

  /* ────────────── 04 · STRATEGIC RECOMMENDATION ────────────── */
  strategy: ({ slide, editable, updateText }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="relative flex h-full min-h-full w-full flex-col items-center justify-center overflow-hidden bg-white px-6 py-12 md:flex-row md:px-[4cqw] md:py-0">
        <CustomImageBackground src={slide.image} position={slide.imagePosition} kind={slide.imageKind} />
        <div className="relative z-10 flex w-full flex-col justify-center text-center md:w-3/5 md:pr-[3cqw] md:text-left">
          <h2 className={`${HEAD} mb-4 text-4xl md:mb-[2.5cqw] md:text-[5.5cqw]`}>
            STRATEGIC
            <br className="hidden md:block" /> RECOMMENDATION
          </h2>
          <div className="space-y-4 text-base font-medium text-neutral-800 md:space-y-[1.6cqw] md:text-[1.5cqw]">
            <EditableText value={slide.texts.line1 || ""} onChange={(v) => updateText("line1", v)} as="p" className="text-inherit" scale={fs} editable={editable} />
            <EditableText value={slide.texts.line2 || ""} onChange={(v) => updateText("line2", v)} as="p" className="text-inherit" scale={fs} editable={editable} />
            <EditableText value={slide.texts.line3 || ""} onChange={(v) => updateText("line3", v)} as="p" className="text-inherit" scale={fs} editable={editable} />
          </div>
        </div>
        <div className="relative z-10 my-12 flex aspect-square w-[75vw] max-w-[320px] shrink-0 items-center justify-center md:my-0 md:w-[26cqw] md:max-w-none">
          {/* Acquire → Educate → Retain → Refer cycle, drawn as four clockwise arrows. */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <marker id="deckStrategyArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#b8b8b8" />
              </marker>
            </defs>
            {(() => {
              const R = 36
              const pt = (deg: number): [number, number] => {
                const r = ((deg - 90) * Math.PI) / 180
                return [50 + R * Math.cos(r), 50 + R * Math.sin(r)]
              }
              return [0, 90, 180, 270].map((start) => {
                const [x1, y1] = pt(start + 10)
                const [x2, y2] = pt(start + 78)
                return (
                  <path
                    key={start}
                    d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`}
                    fill="none"
                    stroke="#c9c9c9"
                    strokeWidth={7}
                    strokeLinecap="round"
                    markerEnd="url(#deckStrategyArrow)"
                  />
                )
              })
            })()}
          </svg>
          {(
            [
              ["Acquire", "top-0 left-1/2 -translate-x-1/2"],
              ["Educate", "right-0 top-1/2 -translate-y-1/2"],
              ["Retain", "bottom-0 left-1/2 -translate-x-1/2"],
              ["Refer", "left-0 top-1/2 -translate-y-1/2"],
            ] as const
          ).map(([label, pos]) => (
            <div
              key={label}
              className={`absolute ${pos} z-10 rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold uppercase tracking-widest text-neutral-900 shadow-md md:px-[1.5cqw] md:py-[0.7cqw] md:text-[1.1cqw]`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    )
  },

  /* ────────────── 05 · MARKETING PLAN ────────────── */
  plan: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    const phases = [
      { n: "Phase 1", labelKey: "phase1_label", itemsKey: "phase1_items" },
      { n: "Phase 2", labelKey: "phase2_label", itemsKey: "phase2_items" },
      { n: "Phase 3", labelKey: "phase3_label", itemsKey: "phase3_items" },
    ]
    // Increasing left indent per phase echoes the source deck's diagonal cascade.
    const stagger = ["md:ml-0", "md:ml-[6%]", "md:ml-[12%]"]
    return (
      <div className="flex h-full min-h-full w-full flex-col bg-white md:flex-row">
        {/* Left: title over the "road" image */}
        <div className="flex w-full flex-col md:w-[40%] md:shrink-0">
          <div className="flex flex-1 flex-col justify-center px-6 pt-10 md:px-[4cqw] md:pt-0">
            <h2 className={`${HEAD} text-4xl md:text-[5cqw]`}>
              RECOMMENDED
              <br className="hidden md:block" /> MARKETING
              <br className="hidden md:block" /> PLAN
            </h2>
          </div>
          <SlideImage
            src={imageFor(slide)}
            kind={slide.imageKind}
            position={slide.imagePosition}
            editable={editable}
            onEdit={editImage}
            className="h-[26vh] min-h-[26vh] w-full shrink-0 md:h-[42%] md:min-h-0"
          />
        </div>
        {/* Right: cascading phases */}
        <div className="flex w-full flex-1 flex-col justify-center gap-6 px-6 py-10 md:gap-[1.8cqw] md:px-[4cqw] md:py-0">
          {phases.map((p, i) => (
            <div key={p.n} className={`relative ${stagger[i] ?? ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-lg font-black text-neutral-900 md:text-[1.7cqw]">{p.n}</h3>
                <EditableText
                  value={slide.texts[p.labelKey] || ""}
                  onChange={(v) => updateText(p.labelKey, v)}
                  as="span"
                  className="font-bold text-neutral-500 md:text-[1.3cqw]"
                  scale={fs}
                  editable={editable}
                />
              </div>
              <BulletList
                value={slide.texts[p.itemsKey] || ""}
                onChange={(v) => updateText(p.itemsKey, v)}
                editable={editable}
                scale={fs}
                ulClassName="mt-1 space-y-0.5 pl-5 text-sm text-neutral-800 md:mt-[0.3cqw] md:space-y-[0.2cqw] md:pl-[1.4cqw] md:text-[1.2cqw]"
              />
              {i < phases.length - 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-3 left-6 text-neutral-300 md:-bottom-[0.9cqw] md:left-[10%] md:text-[1.6cqw]"
                >
                  ↘
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  },

  /* ────────────── 06 · WHY THIS MATTERS ────────────── */
  why: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="flex h-full min-h-full w-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-[#F8F9FA] px-6 py-12 md:gap-[2.5cqw] md:px-[5cqw] md:py-0">
          <h2 className={`${HEAD} w-full text-center text-4xl md:text-[7cqw]`}>WHY THIS MATTERS</h2>
          <div className="grid w-full grid-cols-1 gap-6 text-center md:grid-cols-3 md:gap-[3cqw]">
            {["point1", "point2", "point3"].map((key) => (
              <div key={key} className="px-2 text-base font-bold text-neutral-900 md:px-[1.5cqw] md:text-[1.4cqw]">
                <EditableText
                  value={slide.texts[key] || ""}
                  onChange={(v) => updateText(key, v)}
                  as="p"
                  className="text-inherit"
                  scale={fs}
                  editable={editable}
                />
              </div>
            ))}
          </div>
        </div>
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[34vh] min-h-[34vh] w-full shrink-0 md:h-[34%] md:min-h-0"
        />
      </div>
    )
  },

  /* ────────────── 07 · AUDIENCE PRIORITIZATION ────────────── */
  audience: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="flex h-full min-h-full w-full flex-col items-center bg-[#F8F9FA] md:flex-row">
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[35vh] min-h-[35vh] w-full shrink-0 shadow-xl md:h-[84%] md:min-h-0 md:w-1/2 md:rounded-r-[3cqw]"
        />
        <div className="flex w-full flex-1 flex-col justify-center gap-6 px-6 py-12 md:w-1/2 md:gap-[2cqw] md:px-[4cqw] md:py-0">
          <h2 className={`${HEAD} text-center text-3xl md:text-left md:text-[4.8cqw]`}>
            AUDIENCE
            <br className="hidden md:block" /> PRIORITIZATION
          </h2>
          <div className="space-y-4 md:space-y-[1.2cqw]">
            {[
              { label: "Primary Audience", key: "primary" },
              { label: "Secondary Audience", key: "secondary" },
              { label: "Behavioral Audience", key: "behavioral" },
              { label: "Growth Audience", key: "growth" },
            ].map(({ label, key }) =>
              (slide.texts[key] || "").trim() || editable ? (
                <div key={key}>
                  <h3 className="text-lg font-black text-neutral-900 md:text-[1.6cqw]">{label}</h3>
                  <div className="text-sm text-neutral-700 md:text-[1.3cqw]">
                    <EditableText
                      value={slide.texts[key] || ""}
                      onChange={(v) => updateText(key, v)}
                      as="p"
                      className="text-inherit"
                      scale={fs}
                      editable={editable}
                    />
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
    )
  },

  /* ────────────── 08 · CUSTOMER FLOW JOURNEY ────────────── */
  flow: ({ slide, editable, updateText, editImage, editImage2 }) => {
    const fs = slide.fontScale ?? 1
    const rawSteps = (slide.texts.steps || "").split("\n").map((s) => s.trim()).filter(Boolean)
    return (
      <div className="flex h-full min-h-full w-full flex-col bg-neutral-900 md:flex-row">
        {/* Secondary media — left image, equal width to the right (source framing). */}
        <SlideImage
          src={slide.image2 || defaultImages.flowRight}
          kind={slide.image2 ? slide.image2Kind : "image"}
          position={slide.image2Position}
          editable={editable}
          onEdit={editImage2}
          className="hidden shrink-0 md:block md:w-[22%]"
        />
        <div className="z-10 flex min-h-0 w-full flex-1 flex-col justify-center bg-[#F8F9FA] px-6 py-12 text-center shadow-2xl md:px-[4cqw] md:py-[2cqw]">
          <h2 className={`${HEAD} mb-8 text-4xl md:mb-[1.5cqw] md:text-[4.5cqw]`}>
            CUSTOMER
            <br />
            FLOW
            <br />
            JOURNEY
          </h2>
          {rawSteps.length > 0 && !editable ? (
            <div className="space-y-4 text-base md:space-y-[0.7cqw] md:text-[1.2cqw] md:leading-tight">
              {rawSteps.map((step, i) => (
                <div key={i}>
                  <span className="font-bold text-neutral-900">Step {i + 1}</span>
                  <br />
                  <span className="text-neutral-700">{step.replace(/^Step\s*\d+[:.]\s*/i, "")}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 text-base md:space-y-[0.7cqw] md:text-[1.2cqw] md:leading-tight">
              <EditableText
                value={slide.texts.steps || ""}
                onChange={(v) => updateText("steps", v)}
                as="p"
                className="whitespace-pre-wrap"
                scale={fs}
                editable={editable}
              />
            </div>
          )}
        </div>
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 md:h-full md:min-h-0 md:w-[22%]"
        />
      </div>
    )
  },

  /* ────────────── 09 · SUCCESS STORIES ────────────── */
  success: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="flex h-full min-h-full w-full flex-col bg-[#F8F9FA] md:flex-row">
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 md:h-full md:min-h-0 md:w-1/2"
        />
        <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 md:w-1/2 md:px-[4cqw] md:py-0">
          <h2 className={`${HEAD} mb-4 text-4xl md:mb-[1.4cqw] md:text-[6.5cqw]`}>
            SUCCESS
            <br />
            STORIES
          </h2>
          <div className="mb-4 inline-block self-start border-b-2 border-neutral-900 pb-1 text-base font-bold text-neutral-800 md:mb-[1.6cqw] md:pb-[0.3cqw] md:text-[1.5cqw]">
            <EditableText
              value={slide.texts.title || ""}
              onChange={(v) => updateText("title", v)}
              as="p"
              className="text-inherit"
              scale={fs}
              editable={editable}
            />
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-800 md:space-y-[0.8cqw] md:pl-[1.4cqw] md:text-[1.25cqw]">
            {(["stat1", "stat2", "stat3"] as const).map((key) =>
              (slide.texts[key] || "").trim() || editable ? (
                <li key={key} className="font-bold text-neutral-900">
                  <EditableText value={slide.texts[key] || ""} onChange={(v) => updateText(key, v)} as="span" className="inline-block" scale={fs} editable={editable} />
                </li>
              ) : null,
            )}
            <li>
              <span className="font-bold">Challenge:</span>{" "}
              <EditableText value={slide.texts.challenge || ""} onChange={(v) => updateText("challenge", v)} as="span" className="inline-block" scale={fs} editable={editable} />
            </li>
            <li>
              <span className="font-bold">Solution:</span>{" "}
              <EditableText value={slide.texts.solution || ""} onChange={(v) => updateText("solution", v)} as="span" className="inline-block" scale={fs} editable={editable} />
            </li>
            <li>
              <span className="font-bold">Outcome:</span>{" "}
              <EditableText value={slide.texts.outcome || ""} onChange={(v) => updateText("outcome", v)} as="span" className="inline-block" scale={fs} editable={editable} />
            </li>
          </ul>
        </div>
      </div>
    )
  },

  /* ────────────── 10 · WHAT SUCCESS LOOKS LIKE ────────────── */
  metrics: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    return (
      <div className="flex h-full min-h-full w-full flex-col-reverse items-center bg-[#F8F9FA] md:flex-row">
        <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 md:w-3/5 md:px-[4cqw] md:pr-[3cqw] md:py-0">
          <h2 className={`${HEAD} mb-6 text-center text-4xl md:mb-[2.5cqw] md:text-left md:text-[5.5cqw]`}>
            WHAT
            <br />
            SUCCESS
            <br />
            LOOKS LIKE
          </h2>
          <div className="grid grid-cols-1 gap-6 text-sm text-neutral-800 sm:grid-cols-2 md:gap-x-[2cqw] md:gap-y-[1.6cqw] md:text-[1.3cqw]">
            {[
              { label: "Marketing Metrics", key: "marketing" },
              { label: "Business Metrics", key: "business" },
              { label: "Executive Metrics", key: "executive" },
            ].map(({ label, key }) => (
              <div key={key}>
                <h3 className="mb-2 inline-block border-b-2 border-neutral-900 pb-1 font-bold text-neutral-900 md:mb-[0.6cqw] md:pb-[0.2cqw]">
                  {label}
                </h3>
                <BulletList
                  value={slide.texts[key] || ""}
                  onChange={(v) => updateText(key, v)}
                  editable={editable}
                  scale={fs}
                  ulClassName="space-y-1 pl-5 md:space-y-[0.3cqw] md:pl-[1.4cqw]"
                />
              </div>
            ))}
          </div>
        </div>
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 shadow-2xl md:h-[80%] md:min-h-0 md:w-2/5"
        />
      </div>
    )
  },

  /* ────────────── 11 · RECOMMENDED ENGAGEMENT ────────────── */
  engagement: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    const splitLines = (text: string) =>
      text.split("\n").map((l) => l.replace(/^[•\-–—]\s*/, "").trim()).filter(Boolean)
    return (
      <div className="flex h-full min-h-full w-full flex-col bg-[#F8F9FA] md:flex-row">
        <SlideImage
          src={imageFor(slide)}
          kind={slide.imageKind}
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 md:h-full md:min-h-0 md:w-1/2"
        />
        <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 md:w-1/2 md:px-[4cqw] md:py-0">
          <h2 className={`${HEAD} mb-6 text-4xl md:mb-[2.5cqw] md:text-[5cqw]`}>
            RECOMMENDED
            <br />
            ENGAGEMENT
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 md:gap-x-[2.5cqw] md:gap-y-[2cqw]">
            {[
              { label: "Strategy", key: "strategy" },
              { label: "Acquisition", key: "acquisition" },
              { label: "Optimization", key: "optimization" },
            ].map(({ label, key }) => {
              const items = splitLines(slide.texts[key] || "")
              return (
                <div key={key}>
                  <h3 className="mb-2 inline-block border-b-2 border-neutral-900 pb-1 text-lg font-black text-neutral-900 md:mb-[0.6cqw] md:pb-[0.2cqw] md:text-[1.6cqw]">
                    {label}
                  </h3>
                  {items.length > 0 && !editable ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700 marker:text-neutral-900 md:space-y-[0.4cqw] md:pl-[1.4cqw] md:text-[1.25cqw]">
                      {items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <EditableText value={slide.texts[key] || ""} onChange={(v) => updateText(key, v)} as="p" className="whitespace-pre-wrap text-sm text-neutral-700 md:text-[1.25cqw]" scale={fs} editable={editable} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  },

  /* ────────────── 12 · NEXT STEPS ────────────── */
  nextsteps: ({ slide, editable, updateText }) => {
    const fs = slide.fontScale ?? 1
    const steps = [
      { titleKey: "step1_title", subKey: "step1_sub" },
      { titleKey: "step2_title", subKey: "step2_sub" },
      { titleKey: "step3_title", subKey: "step3_sub" },
      { titleKey: "step4_title", subKey: "step4_sub" },
    ]
    const shownSteps = editable
      ? steps
      : steps.filter((s) => (slide.texts[s.titleKey] || "").trim() || (slide.texts[s.subKey] || "").trim())
    return (
      <div className="relative flex h-full min-h-full w-full flex-col items-center justify-center overflow-hidden bg-white px-6 py-12 md:flex-row md:px-[4cqw] md:py-0">
        <CustomImageBackground src={slide.image} position={slide.imagePosition} kind={slide.imageKind} />
        <div className="relative z-10 flex w-full flex-col justify-center md:w-2/5 md:pr-[2cqw]">
          <h2 className={`${HEAD} mb-8 text-center text-4xl md:mb-[2.5cqw] md:text-left md:text-[6cqw]`}>
            NEXT STEPS
          </h2>
          {/* Ascending staircase — contiguous blocks rising to the right. */}
          <div className="flex aspect-[4/3] w-full max-w-[300px] self-center items-end justify-center overflow-hidden rounded-2xl bg-neutral-50 shadow-inner md:max-w-none md:rounded-[2cqw]">
            <div className="flex h-full w-full items-end">
              {["h-[20%]", "h-[40%]", "h-[60%]", "h-[80%]", "h-full"].map((h, i) => (
                <div key={i} className={`w-1/5 ${h}`} style={{ background: `hsl(0 0% ${74 - i * 12}%)` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-12 flex w-full flex-col items-center justify-center text-center md:mt-0 md:w-3/5">
          <div className="flex w-full flex-col items-center space-y-4 md:space-y-[0.5cqw]">
            {shownSteps.map((step, i) => (
              <div key={step.titleKey} className="flex flex-col items-center">
                <EditableText
                  value={slide.texts[step.titleKey] || ""}
                  onChange={(v) => updateText(step.titleKey, v)}
                  as="h3"
                  className="text-lg font-bold text-neutral-900 md:text-[1.6cqw]"
                  scale={fs}
                  editable={editable}
                />
                <div className="text-sm text-neutral-600 md:text-[1.2cqw]">
                  <EditableText
                    value={slide.texts[step.subKey] || ""}
                    onChange={(v) => updateText(step.subKey, v)}
                    as="p"
                    className="text-inherit"
                    scale={fs}
                    editable={editable}
                  />
                </div>
                {i < shownSteps.length - 1 && (
                  <span className="my-1 text-xl font-bold text-neutral-400 md:my-[0.2cqw] md:text-[1.4cqw]">↓</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex w-full max-w-[80vw] flex-col items-center border-t-2 border-neutral-900 pt-6 md:mt-[2cqw] md:max-w-[50cqw] md:pt-[1.4cqw]">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500 md:mb-[0.4cqw] md:text-[1.1cqw]">
              Closing Statement
            </p>
            <div className="mt-2 text-base font-medium leading-relaxed text-neutral-900 md:mt-[0.4cqw] md:text-[1.4cqw]">
              <EditableText
                value={slide.texts.closing || ""}
                onChange={(v) => updateText("closing", v)}
                as="p"
                className="text-inherit"
                scale={fs}
                editable={editable}
              />
            </div>
          </div>
        </div>
      </div>
    )
  },
}

/* ================================================================== */
/*  Slide builder — single source of truth                             */
/* ================================================================== */

export interface BuiltSlide {
  instance_id: string
  type: SlideType
  node: ReactNode
}

export interface BuildSlidesOptions {
  /** When true, text fields become click-to-edit and images show a picker affordance. */
  editable?: boolean
  /** Fired when a text field changes (editable only). */
  onTextChange?: (instanceId: string, key: string, value: string) => void
  /** Fired when a slide's media is clicked (editable only) — editor opens the Asset picker. */
  onImageEdit?: (instanceId: string, slot: "image" | "image2") => void
}

/**
 * Render an ordered list of deck slides, each by its `type`. The output preserves
 * array order, so add / reorder / remove happen upstream on the DeckSlide[].
 */
export function buildSlides(
  slides: DeckSlide[],
  opts: BuildSlidesOptions = {},
): BuiltSlide[] {
  const editable = opts.editable ?? false
  return slides.map((slide) => ({
    instance_id: slide.instance_id,
    type: slide.type,
    node: RENDERERS[slide.type]({
      slide,
      editable,
      updateText: (key, val) => opts.onTextChange?.(slide.instance_id, key, val),
      editImage: () => opts.onImageEdit?.(slide.instance_id, "image"),
      editImage2: () => opts.onImageEdit?.(slide.instance_id, "image2"),
    }),
  }))
}
