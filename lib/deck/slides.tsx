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

/** Grayscale photo panel with stripe fallback when the image fails or is absent. */
export function Photo({
  src,
  className = "",
  position,
}: {
  src?: string
  className?: string
  position?: { x: number; y: number }
}) {
  const [errored, setErrored] = useState(false)
  return (
    <div className={`relative overflow-hidden bg-neutral-300 ${className}`}>
      {src && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover grayscale"
          style={{ objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }}
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
}: {
  src?: string
  position?: { x: number; y: number }
}) {
  if (!src) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-30">
      <Photo src={src} position={position} className="h-full w-full" />
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
}: {
  src?: string
  position?: { x: number; y: number }
  className?: string
  editable?: boolean
  onEdit?: () => void
}) {
  if (!editable) return <Photo src={src} position={position} className={className} />
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
      <Photo src={src} position={position} className="h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white">
          Change image
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

/* ================================================================== */
/*  Per-type slide renderers                                            */
/* ================================================================== */

interface SlideCtx {
  slide: DeckSlide
  editable: boolean
  /** Update one text field on this slide. */
  updateText: (key: string, val: string) => void
  /** Open the image picker for this slide (editor-provided). */
  editImage: () => void
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
        <CustomImageBackground src={slide.image} position={slide.imagePosition} />
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
                <EditableText
                  value={slide.texts[col.key] || ""}
                  onChange={(v) => updateText(col.key, v)}
                  as="p"
                  className="whitespace-pre-wrap"
                  scale={fs}
                  editable={editable}
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
            <EditableText
              value={slide.texts.bullets || ""}
              onChange={(v) => updateText("bullets", v)}
              as="p"
              className="whitespace-pre-wrap"
              scale={fs}
              editable={editable}
            />
          </div>
        </div>
        <SlideImage
          src={imageFor(slide)}
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
        <CustomImageBackground src={slide.image} position={slide.imagePosition} />
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
          <div className="h-[50vw] w-[50vw] max-h-[220px] max-w-[220px] animate-[spin_22s_linear_infinite] rounded-full border-[0.5cqw] border-dashed border-neutral-300 md:h-[16cqw] md:w-[16cqw] md:max-h-none md:max-w-none" />
        </div>
      </div>
    )
  },

  /* ────────────── 05 · MARKETING PLAN ────────────── */
  plan: ({ slide, editable, updateText }) => {
    const fs = slide.fontScale ?? 1
    const channels = (slide.texts.channels || "").split(/[,\n]/).map((c) => c.trim()).filter(Boolean)
    const budget = slide.texts.budget || ""
    const geography = slide.texts.geography || ""
    const audience = slide.texts.audience || ""
    return (
      <div className="relative flex h-full min-h-full w-full flex-col items-center justify-center overflow-hidden bg-white py-12 md:flex-row md:py-0">
        <CustomImageBackground src={slide.image} position={slide.imagePosition} />
        <div className="relative z-10 mb-8 flex w-full flex-col justify-center px-6 text-center md:mb-0 md:h-full md:w-[44%] md:px-[4cqw] md:text-left">
          <h2 className={`${HEAD} text-4xl md:text-[5.5cqw]`}>
            RECOMMENDED
            <br className="hidden md:block" /> MARKETING
            <br className="hidden md:block" /> PLAN
          </h2>
          <div className="mt-2 space-y-1 text-sm text-neutral-600 md:mt-[1cqw] md:text-[1.3cqw]">
            {budget && (
              <p>
                Budget:{" "}
                <EditableText value={budget} onChange={(v) => updateText("budget", v)} as="span" className="inline font-bold text-neutral-900" scale={fs} editable={editable} />
              </p>
            )}
            {geography && (
              <p>
                Geography:{" "}
                <EditableText value={geography} onChange={(v) => updateText("geography", v)} as="span" className="inline font-bold text-neutral-900" scale={fs} editable={editable} />
              </p>
            )}
          </div>
        </div>
        <div className="relative z-10 flex w-full flex-col justify-center gap-6 px-6 md:w-[56%] md:gap-[2cqw] md:px-[4cqw]">
          {channels.length > 0 ? (
            <div>
              <h3 className="text-xl font-black text-neutral-900 md:text-[1.7cqw]">Media Channels</h3>
              <ul className="mt-1 grid grid-cols-1 gap-y-1 pl-4 text-sm text-neutral-800 md:mt-[0.4cqw] md:gap-y-[0.3cqw] md:pl-[1.2cqw] md:text-[1.25cqw]">
                {channels.map((c, i) => (
                  <li key={i} className="list-disc">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-black text-neutral-900 md:text-[1.7cqw]">Media Mix</h3>
              <EditableText value={slide.texts.channels || ""} onChange={(v) => updateText("channels", v)} as="p" className="mt-1 text-sm text-neutral-700 md:text-[1.25cqw]" scale={fs} editable={editable} />
            </div>
          )}
          {audience && (
            <div>
              <h3 className="text-xl font-black text-neutral-900 md:text-[1.7cqw]">Target Audience</h3>
              <EditableText
                value={audience}
                onChange={(v) => updateText("audience", v)}
                as="p"
                className="mt-1 text-sm text-neutral-700 md:text-[1.25cqw]"
                scale={fs}
                editable={editable}
              />
            </div>
          )}
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
          <div className="space-y-4 md:space-y-[1.4cqw]">
            {[
              { label: "Primary Audience", key: "primary" },
              { label: "Geography", key: "geography" },
              { label: "Additional Notes", key: "notes" },
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
  flow: ({ slide, editable, updateText, editImage }) => {
    const fs = slide.fontScale ?? 1
    const rawSteps = (slide.texts.steps || "").split("\n").map((s) => s.trim()).filter(Boolean)
    return (
      <div className="flex h-full min-h-full w-full flex-col bg-neutral-900 md:flex-row">
        <div className="z-10 flex min-h-0 w-full flex-1 flex-col justify-center bg-[#F8F9FA] px-6 py-12 shadow-2xl md:w-1/2 md:px-[4cqw] md:py-[2cqw]">
          <h2 className={`${HEAD} mb-8 text-center text-4xl md:mb-[1.5cqw] md:text-left md:text-[4.5cqw]`}>
            CUSTOMER
            <br />
            FLOW
            <br />
            JOURNEY
          </h2>
          {rawSteps.length > 0 && !editable ? (
            <div className="space-y-4 text-center text-base md:space-y-[0.65cqw] md:text-left md:text-[1.15cqw] md:leading-tight">
              {rawSteps.map((step, i) => (
                <div key={i}>
                  <span className="font-bold text-neutral-900">Step {i + 1}</span>
                  <br />
                  <span className="text-neutral-700">{step.replace(/^Step\s*\d+[:.]\s*/i, "")}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 text-center text-base md:space-y-[0.65cqw] md:text-left md:text-[1.15cqw] md:leading-tight">
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
          position={slide.imagePosition}
          editable={editable}
          onEdit={editImage}
          className="h-[40vh] min-h-[40vh] w-full shrink-0 md:h-full md:min-h-0 md:w-1/2"
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
          <div className="grid grid-cols-1 gap-6 text-sm text-neutral-800 sm:grid-cols-2 md:gap-[2cqw] md:text-[1.3cqw]">
            <div>
              <h3 className="mb-2 inline-block border-b-2 border-neutral-900 pb-1 font-bold text-neutral-900 md:mb-[0.6cqw] md:pb-[0.2cqw]">
                Performance KPIs
              </h3>
              <ul className="list-disc space-y-1 pl-5 md:space-y-[0.3cqw] md:pl-[1.4cqw]">
                {["kpi1", "kpi2", "kpi3"].map((key) =>
                  (slide.texts[key] || "").trim() || editable ? (
                    <li key={key}>
                      <EditableText value={slide.texts[key] || ""} onChange={(v) => updateText(key, v)} as="span" className="inline" scale={fs} editable={editable} />
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 inline-block border-b-2 border-neutral-900 pb-1 font-bold text-neutral-900 md:mb-[0.6cqw] md:pb-[0.2cqw]">
                Investment Summary
              </h3>
              <ul className="list-disc space-y-1 pl-5 md:space-y-[0.3cqw] md:pl-[1.4cqw]">
                {((slide.texts.budget || "").trim() || editable) && (
                  <li>
                    Budget:{" "}
                    <EditableText value={slide.texts.budget || ""} onChange={(v) => updateText("budget", v)} as="span" className="inline font-bold" scale={fs} editable={editable} />
                  </li>
                )}
                {((slide.texts.channels || "").trim() || editable) && (
                  <li>
                    Channels:{" "}
                    <EditableText value={slide.texts.channels || ""} onChange={(v) => updateText("channels", v)} as="span" className="inline font-bold" scale={fs} editable={editable} />
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <SlideImage
          src={imageFor(slide)}
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
    const steps = editable
      ? [slide.texts.step1 ?? "", slide.texts.step2 ?? "", slide.texts.step3 ?? ""]
      : [slide.texts.step1 || "", slide.texts.step2 || "", slide.texts.step3 || ""].filter(Boolean)
    return (
      <div className="relative flex h-full min-h-full w-full flex-col items-center justify-center overflow-hidden bg-white px-6 py-12 md:flex-row md:px-[4cqw] md:py-0">
        <CustomImageBackground src={slide.image} position={slide.imagePosition} />
        <div className="relative z-10 flex w-full flex-col justify-center md:w-2/5 md:pr-[2cqw]">
          <h2 className={`${HEAD} mb-8 text-center text-4xl md:mb-[2.5cqw] md:text-left md:text-[6cqw]`}>
            NEXT STEPS
          </h2>
          <div className="flex aspect-[4/3] w-full max-w-[300px] self-center items-end justify-center rounded-2xl bg-neutral-50 shadow-inner md:max-w-none md:rounded-[2cqw]">
            <div className="flex h-full items-end justify-center gap-2 pb-6 md:gap-[1cqw] md:pb-[3cqw]">
              {["h-[18%]", "h-[34%]", "h-[52%]", "h-[70%]", "h-[88%]"].map((h, i) => (
                <div key={i} className={`w-3 md:w-[3cqw] ${h} shadow-md`} style={{ background: `hsl(0 0% ${60 - i * 12}%)` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="relative z-10 mt-12 flex w-full flex-col items-center justify-center text-center md:mt-0 md:w-3/5">
          <div className="flex w-full flex-col items-center space-y-4 md:space-y-[0.6cqw]">
            {steps.map((stepText, i) => (
              <div key={i} className="flex flex-col items-center">
                <EditableText
                  value={stepText}
                  onChange={(v) => updateText(`step${i + 1}`, v)}
                  as="h3"
                  className="text-lg font-bold text-neutral-900 md:text-[1.6cqw]"
                  scale={fs}
                  editable={editable}
                />
                {i < steps.length - 1 && (
                  <span className="my-2 text-xl font-bold text-neutral-400 md:my-[0.3cqw] md:text-[1.5cqw]">↓</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex w-full max-w-[80vw] flex-col items-center border-t-2 border-neutral-900 pt-6 md:mt-[2.5cqw] md:max-w-[50cqw] md:pt-[1.6cqw]">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500 md:mb-[0.5cqw] md:text-[1.1cqw]">
              Closing Statement
            </p>
            <div className="mt-2 text-base font-medium leading-relaxed text-neutral-900 md:mt-[0.5cqw] md:text-[1.4cqw]">
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
  /** Fired when a slide's image is clicked (editable only) — editor opens the Asset picker. */
  onImageEdit?: (instanceId: string) => void
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
      editImage: () => opts.onImageEdit?.(slide.instance_id),
    }),
  }))
}
