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

// ─── Types ───────────────────────────────────────────────────────────────────

type Category =
  | "Brand & Culture"
  | "Health & Bio Innovation"
  | "Capital & Founders"
  | "Tech & Community"
  | "Media & Storytelling"

interface WorkItem {
  id: string
  title: string
  description: string
  category: Category
  image?: string
  imagePosition?: string
  logo?: string
  logoDark?: boolean
  bgColor?: string
  videoUrl?: string
  videoAspectRatio?: "16:9" | "4:5"
  href?: string
  tags?: string[]
  priority?: boolean
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
    id: "Brand & Culture",
    eyebrow: "01 — Brand & Culture",
    headline: "Original IP and creator-led brands.",
    subline:
      "Lifestyle, music, and identity work where we build brands from the ground up — not just market them.",
  },
  {
    id: "Health & Bio Innovation",
    eyebrow: "02 — Health & Bio Innovation",
    headline: "Vertical depth in healthcare and life sciences.",
    subline:
      "Storytelling and media for the institutions, programs, and founders shaping the future of human health.",
  },
  {
    id: "Capital & Founders",
    eyebrow: "03 — Capital & Founders",
    headline: "Built for the people who back bold ideas.",
    subline: "Content, brand, and event work for venture firms and angel networks across South Texas.",
  },
  {
    id: "Tech & Community",
    eyebrow: "04 — Tech & Community",
    headline: "Connecting technology, talent, and place.",
    subline:
      "Conferences, communities, and tools that grow the regional tech ecosystem and the people inside it.",
  },
  {
    id: "Media & Storytelling",
    eyebrow: "05 — Media & Storytelling",
    headline: "Cross-cultural, cross-platform storytelling.",
    subline:
      "Bilingual, broadcast, and mission-driven media reaching audiences that legacy outlets miss.",
  },
]

// ─── Data ────────────────────────────────────────────────────────────────────

const workItems: WorkItem[] = [
  // 01 — Brand & Culture
  {
    id: "vanita-leo",
    title: "Vanita Leo",
    description:
      "Texas Cumbia artist — media, partnerships, and content amplifying a singular voice.",
    category: "Brand & Culture",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/vanita.png",
    imagePosition: "left",
    priority: true,
    href: "https://www.instagram.com/p/DRK7SlZj4wP/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA%3D%3D",
    bgColor: "bg-amber-50",
    tags: ["Music", "Brand"],
  },
  {
    id: "txmx-boxing",
    title: "TXMX Boxing",
    description:
      "Original fight-culture brand spanning content, events, and gear — Texas and Mexico.",
    category: "Brand & Culture",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/txmx.png",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/TXMX%20DROP%20TEASER%20V2.mp4",
    href: "/shop",
    priority: true,
    tags: ["Brand", "E-Commerce"],
  },
  {
    id: "rise-of-a-champion",
    title: "Rise of a Champion",
    description:
      "Curated room of athletes, entertainers, and leaders. Built with Icontalks x TXMX.",
    category: "Brand & Culture",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/rise.png",
    bgColor: "bg-neutral-900",
    logoDark: true,
    href: "https://www.digitalcanvas.community/thefeed/loud-about-legacy",
    tags: ["Documentary", "Sports"],
  },
  {
    id: "adornthebay",
    title: "Adorn the Bay",
    description:
      "Murals revitalizing Tampa Bay businesses and community spaces hit by recent hurricanes.",
    category: "Brand & Culture",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/adornbay.png",
    bgColor: "bg-sky-50",
    href: "https://adornmurals.com/home",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/ampd.mp4",
    tags: ["Public Art", "Impact"],
  },

  // 02 — Health & Bio Innovation
  {
    id: "mhm",
    title: "Methodist Healthcare Ministries",
    description:
      "Broadening healthcare beyond clinical care — addressing systemic inequities at scale.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/sdoh-accelerator.jpg",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/mhm.png",
    bgColor: "bg-white",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Demo-Day-V3.mov",
    href: "https://www.mhm.org/",
    tags: ["Healthcare", "Nonprofit"],
  },
  {
    id: "sdoh",
    title: "¿Qué es SDOH?",
    description:
      "Bilingual multimedia campaigns turning social-determinants awareness into action.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/sdoh2.png",
    videoUrl:
      "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/SDOH%20ACCELERATOR%20PROGRAM%20RECAP_2025.mp4",
    href: "/en/sdoh",
    tags: ["Health", "Bilingual"],
  },
  {
    id: "health-cell",
    title: "The Health Cell",
    description:
      "San Antonio's biotech, medical, and military health sector — collaboration at the table.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/healthcell.png",
    bgColor: "bg-neutral-50",
    href: "https://www.434media.com/blog/44b-and-counting-the-health-cell-2025",
    tags: ["Health", "Innovation"],
  },
  {
    id: "velocity-tx",
    title: "VelocityTX",
    description:
      "Innovation hub fueling biotech and life-science startups in South Texas.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/vtx.png",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Sponsor%20Logos/VelocityTX%20Logo%20MAIN%20RGB%20(1).png",
    bgColor: "bg-white",
    href: "https://www.digitalcanvas.community/thefeed/434-crashes-sasw-10th-year",
    tags: ["Biotech", "Startups"],
  },
  {
    id: "nucleate-texas",
    title: "Nucleate Texas",
    description: "Brand storytelling for the next generation of biotech student founders.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/nucleate.png",
    bgColor: "bg-indigo-950",
    logoDark: true,
    href: "https://luma.com/nucleate-sxsw-2026",
    tags: ["Biotech", "Students"],
  },
  {
    id: "aimsatx",
    title: "AIM Health R&D Summit",
    description:
      "Where military, civilian, and research leaders converge on the future of military health.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/posters.jpg",
    bgColor: "bg-neutral-900",
    logoDark: true,
    href: "https://aimsatx.com/",
    tags: ["Military", "Innovation"],
  },
  {
    id: "altbionics",
    title: "Alt-Bionics",
    description:
      "Affordable bionic hands — transforming prosthetics and humanoid robotics.",
    category: "Health & Bio Innovation",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/altbionics.png",
    bgColor: "bg-neutral-900",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/AltBionics%20.mov",
    videoAspectRatio: "4:5",
    href: "https://www.altbionics.com/",
    tags: ["Robotics", "Prosthetics"],
  },

  // 03 — Capital & Founders
  {
    id: "builders-vc",
    title: "Builders VC",
    description:
      "Venture firm backing bold founders. Content and storytelling for portfolio amplification.",
    category: "Capital & Founders",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/builders-dark.svg",
    bgColor: "bg-neutral-50",
    href: "https://www.builders.vc/",
    tags: ["VC", "Startups"],
  },
  {
    id: "alamo-angels",
    title: "Alamo Angels",
    description:
      "South Texas angel network — pitch coverage, events, and founder storytelling.",
    category: "Capital & Founders",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/angels3.png",
    bgColor: "bg-neutral-50",
    href: "https://www.digitalcanvas.community/thefeed/built-for-the-triangle",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Alamo%20Angles.mp4",
    tags: ["Angel", "Startups"],
  },

  // 04 — Tech & Community
  {
    id: "digital-canvas",
    title: "Digital Canvas",
    description:
      "Conferences, workshops, and AI-driven experiences. Built with 434 MEDIA × DEVSA.",
    category: "Tech & Community",
    image: "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/434media%2Fmhth-cover.JPG?alt=media",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/digital-canvas-ymas.svg",
    logoDark: true,
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/digitalcanvas.mov",
    bgColor: "bg-neutral-900",
    href: "https://www.digitalcanvas.community/",
    tags: ["Conferences", "AI"],
  },
  {
    id: "devsa",
    title: "DEVSA",
    description:
      "San Antonio's developer community — events, workshops, and pipeline building.",
    category: "Tech & Community",
    image: "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/434media%2Fdevsa-cover.jpg?alt=media",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/DEVSA%20Web%20Banner.mp4",
    href: "https://www.devsa.community",
    tags: ["Developers", "Community"],
  },
  {
    id: "tech-bloc",
    title: "Tech Bloc",
    description:
      "Economic development and advocacy growing the San Antonio tech ecosystem.",
    category: "Tech & Community",
    image: "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/434media%2Ftechday-cover.jpeg?alt=media",
    bgColor: "bg-neutral-50",
    href: "https://www.sanantoniotechday.com/",
    tags: ["Advocacy", "Tech"],
  },
  {
    id: "learn2ai",
    title: "Learn2AI",
    description:
      "AI literacy for everyone — practical learning, hands-on projects, real-world results.",
    category: "Tech & Community",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/ai2.png",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Learn2ai.svg",
    bgColor: "bg-neutral-50",
    href: "https://www.learn2ai.co/",
    videoUrl: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Learn2AI%20-%20081825%20G.mp4",
    tags: ["AI", "Education"],
  },

  // 05 — Media & Storytelling
  {
    id: "univision",
    title: "Univision",
    description:
      "Spanish-language broadcast partnerships reaching millions of Hispanic audiences.",
    category: "Media & Storytelling",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/univision.png",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/univision-logo.svg",
    bgColor: "bg-purple-950",
    logoDark: true,
    videoUrl:
      "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Alejandro%20Ferna%CC%81ndez%20Concert%20.mov",
    videoAspectRatio: "4:5",
    href: "https://www.digitalcanvas.community/thefeed/capturing-a-milestone",
    tags: ["Broadcast", "Hispanic"],
  },
  {
    id: "wifttx",
    title: "WIFT TX",
    description:
      "Women in Film & Television Texas — amplifying women's voices through media partnerships.",
    category: "Media & Storytelling",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/wifttx.avif",
    bgColor: "bg-rose-950",
    logoDark: true,
    href: "https://www.digitalcanvas.community/thefeed/1.5B-Reasons-to-Film-in-Texas",
    tags: ["Film", "Advocacy"],
  },
  {
    id: "vemos-vamos",
    title: "Vemos Vamos",
    description:
      "Bilingual storytelling initiative connecting communities through shared vision.",
    category: "Media & Storytelling",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/vemos-vamos/vemosinsights.jpg",
    href: "https://www.vemosvamos.com/about",
    tags: ["Bilingual", "Agency"],
  },
  {
    id: "mission-road",
    title: "Mission Road Ministries",
    description:
      "Mission-driven media for a nonprofit serving individuals with disabilities.",
    category: "Media & Storytelling",
    image: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/work/missionroad.png",
    bgColor: "bg-neutral-50",
    href: "https://www.missionroadministries.org/",
    tags: ["Nonprofit", "Impact"],
  },
]

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
  const isExternal = item.href?.startsWith("http")

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
              <span className="font-geist-mono">Now playing · {item.category}</span>
            </div>

            {/* Title */}
            <h2 className="font-ggx88 text-2xl font-black leading-[0.98] tracking-[-0.02em] text-neutral-950 md:text-3xl">
              {item.title}
            </h2>

            {/* Tags as pills */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 font-geist-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-balance font-geist-sans text-sm leading-relaxed text-neutral-600 md:text-[15px]">
              {item.description}
            </p>

            {/* Actions */}
            <div className="mt-1 flex flex-wrap items-center gap-2.5 pt-1">
              {item.href && (
                <Link
                  href={item.href}
                  className="group inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 font-geist-sans text-xs font-medium text-white transition-all duration-200 hover:gap-2.5 hover:bg-neutral-800"
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  Visit project
                  <ArrowUpRightIcon className="h-3 w-3 transition-transform duration-200 group-hover:rotate-12" />
                </Link>
              )}
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-geist-sans text-xs font-medium text-neutral-700 ring-1 ring-neutral-300 transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-950"
              >
                Close
                <kbd className="rounded bg-neutral-100 px-1.5 py-px font-geist-mono text-[9px] font-medium tracking-wider text-neutral-500">
                  Esc
                </kbd>
              </button>
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

      {/* Top-right action chip */}
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
          ) : item.href ? (
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
          ) : null}
        </div>
      </div>

      {/* Persistent bottom info */}
      <div className="absolute inset-x-0 bottom-0 z-2 p-4">
        {item.tags && item.tags.length > 0 && (
          <p
            className={`mb-1.5 font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${
              isMediaCard ? "text-white/55 group-hover:text-white/80" : "text-neutral-400 group-hover:text-neutral-600"
            }`}
          >
            {item.tags.join(" · ")}
          </p>
        )}

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

  if (item.href) {
    const isExternal = item.href.startsWith("http")
    return (
      <Link
        href={item.href}
        className="block w-full"
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
    "Brand & Culture": null,
    "Health & Bio Innovation": null,
    "Capital & Founders": null,
    "Tech & Community": null,
    "Media & Storytelling": null,
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
      items: workItems.filter((i) => i.category === cat.id),
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
              Selected Work · 434 MEDIA
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="font-ggx88 text-[clamp(3rem,9vw,7.5rem)] font-black leading-[0.92] tracking-[-0.04em] text-neutral-950"
            >
              Bold Stories.
              <br />
              <span className="bg-linear-to-br from-neutral-950 via-neutral-700 to-neutral-400 bg-clip-text text-transparent">
                Proven Impact.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 max-w-2xl text-balance font-geist-sans text-lg leading-relaxed tracking-tight text-neutral-600 md:text-xl"
            >
              From brand campaigns, to event production, we help the world&apos;s most innovative
              firms find their voice and amplify their impact through bold storytelling and
              experiences.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/contact"
                className="group inline-flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-2.5 font-geist-sans text-sm font-medium text-white transition-all duration-200 hover:gap-3 hover:bg-neutral-800"
              >
                Start a project
                <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-12" />
              </Link>
              <a
                href="#work"
                className="group inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-geist-sans text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-950"
              >
                Browse the portfolio
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-y-px">
                  ↓
                </span>
              </a>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mt-16 grid max-w-3xl grid-cols-3 gap-x-8 border-t border-neutral-200/70 pt-8"
            >
              {[
                { v: workItems.length, l: "Projects shipped" },
                { v: CATEGORIES.length, l: "Practice areas" },
                { v: "SATX", l: "Built in" },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
                    {s.l}
                  </dt>
                  <dd className="mt-1 font-ggx88 text-3xl font-black tracking-tight tabular-nums text-neutral-950 md:text-4xl">
                    {s.v}
                  </dd>
                </div>
              ))}
            </motion.dl>
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
                  Let&apos;s build yours
                </p>
                <h2 className="font-ggx88 text-4xl font-black leading-[0.95] tracking-[-0.03em] text-neutral-950 md:text-6xl">
                  Bold stories aren&apos;t accidental.
                </h2>
                <p className="mt-6 max-w-xl font-geist-sans text-base leading-relaxed text-neutral-600 md:text-lg">
                  We help the world&apos;s most innovative firms find their voice and amplify their
                  impact through brand campaigns, event production, and storytelling that earns
                  attention.
                </p>
              </div>
              <div className="md:col-span-5 md:justify-self-end">
                <div className="flex flex-col items-stretch gap-3 sm:flex-row md:flex-col md:items-end">
                  <Link
                    href="/contact"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-3 font-geist-sans text-sm font-medium text-white transition-all duration-200 hover:gap-3 hover:bg-neutral-800"
                  >
                    Start a project
                    <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-12" />
                  </Link>
                  <a
                    href="mailto:build@434media.com"
                    className="group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-geist-sans text-sm font-medium text-neutral-700 ring-1 ring-neutral-300 transition-all duration-200 hover:bg-white hover:text-neutral-950"
                  >
                    build@434media.com
                  </a>
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
