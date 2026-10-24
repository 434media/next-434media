"use client"

import Image from "next/image"
import { motion } from "motion/react"
import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react"
import Link from "next/link"

// Moved from the Digital Canvas site in 2026-10. The session took place on
// June 18, 2026, so the page is kept as the record of it: registration is
// closed (its route and emails were not carried over) and attendees are pointed
// to the feedback form.
//
// Carroll Strategy & Operations color system — used on this event page only.
// Light background stays; the Digital Canvas green/magenta accents are
// replaced with Carroll Emerald, Coral, Executive Navy, and Professional Gray.
// Only EMERALD and CORAL are exported via JS — they're passed into inline
// style props for dynamic backgrounds/borders. The other Carroll values
// (Navy #041C32, Gray #6F7883, Border #E1E4EA) live inline in Tailwind
// arbitrary classes (e.g. text-[#041C32]) since Tailwind can't read JS vars.
const EMERALD = "#1AAD9B" // positive accent: success, selection, structural bullets
const CORAL = "#FF5757" // sparingly: CTAs, urgency eyebrows

const FLYER_URL =
  "https://firebasestorage.googleapis.com/v0/b/groovy-ego-462522-v2.firebasestorage.app/o/digitalcanvas%2FInvitation%20only%20Limited%20Executive%20Seating.PNG?alt=media"

const QUESTIONS = [
  "How does AI support business strategy?",
  "Where can AI create measurable ROI?",
  "How do you implement AI across the enterprise?",
]

export default function LeadWithOpsPage() {
  return (
    <main className="bg-white min-h-screen text-[#041C32]">
      {/* Full-page split layout — content scrolls on the left, form is pinned on the right (desktop). */}
      <section className="relative pt-28 md:pt-32 pb-20 md:pb-28 px-6">
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ backgroundImage: `linear-gradient(to right, transparent, ${CORAL}55, transparent)` }}
        />

        <div className="relative z-10 max-w-7xl mx-auto">
          {/* No items-start — the right column must stretch to match the left's
              height so the sticky form has room to slide for the full page scroll. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

            {/* LEFT — full scrollable narrative (hero text → flyer → speaker bio) */}
            <div className="lg:col-span-7 space-y-12 md:space-y-14">

              {/* Eyebrow row */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-3 flex-wrap"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: EMERALD }} />
                  <span className="font-(family-name:--font-geist-pixel-square) text-[10px] md:text-xs uppercase tracking-[0.4em] text-[#041C32] font-bold">
                    Executive Working Lunch
                  </span>
                </span>
                <span className="hidden sm:inline-block h-px w-6 bg-[#E1E4EA]" />
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: CORAL }}
                  />
                  <span
                    className="font-(family-name:--font-geist-pixel-square) text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold"
                    style={{ color: CORAL }}
                  >
                    Held June 18, 2026
                  </span>
                </span>
              </motion.div>

              {/* H1 */}
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="font-(family-name:--font-geist-pixel-square) text-3xl md:text-5xl lg:text-6xl text-[#041C32] uppercase tracking-wide leading-[1.1] font-black"
              >
                Lead with Ops.{" "}
                <span className="text-[#6F7883] font-medium block">Layer in AI.</span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.18 }}
                className="text-[#6F7883] text-base md:text-lg leading-relaxed max-w-2xl"
              >
                A practical executive working lunch with{" "}
                <span className="text-[#041C32] font-medium">Adam Carroll, Founder of Carroll Strategy &amp; Operations</span>{" "}
                — clarity on aligning AI initiatives with business strategy, operational priorities, and measurable outcomes.
              </motion.p>

              {/* Event details strip */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.28 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E1E4EA] border border-[#E1E4EA]"
              >
                <div className="bg-white p-5 flex items-center gap-3">
                  <Calendar className="w-4 h-4 shrink-0 text-[#041C32]" />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6F7883] mb-1">Date</p>
                    <p className="text-[#041C32] text-sm font-semibold">June 18, 2026</p>
                  </div>
                </div>
                <div className="bg-white p-5 flex items-center gap-3">
                  <Clock className="w-4 h-4 shrink-0 text-[#041C32]" />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6F7883] mb-1">Time</p>
                    <p className="text-[#041C32] text-sm font-semibold">11:30 AM &ndash; 1:00 PM</p>
                  </div>
                </div>
                <div className="bg-white p-5 flex items-center gap-3">
                  <MapPin className="w-4 h-4 shrink-0 text-[#041C32]" />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6F7883] mb-1">Location</p>
                    <p className="text-[#041C32] text-sm font-semibold">VelocityTX</p>
                  </div>
                </div>
              </motion.div>

              {/* Mobile-only jump-to-form CTA */}
              <motion.a
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.36 }}
                href="/workshops/lead-with-ops/feedback"
                className="lg:hidden group inline-flex items-center justify-between gap-3 text-[#041C32] px-6 py-4 text-xs uppercase tracking-[0.2em] font-bold hover:bg-[#041C32] hover:text-white transition-colors duration-200"
                style={{ backgroundColor: CORAL }}
              >
                Attended? Share feedback
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </motion.a>

              {/* Three questions — the WHY */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
              >
                <p
                  className="font-(family-name:--font-geist-pixel-square) text-[10px] md:text-xs uppercase tracking-[0.4em] mb-5 text-[#041C32] font-bold"
                >
                  What we explored
                </p>
                <ul className="space-y-3">
                  {QUESTIONS.map((q) => (
                    <li
                      key={q}
                      className="flex gap-4 pl-4 border-l-2"
                      style={{ borderLeftColor: EMERALD }}
                    >
                      <p className="text-[#041C32] text-base md:text-lg font-medium leading-snug">
                        {q}
                      </p>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Format note */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
                className="border-l-2 border-[#041C32] pl-5 max-w-2xl"
              >
                <p className="text-[#041C32] text-base md:text-lg leading-relaxed font-medium">
                  Not a product demo or software pitch.
                </p>
                <p className="text-[#6F7883] text-sm md:text-base leading-relaxed mt-2">
                  An executive-level conversation for CEOs, Presidents, Operators, and business leaders looking for clarity before making AI investments.
                </p>
              </motion.div>

              {/* Flyer — proof visual within the scroll narrative */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
                className="relative border border-[#E1E4EA] overflow-hidden"
              >
                <div className="relative aspect-4/5 w-full max-w-md">
                  <Image
                    src={FLYER_URL}
                    alt="Lead with Ops. Layer in AI. — Executive Working Lunch, June 18, 2026, VelocityTX"
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 448px"
                  />
                </div>
              </motion.div>

              {/* Featured speaker expanded */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
              >
                <p
                  className="font-(family-name:--font-geist-pixel-square) text-[10px] md:text-xs uppercase tracking-[0.4em] mb-4 text-[#041C32] font-bold"
                >
                  Featured speaker
                </p>
                <h2 className="font-(family-name:--font-geist-pixel-square) text-2xl md:text-4xl text-[#041C32] uppercase tracking-wide leading-tight mb-5">
                  Adam Carroll.{" "}
                  <span className="text-[#6F7883] font-medium">
                    Founder, Carroll Strategy &amp; Operations.
                  </span>
                </h2>
                <p className="text-[#6F7883] text-sm md:text-base leading-relaxed mb-5 max-w-2xl">
                  Adam works with operators to align technology decisions with business outcomes. The session focuses on practical frameworks — how to lead with operations, layer in AI where it creates measurable ROI, and avoid investing in tools without strategic anchor.
                </p>
                <p className="text-[#6F7883] text-sm md:text-base leading-relaxed max-w-2xl">
                  Designed for CEOs, Presidents, Operators, Founders, and business leaders. Off-the-record, peer-level conversation.
                </p>
              </motion.div>

              {/* Trust signal — Presented by */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-3 pt-6 border-t border-[#E1E4EA]"
              >
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#6F7883]">
                  Presented by
                </span>
                <span className="font-(family-name:--font-geist-pixel-square) text-xs md:text-sm uppercase tracking-wide text-[#041C32]">
                  Digital Canvas · 434 Media
                </span>
              </motion.div>

              {/* Contact fallback */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
                className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#6F7883]"
              >
                Questions? <a href="mailto:VIP@434MEDIA.COM" className="text-[#041C32] hover:underline font-semibold">VIP@434MEDIA.COM</a>
              </motion.p>
            </div>

            {/* RIGHT — registration has closed; the panel stays pinned on desktop */}
            <div className="lg:col-span-5" id="register">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="lg:sticky lg:top-24"
              >
                <div className="border border-[#E1E4EA] bg-white p-7 md:p-9 relative">
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: EMERALD }}
                    aria-hidden="true"
                  />
                  <span
                    className="inline-block font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] font-bold mb-4 px-2.5 py-1 text-[#041C32]"
                    style={{ backgroundColor: EMERALD }}
                  >
                    Registration closed
                  </span>
                  <h2 className="font-(family-name:--font-geist-pixel-square) text-2xl md:text-3xl text-[#041C32] uppercase tracking-wide leading-tight mb-4">
                    This session{" "}
                    <span className="text-[#6F7883] font-medium">has taken place.</span>
                  </h2>
                  <p className="text-[#6F7883] text-sm md:text-base leading-relaxed mb-6">
                    This working lunch took place on June 18, 2026 at VelocityTX. If you attended, ninety seconds of
                    feedback shapes the next session.
                  </p>
                  <Link
                    href="/workshops/lead-with-ops/feedback"
                    className="group flex items-center justify-between gap-3 w-full text-[#041C32] font-(family-name:--font-geist-pixel-square) font-bold text-xs uppercase tracking-widest py-4 px-6 transition-all hover:bg-[#041C32] hover:text-white"
                    style={{ backgroundColor: CORAL }}
                  >
                    Share feedback
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                  <p className="text-[#6F7883] text-sm leading-relaxed mt-6">
                    Interested in the next session? Write to{" "}
                    <a href="mailto:VIP@434MEDIA.COM" className="text-[#041C32] hover:underline font-semibold">
                      VIP@434MEDIA.COM
                    </a>
                    .
                  </p>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </section>
    </main>
  )
}
