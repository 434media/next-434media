"use client"

/**
 * Work page — approved design Revision 12.
 *
 * Source: 434-context `08 Work Page/source/`, manifest verified 40 of 40.
 * Checked against visual system v1.2 in that folder's `COMPLIANCE.md`, which
 * also lists seven questions for the design thread. **Those are not resolved
 * here.** Two of them are conflicts with Display and Design Standard v1.6 —
 * the tile aspect ratio and the detail view's order — and this component
 * implements the approved design, which is what it was asked to do, while the
 * conflict stays reported rather than quietly settled either way.
 *
 * The record loader is unchanged: records arrive from `getWorkPageRecords`,
 * which reads `portfolio_records` and falls back to the generated extract.
 * Published filtering, ordering, public copy and the three commercial models
 * all still come from canon. Nothing about the data source moves for a visual
 * redesign.
 *
 * Media: the ten reference stills shipped with the handoff. Five published
 * records have none — Salute to Troops, AMPD Project, MilCityUSA, OVERDRIVE
 * and VelocityTX Demo Day. They render as the design specifies: a solid black
 * card with a white title. That is the design's own answer to missing
 * artwork, not a placeholder invented here, and no record is dropped to hide
 * the gap.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { ArrowUpRight, X } from "lucide-react"
import type { WorkRecord } from "@/lib/work-records"
import { BRAND_RECORDS } from "@/lib/brand-records"
import styles from "./work-redesign.module.css"

/**
 * The three commercial models, in the order the design fixes, with the
 * definitions verbatim from master Section 4.3.
 *
 * The page previously carried longer sublines that embellished these. The
 * approved reference uses the master's own wording and so does this.
 */
const SECTIONS = [
  {
    model: "Original IP",
    label: "01 / Original IP",
    definition: "Media properties and original productions owned by 434 MEDIA.",
  },
  {
    model: "Platforms for Brands",
    label: "02 / Platforms for Brands",
    definition:
      "Integrated, multi-part programs or properties developed or produced for a client.",
  },
  {
    model: "Productions for Brands",
    label: "03 / Productions for Brands",
    definition: "Defined content or live-experience engagements produced for a client.",
  },
] as const

/**
 * Stills and video, keyed by record key.
 *
 * Two crops per still, art-directed rather than resized: 16:9 at and above
 * 680px, 4:5 below, each with its own focal point. A single image scaled to
 * both would put the subject in the wrong place at one of them, which is why
 * `<picture>` is used here instead of next/image - next/image resizes, it does
 * not art-direct.
 *
 * `video` is the detail-view file, which keeps its audio. The audio-free card
 * previews exist as assets but are deliberately not wired to autoplay: the
 * approved design says no video requests before user activation.
 */
const ASSETS: Record<string, { still?: boolean; video?: string }> = {
  "alamo-angels": { still: true },
  "ampd-project": { still: true },
  "milcityusa": { still: true },
  "mission-road-soar": { still: true },
  "nucleate-global-summit": { still: true },
  "overdrive": { still: true },
  "rise-of-a-champion": { still: true },
  "salute-to-troops": { still: true },
  "velocitytx-demo-day": { still: true },
  "vemosvamos": { still: true, video: "vemosvamos-1080p" },
  "aim-health-summit": { still: true },
  "que-es-sdoh": { still: true },
  "techbloc-tech-day": { still: true },
  "txmx-boxing": { still: true },
  "univision-70th": { still: true },
}

// Only VemosVamos ships its video here, and only because it is the edit with a
// specified cut - 46s, picture and audio fading together from 42s, ending on
// black - so it is the one worth seeing in a preview. At 9.6 MB it is also the
// only one small enough to belong in a repository.
//
// The other eight are encoded and waiting on hosting, not on work: 657 MB in
// total against a 30 MB repository. They go where the hero video goes, and the
// `video` key here is filled in per record as each one lands. Until then a
// record with no entry opens on its still, which is the supported state.


const stillsFor = (r: WorkRecord) => {
  const k = r.recordKey
  if (!k || !ASSETS[k]?.still) return null
  return { wide: `/work/stills/${k}-wide.jpg`, compact: `/work/stills/${k}-compact.jpg` }
}
const videoFor = (r: WorkRecord) => {
  const k = r.recordKey
  const v = k ? ASSETS[k]?.video : undefined
  return v ? `/work/video/${v}.mp4` : null
}


function Card({
  record,
  onOpen,
  priority,
}: {
  record: WorkRecord
  onOpen: (r: WorkRecord) => void
  priority: boolean
}) {
  const stills = stillsFor(record)
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onOpen(record)}
      aria-haspopup="dialog"
    >
      {stills ? (
        <>
          <picture>
            <source media="(min-width: 680px)" srcSet={stills.wide} />
            <img
              src={stills.compact}
              alt=""
              className={styles.cardImage}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
            />
          </picture>
          <span className={styles.cardScrim} aria-hidden="true" />
        </>
      ) : null}
      <h3 className={styles.cardTitle}>{record.title}</h3>
      <ArrowUpRight className={styles.cardCorner} aria-hidden="true" />
    </button>
  )
}

function Detail({ record, onClose }: { record: WorkRecord; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const stills = stillsFor(record)
  const video = videoFor(record)

  // Escape closes, focus is contained, body scrolling locks, and focus returns
  // to the card that opened this — handled by the caller, which holds the
  // trigger.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key !== "Tab" || !ref.current) return
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className={styles.dialogClose}
          onClick={onClose}
          aria-label="Close"
          autoFocus
        >
          <X aria-hidden="true" size={20} />
        </button>

        <div className={styles.dialogHero}>
          {/* Media leads, per Display and Design Standard 1.7. Video where the
              record has one, still otherwise, and a record with neither opens
              on the title card rather than an empty frame.

              preload="none" and an explicit poster: the design forbids video
              requests before user activation, so nothing is fetched until the
              visitor presses play. */}
          {video ? (
            <video
              className={styles.dialogHeroImage}
              controls
              preload="none"
              playsInline
              poster={stills?.wide}
            >
              <source src={video} type="video/mp4" />
            </video>
          ) : stills ? (
            <>
              <picture>
                <source media="(min-width: 680px)" srcSet={stills.wide} />
                <img src={stills.compact} alt="" className={styles.dialogHeroImage} decoding="async" />
              </picture>
              <span className={styles.cardScrim} aria-hidden="true" />
            </>
          ) : null}
          {video ? null : (
            <div className={styles.dialogHeroCaption}>
              <p className="t-label">{record.model}</p>
              <h2 id={titleId}>{record.title}</h2>
            </div>
          )}
        </div>
        {video ? (
          <div className={styles.dialogBody} style={{ paddingBottom: 0 }}>
            <p className="t-label">{record.model}</p>
            <h2 id={titleId} className={styles.dialogHeroCaptionTitle}>{record.title}</h2>
          </div>
        ) : null}

        {/* Attribution beneath the hero. Absent fields are omitted rather than
            rendered empty, and a null client is never read as 434 ownership. */}
        <div className={styles.dialogBody}>
          {record.client ? (
            <div className={styles.dialogRow}>
              <p className="t-label">Client or partner</p>
              <p className="t-body">{record.client}</p>
            </div>
          ) : null}
          {record.role ? (
            <div className={styles.dialogRow}>
              <p className="t-label">434 MEDIA role</p>
              <p className="t-body">{record.role}</p>
            </div>
          ) : null}
          {record.founderCredit ? (
            <div className={styles.dialogRow}>
              <p className="t-label">Founder credit</p>
              <p className="t-body">{record.founderCredit}</p>
            </div>
          ) : null}
          {record.description ? <p className="t-body-l">{record.description}</p> : null}
          {record.collaboratorCredit ? (
            <div className={styles.dialogRow}>
              <p className="t-label">Collaborator credit</p>
              <p className="t-body">{record.collaboratorCredit}</p>
            </div>
          ) : null}
          {record.publicUrl ? (
            <a
              className="t-control-emphasis"
              href={record.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit {record.title}
              <ArrowUpRight aria-hidden="true" size={16} style={{ display: "inline", marginLeft: 6 }} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function WorkRedesign({ records }: { records: readonly WorkRecord[] }) {
  const [open, setOpen] = useState<WorkRecord | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const grouped = useMemo(
    () =>
      SECTIONS.map((s) => ({
        ...s,
        items: records.filter((r) => r.model === s.model),
      })),
    [records],
  )

  const onOpen = useCallback((r: WorkRecord) => {
    triggerRef.current = document.activeElement as HTMLElement | null
    setOpen(r)
  }, [])

  const onClose = useCallback(() => {
    setOpen(null)
    triggerRef.current?.focus()
  }, [])

  // Left/Right scrolls a focused rail by one card.
  const onRailKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    const rail = e.currentTarget
    const card = rail.querySelector<HTMLElement>(`.${styles.card}`)
    const step = card ? card.getBoundingClientRect().width + 12 : rail.clientWidth * 0.9
    e.preventDefault()
    rail.scrollBy({ left: e.key === "ArrowRight" ? step : -step, behavior: "smooth" })
  }

  return (
    <main className={styles.page}>
      <header className={styles.opening}>
        <h1 className={styles.openingTitle}>The work.</h1>
        <p className={styles.openingIntro}>{BRAND_RECORDS.canonicalDefinition}</p>
      </header>

      {grouped.map((section, si) => (
        <section key={section.model} className={styles.section} aria-label={section.label}>
          <div className={styles.serviceHeader}>
            <h2 className={styles.serviceLabel}>{section.label}</h2>
            <p className={styles.serviceDefinition}>{section.definition}</p>
          </div>

          <div
            className={styles.rail}
            role="group"
            aria-label={`${section.model} — use left and right arrows to scroll`}
            tabIndex={0}
            onKeyDown={onRailKey}
          >
            {section.items.map((record, i) => (
              <Card
                key={record.recordKey ?? record.title}
                record={record}
                onOpen={onOpen}
                priority={si === 0 && i === 0}
              />
            ))}
          </div>
        </section>
      ))}

      {open ? <Detail record={open} onClose={onClose} /> : null}
    </main>
  )
}
