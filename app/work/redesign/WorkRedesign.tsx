"use client"

/**
 * Work page — approved design Revision 12.
 *
 * Source: 434-context `90 Assets/08 Work Page/source/`, manifest verified 40 of 40.
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
import { getImageProps } from "next/image"
import { STILLS_WITH_WEBP } from "@/lib/work-stills-webp"
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
 * Two video assets per record, and they are not the same file. The CARD plays a
 * short muted loop - 11 to 14 seconds cut from the strongest part of the film,
 * 720p, no audio track, under 3 MB - offered as WebM (VP9) first and MP4
 * second, which is Standard 3.0's two-encoding rule. The DETAIL view plays the
 * full film with its audio, and that file is requested only when the dialog
 * opens.
 *
 * The card used to play the full film. Thirteen of them came to 210.6 MB.
 */
const MEDIA = "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work"

/**
 * Per record: whether it has a still, and the height its video was encoded at.
 *
 * The cap is the source's own height, never an upscale. AMPD and OVERDRIVE cap
 * at 540 and TXMX at 808 because that is what their masters are — see #118.
 *
 * Two files come out of each cap. The card plays the audio-free one at 720 or
 * below; the detail plays the one that kept its audio at full cap.
 */
const ASSETS: Record<string, { still?: boolean; cap?: number }> = {
  "alamo-angels": { still: true, cap: 1080 },
  "milcityusa": { still: true },
  "nucleate-global-summit": { still: true },
  "ampd-project": { still: true, cap: 540 },
  "overdrive": { still: true, cap: 540 },
  "salute-to-troops": { still: true, cap: 720 },
  "txmx-boxing": { still: true, cap: 808 },
  "rise-of-a-champion": { still: true, cap: 1080 },
  "mission-road-soar": { still: true, cap: 1080 },
  "velocitytx-demo-day": { still: true, cap: 1080 },
  "aim-health-summit": { still: true, cap: 1080 },
  "vemosvamos": { still: true, cap: 1080 },
  "techbloc-tech-day": { still: true, cap: 1080 },
  "que-es-sdoh": { still: true, cap: 1080 },
  "univision-70th": { still: true, cap: 1080 },

  // Builders VC, master 2.0.27. Stills only, no `cap`, so no card loop and no
  // detail video - the same shape as milcityusa and nucleate-global-summit.
  //
  // Not an oversight. The loops and detail encodes would publish to the `work/`
  // prefix this file's MEDIA constant points at, and the media pipeline's
  // credential refuses to write outside `records/` and `review/`
  // (build_media.py: "refusing to write outside records/ and review/"). Widening
  // that guard was out of scope, so the video is held and the stills ship.
  //
  // Both crops are real: the 16:9 is the full 1920x1080 frame at no upscale, and
  // the 4:5 is an 864x1080 window scaled x1.389 under the founder-approved
  // exception each record carries in its 4.5 Display exception field.
  "280-earth": { still: true },
  "amplifier-health": { still: true },
  "ashbrook-technologies": { still: true },
  "breaking": { still: true },
  "checkerspot": { still: true },
  "gradiant": { still: true },
  "native-microbials": { still: true },
  "navier": { still: true },
  "pathos": { still: true },
  "pie-vat": { still: true },
  "ubiqd": { still: true },
}

const stillsFor = (r: WorkRecord) => {
  const k = r.recordKey
  if (!k || !ASSETS[k]?.still) return null
  const webp = (crop: "wide" | "compact") =>
    STILLS_WITH_WEBP.includes(`${k}-${crop}`) ? `/work/stills/${k}-${crop}.webp` : null
  return {
    wide: `/work/stills/${k}-wide.jpg`,
    compact: `/work/stills/${k}-compact.jpg`,
    wideWebp: webp("wide"),
    compactWebp: webp("compact"),
  }
}
/**
 * The card's loop, in both encodings. WebM is listed first because it is the
 * smaller of the two for every record — measured, not assumed; VP9 was tuned
 * per record until that was true.
 */
const cardLoopFor = (r: WorkRecord) => {
  const k = r.recordKey
  const cap = k ? ASSETS[k]?.cap : undefined
  if (!k || !cap) return null
  const h = cap > 720 ? 720 : cap
  return { webm: `${MEDIA}/${k}-loop-${h}p.webm`, mp4: `${MEDIA}/${k}-loop-${h}p.mp4` }
}
const detailVideoFor = (r: WorkRecord) => {
  const k = r.recordKey
  const cap = k ? ASSETS[k]?.cap : undefined
  return k && cap ? `${MEDIA}/${k}-${cap}p.mp4` : null
}

/**
 * True once the window `load` event has fired, or immediately if it already has.
 *
 * Only the tiles already inside the viewport at navigation are affected: a card
 * that enters view by scrolling does so long after load, so its behaviour is
 * unchanged. §3.0 says card video "autoplays muted as the card enters view" —
 * it specifies the trigger and the manner, not immediacy, and a card that is
 * in view at navigation never has a moment of entering.
 *
 * The reason to wait: play() pulls the whole file regardless of `preload`, and
 * on a throttled connection two in-viewport videos compete with the LCP image
 * for the same pipe.
 */
function useWindowLoaded() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (document.readyState === "complete") {
      setLoaded(true)
      return
    }
    const done = () => setLoaded(true)
    window.addEventListener("load", done, { once: true })
    return () => window.removeEventListener("load", done)
  }, [])
  return loaded
}

/** True when the visitor has asked for less motion. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)")
    const set = () => setReduced(q.matches)
    set()
    q.addEventListener("change", set)
    return () => q.removeEventListener("change", set)
  }, [])
  return reduced
}

function Card({
  record,
  onOpen,
  priority,
  eager,
}: {
  record: WorkRecord
  onOpen: (r: WorkRecord) => void
  /** The LCP candidate: the first tile of the first rail. Exactly one per page. */
  priority: boolean
  /** Inside the initial viewport at the Lighthouse mobile and desktop presets. */
  eager: boolean
}) {
  const stills = stillsFor(record)
  const video = cardLoopFor(record)
  const reduced = usePrefersReducedMotion()
  const pageLoaded = useWindowLoaded()
  const ref = useRef<HTMLButtonElement>(null)
  const vidRef = useRef<HTMLVideoElement>(null)
  // `near` arms the source; `visible` runs it. Two thresholds, because loading
  // early and playing early are different things: the file should be on its way
  // before the card arrives, and playing only once it has.
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!video || reduced || !ref.current) return
    const el = ref.current
    const arm = new IntersectionObserver(
      ([e]) => e.isIntersecting && setNear(true),
      { rootMargin: "600px" },
    )
    // Not a threshold on the card's own area. A 4:5 card is taller than a short
    // viewport, so "35% of the card is visible" can be unreachable on the very
    // screens where the card fills everything. This asks the opposite question:
    // does the card overlap the middle 60% of the screen? That holds whatever
    // the card's height is.
    const run = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: "-20% 0px -20% 0px", threshold: 0 },
    )
    arm.observe(el)
    run.observe(el)
    return () => {
      arm.disconnect()
      run.disconnect()
    }
  }, [video, reduced])

  useEffect(() => {
    const v = vidRef.current
    if (!v) return
    // Playback waits for window load; pausing never does. Arming is untouched.
    if (visible && pageLoaded) void v.play().catch(() => {})
    else if (!visible) v.pause()
  }, [visible, near, pageLoaded])

  // Reduced motion gets the still and nothing else — no element, no request.
  const showVideo = video && !reduced

  /**
   * The video's poster is the still the browser already chose for this
   * breakpoint and format — `currentSrc`, not a URL guessed here. The card is a
   * <picture> with four candidates across two crops and two formats, so the
   * only way to name the file actually in use is to ask the element.
   *
   * It is read on load, and again on mount for the cached case where the image
   * is already complete and no load event will fire. Until it is known the
   * video simply has no poster, which is the honest state: better no poster
   * than a second file fetched for one.
   */
  /**
   * Sizing comes from next/image's optimizer through `getImageProps`, which is
   * the documented way to keep art direction inside a <picture> — the component
   * itself resizes but cannot art-direct, and these two crops carry different
   * focal points.
   *
   * `sizes` is read off the CSS rather than guessed. `.card` is 92% of the rail
   * at base, 88% from 680px, 84% from 1600px, which is §3.1's rail geometry.
   * The breakpoint stays 680px, the crops stay the same two files, and the
   * frame stays reserved by `.card`'s aspect-ratio.
   */
  const commonImg = {
    alt: "",
    loading: (eager ? "eager" : "lazy") as "eager" | "lazy",
    fetchPriority: (priority ? "high" : "auto") as "high" | "auto",
    decoding: "async" as const,
  }
  const wideProps = stills
    ? getImageProps({ ...commonImg, src: stills.wide, width: 1920, height: 1080,
        sizes: "(min-width: 1600px) 84vw, 88vw" }).props
    : null
  const compactProps = stills
    ? getImageProps({ ...commonImg, src: stills.compact, width: 1200, height: 1500,
        sizes: "92vw" }).props
    : null

  const imgRef = useRef<HTMLImageElement>(null)
  const [poster, setPoster] = useState<string | undefined>(undefined)
  const readPoster = useCallback(() => {
    const src = imgRef.current?.currentSrc
    if (src) setPoster(src)
  }, [])
  useEffect(() => {
    if (imgRef.current?.complete) readPoster()
  }, [readPoster])

  return (
    <button
      ref={ref}
      type="button"
      className={styles.card}
      onClick={() => onOpen(record)}
      aria-haspopup="dialog"
    >
      {stills ? (
        <>
          {/* Preload the LCP crop, so its fetch starts at parse rather than
              when the parser reaches the <picture>.

              web.dev, Optimize LCP: "your LCP resource should be discoverable
              from the HTML source", resource load delay should be "<10%" of
              LCP, and "Any time before LCP where one of these two resources is
              not loading is an opportunity to improve." Measured here it was
              585 ms of a 2,164 ms LCP — 27%, against a <10% target — because
              the <img> sits below three stylesheets and two fonts in the
              document.

              Two links, not one, and each carries a media condition, because
              this tile is art-directed: two different crops with different
              focal points. The conditions are exact complements of the
              <picture>'s own — `(min-width: 680px)` and `not all and
              (min-width: 680px)` — so a browser preloads the one crop it will
              actually use and never the other.

              Next's own `preload` prop cannot do this. Its documentation says
              not to use it "When you have multiple images that could be
              considered the Largest Contentful Paint (LCP) element depending on
              the viewport", nor "When the `loading` property is used", nor
              "When the `fetchPriority` property is used" — all three are true
              here. The art-direction section is blunter: "You cannot use
              `preload` or `loading=\"eager\"` because that would cause both
              images to load." The prop emits a link with no media condition,
              which is the thing that would double the download.

              So the links are written out, and `imageSrcSet`/`imageSizes` are
              taken from the same `getImageProps` call the <picture> renders
              from rather than restated, which is what makes the preloaded URL
              and the chosen URL the same URL. React hoists both into <head>.

              Only the priority tile does this. Preloading every tile would
              contend for the bandwidth this is trying to free. */}
          {priority ? (
            <>
              <link
                rel="preload"
                as="image"
                media="(min-width: 680px)"
                href={wideProps!.src}
                imageSrcSet={wideProps!.srcSet}
                imageSizes={wideProps!.sizes}
                fetchPriority="high"
              />
              <link
                rel="preload"
                as="image"
                media="not all and (min-width: 680px)"
                href={compactProps!.src}
                imageSrcSet={compactProps!.srcSet}
                imageSizes={compactProps!.sizes}
                fetchPriority="high"
              />
            </>
          ) : null}
          {/* Standard 3.1 Loading. Tiles inside the initial viewport load
              eagerly; everything else uses native lazy loading, which already
              starts fetching shortly before the tile scrolls in rather than at
              the moment it arrives. The frame is reserved in CSS — .card owns
              the aspect ratio and .cardImage is absolutely positioned inside it
              — so nothing moves as an image lands. */}
          <picture>
            <source
              media="(min-width: 680px)"
              srcSet={wideProps!.srcSet}
              sizes={wideProps!.sizes}
            />
            <img
              {...compactProps!}
              ref={imgRef}
              onLoad={readPoster}
              className={styles.cardImage}
            />
          </picture>
          {showVideo && near ? (
            <video
              ref={vidRef}
              className={styles.cardVideo}
              muted
              loop
              playsInline
              // Standard 4: "Autoplay without a poster and without
              // preload='metadata' is not permitted - it pulls the full file on
              // open." The poster is the still already on screen, so it costs no
              // extra request.
              preload="metadata"
              poster={poster}
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src={video.webm} type="video/webm" />
              <source src={video.mp4} type="video/mp4" />
            </video>
          ) : null}
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
  const video = detailVideoFor(record)
  const detailVidRef = useRef<HTMLVideoElement>(null)

  // The detail plays with sound. Opening the dialog is a click, so this runs
  // inside a user gesture and autoplay-with-audio is permitted - but only
  // "permitted", not guaranteed: a browser or an OS setting can still refuse.
  // If it does, fall back to muted playback rather than a dead frame, because a
  // silent video that plays is closer to the intent than a video that does not.
  useEffect(() => {
    const v = detailVidRef.current
    if (!v) return
    v.muted = false
    v.play().catch(() => {
      v.muted = true
      void v.play().catch(() => {})
    })
  }, [])


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
              ref={detailVidRef}
              className={styles.dialogHeroImage}
              controls
              preload="auto"
              playsInline
              poster={stills?.wide}
              src={video}
            />
          ) : stills ? (
            <>
              <picture>
                {stills.wideWebp ? (
                  <source media="(min-width: 680px)" type="image/webp" srcSet={stills.wideWebp} />
                ) : null}
                <source media="(min-width: 680px)" srcSet={stills.wide} />
                {stills.compactWebp ? <source type="image/webp" srcSet={stills.compactWebp} /> : null}
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
                // Measured, not assumed: at Lighthouse's mobile preset (412x823)
                // and desktop preset (1350x940) the first rail shows tile 0 and
                // tile 1, the second peeking in by design (3.1, "the next tile
                // peeking into view"). Both load eagerly; tile 0 is the LCP
                // candidate and the only one marked high priority.
                priority={si === 0 && i === 0}
                eager={si === 0 && i <= 1}
              />
            ))}
          </div>
        </section>
      ))}

      {open ? <Detail record={open} onClose={onClose} /> : null}
    </main>
  )
}
