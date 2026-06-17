"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Target,
  Hammer,
  Clapperboard,
  Megaphone,
  BarChart3,
  ArrowRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Accent = {
  text: string
  chip: string
  ghost: string
  glow: string
  dot: string
  bar: string
}

const ACCENTS: Record<string, Accent> = {
  indigo: {
    text: "text-indigo-300",
    chip: "bg-indigo-500/10 text-indigo-200 border-indigo-400/30",
    ghost: "text-indigo-500/10",
    glow: "bg-indigo-600/20",
    dot: "bg-indigo-400",
    bar: "from-indigo-400 to-indigo-600",
  },
  emerald: {
    text: "text-emerald-300",
    chip: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
    ghost: "text-emerald-500/10",
    glow: "bg-emerald-600/20",
    dot: "bg-emerald-400",
    bar: "from-emerald-400 to-emerald-600",
  },
  fuchsia: {
    text: "text-fuchsia-300",
    chip: "bg-fuchsia-500/10 text-fuchsia-200 border-fuchsia-400/30",
    ghost: "text-fuchsia-500/10",
    glow: "bg-fuchsia-600/20",
    dot: "bg-fuchsia-400",
    bar: "from-fuchsia-400 to-fuchsia-600",
  },
  amber: {
    text: "text-amber-300",
    chip: "bg-amber-500/10 text-amber-200 border-amber-400/30",
    ghost: "text-amber-500/10",
    glow: "bg-amber-600/20",
    dot: "bg-amber-400",
    bar: "from-amber-400 to-amber-600",
  },
  sky: {
    text: "text-sky-300",
    chip: "bg-sky-500/10 text-sky-200 border-sky-400/30",
    ghost: "text-sky-500/10",
    glow: "bg-sky-600/20",
    dot: "bg-sky-400",
    bar: "from-sky-400 to-sky-600",
  },
  slate: {
    text: "text-slate-300",
    chip: "bg-white/5 text-slate-200 border-white/15",
    ghost: "text-white/5",
    glow: "bg-slate-500/20",
    dot: "bg-slate-300",
    bar: "from-slate-300 to-slate-500",
  },
}

type SquadSlide = {
  kind: "squad"
  num: string
  name: string
  tagline: string
  what: string
  does: string[]
  team: string
  deliverable: string
  icon: LucideIcon
  accent: keyof typeof ACCENTS
}

type Slide =
  | { kind: "title" }
  | { kind: "overview" }
  | SquadSlide
  | { kind: "closing" }

const SQUADS: SquadSlide[] = [
  {
    kind: "squad",
    num: "01",
    name: "Domain & Painpoints",
    tagline: "The translation layer.",
    what: "Captures real industry problems as the Underwriter Problem Set — written so a salesperson and a builder both understand them cold.",
    does: [
      "Design the write-up template + the underwriter question guide",
      "Author 12–15 cybersecurity & fintech painpoints",
      "Label every problem by industry vertical",
    ],
    team: "Cyber-defense / fraud-ops veteran (lead) + 1 cybersecurity",
    deliverable: "The Underwriter Problem Set",
    icon: Target,
    accent: "indigo",
  },
  {
    kind: "squad",
    num: "02",
    name: "Build",
    tagline: "The engineering squad.",
    what: "Turns the painpoint template into working software — the public intake form and the record type the whole program runs on.",
    does: [
      "Build the public painpoint intake form",
      "Build the painpoint record + vetting surface in the admin",
      "Wire the activate-to-cohort step that closes the loop",
    ],
    team: "2 computer science",
    deliverable: "The live intake pipeline",
    icon: Hammer,
    accent: "emerald",
  },
  {
    kind: "squad",
    num: "03",
    name: "Story & Media",
    tagline: "434 Media's production arm.",
    what: "Captures the whole program as investor-grade media that the cohort and its sponsors keep forever.",
    does: [
      "Builder profiles + demo-day footage",
      "Investor-grade recap content",
      "A reusable brand kit & content templates — finished with sound",
    ],
    team: "2 film & media + 1 digital music",
    deliverable: "Media kit + cohort footage",
    icon: Clapperboard,
    accent: "fuchsia",
  },
  {
    kind: "squad",
    num: "04",
    name: "GTM",
    tagline: "The underwriter-sales engine.",
    what: "Finds and pitches the corporate sponsors who claim a vertical and own a 6-week cohort.",
    does: [
      "Build scored target lists of candidate underwriters",
      "Craft the outreach templates & the sales playbook",
      "Hand warm sponsors to Domain to author their problems",
    ],
    team: "Communications (lead) + 1 cybersecurity",
    deliverable: "A repeatable sponsor-recruitment engine",
    icon: Megaphone,
    accent: "amber",
  },
  {
    kind: "squad",
    num: "05",
    name: "Analytics",
    tagline: "The measurement squad.",
    what: "Quantifies the opportunity and the impact — turning “a real problem” into “a real, sized market.”",
    does: [
      "Market sizing for every painpoint",
      "Cohort health & builder-progress metrics",
      "The demo-day dashboard investors and sponsors see",
    ],
    team: "1 cybersecurity",
    deliverable: "Sized markets + the demo-day dashboard",
    icon: BarChart3,
    accent: "sky",
  },
]

const SLIDES: Slide[] = [{ kind: "title" }, { kind: "overview" }, ...SQUADS, { kind: "closing" }]

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
}
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
}

function TitleSlide() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl">
      <motion.div variants={item} className="text-[13px] font-semibold tracking-[0.2em] uppercase text-slate-400">
        Digital Canvas · AI-Builder Program
      </motion.div>
      <motion.h1 variants={item} className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white">
        Meet the Squads
      </motion.h1>
      <motion.p variants={item} className="mt-6 text-lg sm:text-2xl text-slate-300 leading-relaxed">
        Five squads, one pipeline — from a real industry problem to demo day.
      </motion.p>
      <motion.div variants={item} className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-[15px] text-slate-400">
        <span>10 interns</span>
        <span className="text-slate-600">·</span>
        <span>5 squads</span>
        <span className="text-slate-600">·</span>
        <span>6 weeks</span>
        <span className="text-slate-600">·</span>
        <span>DEVSA × Alamo Angels × 434 Media</span>
      </motion.div>
    </motion.div>
  )
}

function OverviewSlide() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl w-full">
      <motion.div variants={item} className="text-[13px] font-semibold tracking-[0.2em] uppercase text-slate-400">
        How it fits together
      </motion.div>
      <motion.h2 variants={item} className="mt-4 text-3xl sm:text-5xl font-bold tracking-tight text-white">
        One pipeline, five owners
      </motion.h2>
      <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-2.5 text-[13px] sm:text-[15px]">
        {[
          "An underwriter authors the problem set",
          "Builders ship prototypes against it",
          "Demo day to investors",
        ].map((step, i) => (
          <div key={step} className="flex items-center gap-2.5">
            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-slate-200">
              {step}
            </span>
            {i < 2 && <ArrowRight className="hidden sm:block w-4 h-4 text-slate-600" />}
          </div>
        ))}
      </motion.div>
      <motion.div variants={item} className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {SQUADS.map((s) => {
          const a = ACCENTS[s.accent]
          const Icon = s.icon
          return (
            <div key={s.num} className="rounded-xl border border-white/10 bg-white/3 p-4">
              <Icon className={`w-5 h-5 ${a.text}`} />
              <div className="mt-3 text-[11px] font-mono text-slate-500">{s.num}</div>
              <div className="text-[14px] font-semibold text-white leading-tight">{s.name}</div>
              <div className={`mt-1 text-[12px] ${a.text}`}>{s.tagline}</div>
            </div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}

function SquadSlideView({ s }: { s: SquadSlide }) {
  const a = ACCENTS[s.accent]
  const Icon = s.icon
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl w-full">
      <div className="flex items-start gap-4 sm:gap-5">
        <motion.div
          variants={item}
          className={`shrink-0 grid place-items-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl border ${a.chip}`}
        >
          <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${a.text}`} />
        </motion.div>
        <div className="min-w-0">
          <motion.div variants={item} className="font-mono text-[13px] sm:text-[14px] text-slate-500">
            Squad {s.num}
          </motion.div>
          <motion.h2 variants={item} className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            {s.name}
          </motion.h2>
          <motion.div variants={item} className={`mt-1.5 sm:mt-2 text-lg sm:text-xl font-medium ${a.text}`}>
            {s.tagline}
          </motion.div>
        </div>
      </div>

      <motion.p variants={item} className="mt-6 sm:mt-7 max-w-3xl text-base sm:text-xl text-slate-300 leading-relaxed">
        {s.what}
      </motion.p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2">
          <div className="text-[12px] font-semibold tracking-[0.15em] uppercase text-slate-500 mb-3">
            What they do
          </div>
          <ul className="space-y-2.5">
            {s.does.map((d) => (
              <li key={d} className="flex items-start gap-3 text-[15px] text-slate-200">
                <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`} />
                {d}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div variants={item} className="space-y-5">
          <div>
            <div className="text-[12px] font-semibold tracking-[0.15em] uppercase text-slate-500 mb-2">Team</div>
            <div className="text-[15px] text-slate-200">{s.team}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold tracking-[0.15em] uppercase text-slate-500 mb-2">
              Deliverable
            </div>
            <span className={`inline-block rounded-lg border px-3 py-1.5 text-[14px] font-medium ${a.chip}`}>
              {s.deliverable}
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

function ClosingSlide() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl">
      <motion.div variants={item} className="text-[13px] font-semibold tracking-[0.2em] uppercase text-slate-400">
        Five squads · one cohort
      </motion.div>
      <motion.h2 variants={item} className="mt-5 text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white">
        GTM finds it. Domain frames it.
        <br />
        Build ships it. Story tells it.
        <br />
        Analytics proves it.
      </motion.h2>
      <motion.p variants={item} className="mt-6 sm:mt-7 text-lg sm:text-xl text-slate-300">
        Every squad owns a stage of the same pipeline — and the cohort runs end-to-end, from a real industry problem
        to demo day.
      </motion.p>
      <motion.div variants={item} className="mt-10 text-2xl font-semibold text-white">
        Let’s build. →
      </motion.div>
    </motion.div>
  )
}

function currentAccent(slide: Slide): Accent {
  if (slide.kind === "squad") return ACCENTS[slide.accent]
  return ACCENTS.slate
}

export default function SquadsDeckPage() {
  const [i, setI] = useState(0)
  const total = SLIDES.length
  const slide = SLIDES[i]
  const accent = currentAccent(slide)

  const go = useCallback(
    (dir: 1 | -1) => setI((prev) => Math.min(total - 1, Math.max(0, prev + dir))),
    [total],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault()
        go(1)
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault()
        go(-1)
      } else if (e.key === "Home") {
        setI(0)
      } else if (e.key === "End") {
        setI(total - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, total])

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950 text-white select-none flex flex-col">
      {/* Accent glow — shifts per slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`glow-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={`pointer-events-none absolute -top-1/3 -right-1/4 w-[70vw] h-[70vw] rounded-full blur-[120px] ${accent.glow}`}
        />
      </AnimatePresence>

      {/* Big ghost number for squad slides (decorative, behind; desktop only) */}
      {slide.kind === "squad" && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`ghost-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`pointer-events-none absolute bottom-[-4vw] right-6 font-bold leading-none text-[34vw] hidden sm:block ${accent.ghost}`}
          >
            {slide.num}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex-none flex items-center justify-between px-6 sm:px-14 pt-5 pb-3 gap-3">
        <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.18em] uppercase text-slate-500 truncate">
          Digital Canvas — Squads
        </div>
        <div className="font-mono text-[12px] text-slate-500 shrink-0">
          {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>

      {/* Slide stage — scrolls when content exceeds the viewport (mobile) */}
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-6 sm:px-14 lg:px-24">
        <div className="min-h-full flex items-center py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              {slide.kind === "title" && <TitleSlide />}
              {slide.kind === "overview" && <OverviewSlide />}
              {slide.kind === "squad" && <SquadSlideView s={slide} />}
              {slide.kind === "closing" && <ClosingSlide />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex-none flex items-center justify-between px-6 sm:px-14 pt-3 pb-5 gap-3">
        <div className="flex items-center gap-2">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? `w-7 ${accent.dot}` : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            disabled={i === 0}
            className="grid place-items-center h-10 w-10 rounded-full border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            disabled={i === total - 1}
            className="grid place-items-center h-10 w-10 rounded-full border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
