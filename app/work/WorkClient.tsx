"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from "motion/react"
import Link from "next/link"
import { XIcon, PlayIcon, ArrowUpRightIcon } from "lucide-react"
import { Button, ButtonArrow } from "@/components/ui/Button"
import { WORK_RECORDS, type WorkRecord } from "@/lib/work-records"
import { BRAND_RECORDS } from "@/lib/brand-records"

// ─── Types ───────────────────────────────────────────────────────────────────

// The three commercial models defined in the Master Contextual Document,
// Section 4.3. The Work page is organized by these and only these (Section 4.12).
type Category = "Original IP" | "Platforms for Brands" | "Productions for Brands"

/**
 * Presentation-only fields. The master records carry no media, colour, or slug,
 * so these live here, keyed by the record title — the master's stable identity
 * for a record. Anything the master does carry comes from WORK_RECORDS and is
 * never restated here.
 */
interface Presentation {
  id: string
  image?: string
  imagePosition?: string
  logo?: string
  logoDark?: boolean
  bgColor?: string
  videoUrl?: string
  videoAspectRatio?: "16:9" | "4:5"
  priority?: boolean
}

type WorkItem = WorkRecord & Presentation

// ─── Link destination ─────────────────────────────────────────────────────────

// A record carries one click destination, `publicUrl`, and no notion of
// internal versus external — that distinction is presentation, so it is
// inferred from the domain here. A URL on this site's own origin renders as an
// internal route: client-side navigation, same tab, no new-window affordance.
// Anything else opens in a new tab. Owned-brand domains such as txmxboxing.com
// are separate origins and so are external by this rule, even though 434 owns
// the property.
const SITE_HOSTS = new Set(["434media.com", "www.434media.com"])

/** Same-origin URL → the path next/link should route to. Otherwise null. */
function internalPath(url: string): string | null {
  if (url.startsWith("/")) return url
  try {
    const u = new URL(url)
    return SITE_HOSTS.has(u.hostname) ? `${u.pathname}${u.search}${u.hash}` : null
  } catch {
    return null
  }
}

// ─── Category metadata ────────────────────────────────────────────────────────

interface CategoryMeta {
  id: Category
  eyebrow: string
  headline: string
  subline: string
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "Original IP",
    eyebrow: "01 — Original IP",
    headline: "Properties we own and produce.",
    subline:
      "Media properties and original productions owned by 434. Sponsorship, licensing, distribution, and partnership terms are negotiated by project.",
  },
  {
    id: "Platforms for Brands",
    eyebrow: "02 — Platforms for Brands",
    headline: "Integrated programs built for a client.",
    subline:
      "Multi-part platforms combining content, experiences, identity, and the digital infrastructure required to operate them.",
  },
  {
    id: "Productions for Brands",
    eyebrow: "03 — Productions for Brands",
    headline: "Defined content and live-experience engagements.",
    subline:
      "Standalone or episodic productions created for a client, from a single film to a full event and the media around it.",
  },
]

// ─── Data ────────────────────────────────────────────────────────────────────
//
// Canonical source: 434 MEDIA Master Contextual Document v2.0 (LOCKED),
// Sections 4.8, 4.9, and 4.10. Titles, clients, roles, credits, statuses, and
// public descriptions are taken from the portfolio record. Section 4.13 governs
// exclusions. Do not add a project here that does not have a record in Section 4.

const PRESENTATION: Record<string, Presentation> = {
  "Salute to Troops": {
    id: "salute-to-troops",
    bgColor: "bg-neutral-50",
  },
  "TXMX Boxing": {
    id: "txmx-boxing",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/txmx.png",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/TXMX%20DROP%20TEASER%20V2.mp4",
    priority: true,
  },
  "Rise of a Champion": {
    id: "rise-of-a-champion",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/rise.png",
    logoDark: true,
    bgColor: "bg-neutral-900",
  },
  "AMPD Project": {
    id: "ampd-project",
    bgColor: "bg-neutral-50",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/ampd.mp4",
  },
  "MilCityUSA": {
    id: "mil-city-usa",
    bgColor: "bg-neutral-50",
  },
  "VemosVamos": {
    id: "vemos-vamos",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/vemos-vamos/vemosinsights.jpg",
  },
  "OVERDRIVE": {
    id: "overdrive",
    logoDark: true,
    bgColor: "bg-neutral-900",
  },
  "¿Qué es SDOH?": {
    id: "que-es-sdoh",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/sdoh2.png",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/SDOH%20ACCELERATOR%20PROGRAM%20RECAP_2025.mp4",
    priority: true,
  },
  "AIM Health R&D Summit": {
    id: "aim-health-rd-summit",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/posters.jpg",
    logoDark: true,
    bgColor: "bg-neutral-900",
  },
  "Alamo Angels": {
    id: "alamo-angels-platform",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/angels3.png",
    bgColor: "bg-neutral-50",
  },
  "TechBloc Tech Day": {
    id: "techbloc-tech-day",
    image: "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/434media%2Ftechday-cover.jpeg?alt=media",
    bgColor: "bg-neutral-50",
  },
  "Mission Road Ministries — Fundraising Film Featuring SOAR": {
    id: "mission-road-soar-film",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/missionroad.png",
    bgColor: "bg-neutral-50",
  },
  "Univision San Antonio 70th Anniversary Concert — Event and Sponsor Content": {
    id: "univision-70th-anniversary",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/univision.png",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/univision-logo.svg",
    logoDark: true,
    bgColor: "bg-purple-950",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Alejandro%20Ferna%CC%81ndez%20Concert%20.mov",
    videoAspectRatio: "4:5",
  },
  "Nucleate Global Summit": {
    id: "nucleate-global-summit",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/nucleate.png",
    logoDark: true,
    bgColor: "bg-indigo-950",
  },
  "VelocityTX — SDOH Community Health Accelerator Demo Day": {
    id: "velocitytx-sdoh-demo-day",
    bgColor: "bg-neutral-50",
  },
}

// Records come from the generated extract; presentation is merged in by title.
// A record with no presentation entry still renders — as a title card, per the
// Display and Design Standard 2.2.
const workItems: WorkItem[] = WORK_RECORDS.map((record) => ({
  ...record,
  ...(PRESENTATION[record.title] ?? { id: record.title }),
}))

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({
  item,
  onClose,
}: {
  item: WorkItem
  onClose: () => void
}) {
  const isPortrait = item.videoAspectRatio === "4:5"
  const overlayRef = useRef<HTMLDivElement>(null)
  const internal = item.publicUrl ? internalPath(item.publicUrl) : null
  const isExternal = Boolean(item.publicUrl) && internal === null

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = "unset"
    }
  }, [onClose])

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      {/* Light, blurred backdrop matching the page palette */}
      <div className="absolute inset-0 bg-white/75 backdrop-blur-2xl" />

      {/* Subtle dot grid for depth — same texture used in the hero/CTA */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent 75%)",
        }}
      />

      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 18 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`relative my-auto w-full ${isPortrait ? "max-w-5xl" : "max-w-5xl"}`}
      >
        <div
          className={`relative overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] ${
            isPortrait ? "md:grid md:grid-cols-[auto_1fr]" : ""
          }`}
        >
          {/* Video pane */}
          <div
            className={`relative bg-neutral-950 ${
              isPortrait
                ? "aspect-4/5 md:aspect-auto md:h-[min(78vh,720px)]"
                : "aspect-video"
            }`}
            style={isPortrait ? { aspectRatio: "4 / 5" } : undefined}
          >
            <video
              src={item.videoUrl}
              autoPlay
              controls
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              aria-label={`${item.title} video`}
            />
          </div>

          {/* Metadata pane */}
          <div
            className={`flex flex-col gap-5 p-6 md:p-8 ${
              isPortrait
                ? "md:max-w-md md:justify-center"
                : "border-t border-neutral-200/80"
            }`}
          >
            {/* Eyebrow: now-playing + category */}
            <div className="flex items-center gap-2 font-geist-mono text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 20 }}
                className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-500"
              />
              <span className="font-geist-mono">Now playing · {item.model}</span>
            </div>

            {/* Title */}
            <h2 className="font-ggx88 text-2xl font-black leading-[0.98] tracking-[-0.02em] text-neutral-950 md:text-3xl">
              {item.title}
            </h2>

            {/* Status and operating period as pills (Section 4.5) */}
            <div className="flex flex-wrap gap-1.5">
              {[item.status, item.years].filter(Boolean).map((meta) => (
                <span
                  key={meta}
                  className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-geist-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-700"
                >
                  {meta}
                </span>
              ))}
            </div>

            {/* Approved public description */}
            <p className="text-balance font-geist-sans text-sm leading-relaxed text-neutral-600 md:text-[15px]">
              {item.description}
            </p>

            {/* Portfolio record: client, company role, founder and collaborator credits */}
            <dl className="flex flex-col gap-2 border-t border-neutral-200/80 pt-4">
              {item.client && (
                <div className="flex flex-col gap-0.5">
                  <dt className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                    Client
                  </dt>
                  <dd className="font-geist-sans text-xs leading-snug text-neutral-600">{item.client}</dd>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <dt className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                  434 MEDIA role
                </dt>
                <dd className="font-geist-sans text-xs leading-snug text-neutral-600">{item.role}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                  Credit
                </dt>
                <dd className="font-geist-sans text-xs leading-snug text-neutral-600">{item.founderCredit}</dd>
              </div>
              {item.collaboratorCredit && (
                <div className="flex flex-col gap-0.5">
                  <dt className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                    Collaborator credit
                  </dt>
                  <dd className="font-geist-sans text-xs leading-snug text-neutral-600">
                    {item.collaboratorCredit}
                  </dd>
                </div>
              )}
            </dl>

            {/* Actions */}
            <div className="mt-1 flex flex-wrap items-center gap-2.5 pt-1">
              {item.publicUrl && (
                <Button
                  href={internal ?? item.publicUrl}
                  size="sm"
                  icon={<ButtonArrow className="h-3 w-3" />}
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  Visit project
                </Button>
              )}
              <Button onClick={onClose} variant="secondary" size="sm">
                Close
                <kbd className="rounded bg-neutral-100 px-1.5 py-px font-geist-mono text-[9px] font-medium tracking-wider text-neutral-500">
                  Esc
                </kbd>
              </Button>
            </div>
          </div>
        </div>

        {/* Floating close button — outside the panel for easy reach */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-700 ring-1 ring-neutral-200 shadow-lg transition-all duration-200 hover:scale-105 hover:text-neutral-950"
          aria-label="Close video"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function WorkCard({
  item,
  onPlayVideo,
}: {
  item: WorkItem
  onPlayVideo: (item: WorkItem) => void
}) {
  const isMediaCard = !!item.image || !!item.logoDark

  const handleClick = () => {
    if (item.videoUrl) {
      onPlayVideo(item)
    }
  }

  const inner = (
    <div
      className={`group relative aspect-4/5 w-full overflow-hidden rounded-md ring-1 ring-neutral-200 transition-all duration-300 hover:-translate-y-0.5 hover:ring-neutral-300 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ${
        item.image ? "bg-neutral-950" : item.bgColor || "bg-neutral-50"
      }`}
    >
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          draggable={false}
          loading={item.priority ? "eager" : "lazy"}
          fetchPriority={item.priority ? "high" : "auto"}
          className="absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.04] group-hover:brightness-110"
          style={{ objectPosition: item.imagePosition || "center" }}
        />
      )}

      {item.image && (
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/0 transition-opacity duration-500 group-hover:from-black/90" />
      )}

      {item.logo && !item.image && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.logo}
            alt={`${item.title} logo`}
            className="max-h-12 w-auto object-contain opacity-50 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105 md:max-h-16"
            draggable={false}
          />
        </div>
      )}

      {item.logo && item.image && (
        <div className="absolute inset-0 z-3 flex items-center justify-center bg-black/35 backdrop-blur-[2px] lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.logo}
            alt={item.title}
            className="max-h-10 w-auto object-contain drop-shadow-lg"
            draggable={false}
          />
        </div>
      )}

      {!item.logo && !item.image && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <h3 className="text-center font-ggx88 text-xl font-black leading-none tracking-tighter text-neutral-900 md:text-2xl">
            {item.title}
          </h3>
        </div>
      )}

      {/* Top-right action chip — rendered only where there is an action.
          The ring used to render unconditionally with only the icon inside
          guarded, so a card with neither media nor a destination showed an
          empty circle on hover: a control that appears and does nothing.
          Latent until the Section 4 reconciliation introduced cards with
          neither — 0 such cards before it, 7 of 15 after. */}
      {(item.videoUrl || item.publicUrl) && (
      <div className="absolute top-3 right-3 z-10">
        <div
          className={`grid h-7 w-7 place-items-center rounded-full ring-1 backdrop-blur-md transition-all duration-300 ${
            isMediaCard
              ? "bg-white/10 text-white ring-white/20 opacity-0 group-hover:opacity-100"
              : "bg-neutral-950/5 text-neutral-700 ring-neutral-950/15 opacity-0 group-hover:opacity-100"
          } group-hover:scale-105`}
        >
          {item.videoUrl ? (
            <PlayIcon className="h-3 w-3 fill-current" />
          ) : item.publicUrl ? (
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
          ) : null}
        </div>
      </div>
      )}

      {/* Persistent bottom info */}
      <div className="absolute inset-x-0 bottom-0 z-2 p-4">
        <p
          className={`mb-1.5 font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${
            isMediaCard ? "text-white/55 group-hover:text-white/80" : "text-neutral-400 group-hover:text-neutral-600"
          }`}
        >
          {item.client ?? "Owned by 434 MEDIA"}
        </p>

        <h3
          className={`text-balance font-geist-sans text-sm font-semibold leading-tight tracking-tight transition-colors duration-300 ${
            isMediaCard ? "text-white" : "text-neutral-900"
          }`}
        >
          {item.title}
        </h3>

        <p
          className={`font-geist-sans text-xs leading-snug tracking-tight transition-all duration-500 ${
            isMediaCard ? "text-white/65" : "text-neutral-500"
          } line-clamp-2 max-h-0 overflow-hidden opacity-0 group-hover:mt-1.5 group-hover:max-h-24 group-hover:opacity-100`}
        >
          {item.description}
        </p>
      </div>
    </div>
  )

  if (item.videoUrl) {
    return (
      <button
        onClick={handleClick}
        className="block w-full cursor-pointer text-left"
        aria-label={`Play ${item.title} video`}
      >
        {inner}
      </button>
    )
  }

  if (item.publicUrl) {
    const internal = internalPath(item.publicUrl)
    return (
      <Link
        href={internal ?? item.publicUrl}
        className="block w-full"
        {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {inner}
      </Link>
    )
  }

  return <div className="w-full">{inner}</div>
}

// ─── Page Client ──────────────────────────────────────────────────────────────

export default function WorkClient() {
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null)
  const [activeCategory, setActiveCategory] = useState<Category>(CATEGORIES[0].id)

  const heroRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<Category, HTMLElement | null>>({
    "Original IP": null,
    "Platforms for Brands": null,
    "Productions for Brands": null,
  })

  // Hero scroll parallax
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })
  const heroOpacity = useTransform(heroProgress, [0, 0.85], [1, 0])
  const heroY = useTransform(heroProgress, [0, 1], [0, -80])
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.96])

  // Top scroll progress bar
  const { scrollYProgress: pageProgress } = useScroll()
  const smoothProgress = useSpring(pageProgress, { stiffness: 120, damping: 24, mass: 0.4 })
  const [showChip, setShowChip] = useState(false)
  useMotionValueEvent(pageProgress, "change", (latest) => {
    setShowChip(latest > 0.06 && latest < 0.95)
  })

  // Track active category as user scrolls
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          // Pick the section whose top is closest to the viewport top
          const top = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0]
          const id = top.target.getAttribute("data-category") as Category | null
          if (id) setActiveCategory(id)
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    )

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: workItems.filter((i) => i.model === cat.id),
    }))
  }, [])

  const handlePlayVideo = useCallback((item: WorkItem) => {
    setActiveItem(item)
  }, [])

  const handleCloseVideo = useCallback(() => setActiveItem(null), [])

  const activeMeta = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0]

  return (
    <>
      {/* Top scroll-progress bar */}
      <motion.div
        className="fixed inset-x-0 top-0 z-40 h-px origin-left bg-neutral-950"
        style={{ scaleX: smoothProgress }}
      />

      <main className="min-h-dvh bg-white text-neutral-950">
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative overflow-hidden border-b border-neutral-200/70 px-6 pt-32 pb-20 lg:px-8 lg:pt-40 lg:pb-28"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse 70% 70% at 50% 0%, black, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 70% at 50% 0%, black, transparent 70%)",
            }}
          />

          <motion.div
            style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
            className="mx-auto max-w-7xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mb-8 flex items-center gap-2 font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500"
            >
              <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-neutral-900" />
              Portfolio · 434 MEDIA
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="font-ggx88 text-[clamp(2.5rem,9vw,7.5rem)] md:text-[clamp(3rem,9vw,7.5rem)] font-black leading-[0.92] tracking-[-0.04em] text-neutral-950"
            >
              Owned Properties.
              <br />
              Client Productions.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 max-w-2xl text-balance font-geist-sans text-lg leading-relaxed tracking-tight text-neutral-600 md:text-xl"
            >
              {BRAND_RECORDS.canonicalDefinition} Everything
              below is organized by commercial model: what we own, the platforms we build for
              clients, and the productions we deliver for them.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Button href="/contact" size="md" icon={<ButtonArrow />}>
                Start a production
              </Button>
              <Button href="#work" variant="secondary" size="md">
                Browse the portfolio
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-y-px">
                  ↓
                </span>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Sticky category chip */}
        <AnimatePresence>
          {showChip && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-none fixed top-20 left-1/2 z-30 -translate-x-1/2"
            >
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-1.5 font-geist-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-700 shadow-sm ring-1 ring-neutral-200 backdrop-blur-md"
              >
                <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-500" />
                {activeMeta.eyebrow}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Grouped sections ────────────────────────────────────────────────── */}
        <div id="work" className="relative">
          {grouped.map((group, groupIndex) => (
            <section
              key={group.id}
              ref={(el) => {
                sectionRefs.current[group.id] = el
              }}
              data-category={group.id}
              className={`px-6 lg:px-8 ${
                groupIndex === 0 ? "pt-16 lg:pt-24" : "pt-20 lg:pt-28"
              } pb-12 lg:pb-16 ${
                groupIndex === grouped.length - 1
                  ? "border-b border-neutral-200/70"
                  : "border-b border-neutral-100"
              }`}
            >
              <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-10 grid items-end gap-6 md:mb-14 md:grid-cols-12"
                >
                  <div className="md:col-span-8">
                    <p className="mb-3 font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                      {group.eyebrow}
                    </p>
                    <h2 className="font-ggx88 text-3xl font-black leading-[0.95] tracking-[-0.02em] text-neutral-950 md:text-5xl">
                      {group.headline}
                    </h2>
                  </div>
                  <p className="font-geist-sans text-sm leading-relaxed text-neutral-500 md:col-span-4 md:text-base">
                    {group.subline}
                  </p>
                </motion.div>

                {/* Uniform card grid: 1 / 2 / 4 cols, all aspect-[4/5] */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                  {group.items.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{
                        duration: 0.55,
                        delay: Math.min(idx * 0.04, 0.32),
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <WorkCard item={item} onPlayVideo={handlePlayVideo} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-neutral-50">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent 75%)",
            }}
          />
          <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="grid items-end gap-10 md:grid-cols-12"
            >
              <div className="md:col-span-7">
                <p className="mb-4 font-geist-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                  Next step
                </p>
                <h2 className="font-ggx88 text-4xl font-black leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl">
                  Tell us what you&apos;re producing.
                </h2>
                <p className="mt-6 max-w-xl font-geist-sans text-base leading-relaxed text-neutral-600 md:text-lg">
                  We can lead the full production or own a defined part of it within a larger
                  team. Send the objective, the audience, and the target date, and we&apos;ll come
                  back with the structure that fits.
                </p>
              </div>
              <div className="md:col-span-5 md:justify-self-end">
                <div className="flex flex-col items-stretch gap-3 sm:flex-row md:flex-col md:items-end">
                  <Button href="/contact" size="lg" icon={<ButtonArrow />}>
                    Start a production
                  </Button>
                  <Button href="mailto:build@434media.com" variant="secondary" size="lg">
                    build@434media.com
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {activeItem && <VideoModal item={activeItem} onClose={handleCloseVideo} />}
      </AnimatePresence>
    </>
  )
}
