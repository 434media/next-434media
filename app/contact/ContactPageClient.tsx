"use client"

import { motion } from "motion/react"
import { useEffect, useState, useRef, useCallback } from "react"
import { ContactForm } from "@/components/ContactForm"

// Single-purpose contact page. Conversion is the only job.
// Removes the black-box feeling after submitting a contact form.
const NEXT_STEPS = [
  { label: "01", title: "Reply within one business day", body: "We read every inbound personally." },
  { label: "02", title: "30-min discovery call", body: "Goals, scope, timing, and fit. No pitch deck." },
  { label: "03", title: "Scoped proposal", body: "Concrete deliverables, milestones, and pricing within a week." },
]

const trustedByLogos = [
  {
    name: "Builders VC",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/builders-dark.svg",
    height: "h-8 md:h-9",
  },
  {
    name: "Alamo Angels",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/angels.png",
    height: "h-6 md:h-7",
  },
  {
    name: "Digital Canvas",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/digital-canvas-ymas.svg",
    invert: true,
    height: "h-6 md:h-7",
  },
  {
    name: "Univision",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/univision-logo.svg",
    height: "h-7 md:h-9",
  },
  {
    name: "TXMX Boxing",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/TXMXBack.svg",
    invert: true,
    height: "h-6 md:h-8",
  },
  {
    name: "VelocityTX",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Sponsor%20Logos/VelocityTX%20Logo%20MAIN%20RGB%20(1).png",
    height: "h-6 md:h-9",
  },
  {
    name: "SDOH",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/que.svg",
    height: "h-7 md:h-9",
  },
  {
    name: "The Health Cell",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/healthcell.png",
    height: "h-7 md:h-8",
  },
  {
    name: "Mission Road Ministries",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/missionroad.svg",
    height: "h-6 md:h-9",
  },
  {
    name: "Methodist Healthcare Ministries",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/mhm.png",
    height: "h-9 md:h-10",
  },
  {
    name: "Tech Bloc",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/TB%20Full%20Logo.png",
    height: "h-9 md:h-12",
  },
  {
    name: "Learn2AI",
    logo: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/Learn2ai.svg",
    height: "h-6 md:h-7",
  },
]

export function ContactPageClient() {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Dot distortion shader
  const drawDots = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    const gap = 24
    const dotRadius = 1
    const alpha = 0.12

    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    for (let x = gap; x < w; x += gap) {
      for (let y = gap; y < h; y += gap) {
        ctx.beginPath()
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawDots()

    const onResize = () => drawDots()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [drawDots])

  return (
    <div className="min-h-dvh bg-white text-gray-900 overflow-hidden pt-10">
      <div className="relative min-h-dvh flex items-center py-4 lg:py-6">
        {/* Dot Distortion Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-linear-to-br from-gray-50 via-white to-gray-50" />
        </div>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 xl:gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-5 lg:space-y-6 mt-16 sm:mt-20 lg:mt-0"
            >
              {/* Main Headline */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-4 lg:space-y-5"
              >
                <motion.h1
                  className="font-ggx88 font-black text-5xl lg:text-6xl xl:text-7xl text-gray-900 leading-[0.9] tracking-tighter"
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="block"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    Bold Stories.
                  </motion.span>
                  <motion.span
                    className="block"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    Proven Impact.
                  </motion.span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="font-geist-sans text-base text-gray-500 leading-relaxed font-normal max-w-md"
                >
                  From brand campaigns, to event production, we help the world&apos;s most innovative firms find their voice and amplify their impact through bold storytelling and experiences.
                </motion.p>
              </motion.div>

              {/* Trust Indicator - Logo Carousel (mobile) / Grid (desktop) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.5 }}
                className="pt-4 border-t border-gray-100"
              >
                <p className="font-geist-mono text-[11px] text-gray-500 font-semibold uppercase tracking-[0.22em] mb-3.5">
                  Producing with <span className="text-gray-900">enterprise &amp; civic brands</span>
                </p>

                {/* Mobile: scrolling marquee */}
                <div className="relative overflow-hidden lg:hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-linear-to-r from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-linear-to-l from-white to-transparent z-10 pointer-events-none" />
                  
                  <motion.div
                    className="flex items-center gap-8"
                    animate={{
                      x: [0, -1200],
                    }}
                    transition={{
                      x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 25,
                        ease: "linear",
                      },
                    }}
                  >
                    {[...trustedByLogos, ...trustedByLogos].map((company, index) => (
                      <div
                        key={`${company.name}-${index}`}
                        className="shrink-0 h-6 flex items-center justify-center"
                      >
                        <img
                          src={company.logo}
                          alt={`${company.name} logo`}
                          className={`${company.height} w-auto object-contain opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300${company.invert ? ' invert' : ''}`}
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Desktop: logo grid */}
                <div className="hidden lg:grid grid-cols-3 xl:grid-cols-4 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {trustedByLogos.map((company) => (
                    <div
                      key={company.name}
                      className="bg-white flex items-center justify-center p-5 xl:p-6 group"
                    >
                      <img
                        src={company.logo}
                        alt={`${company.name} logo`}
                        className={`${company.height} w-auto object-contain opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300${company.invert ? ' invert' : ''}`}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-6 lg:mt-0"
            >
              <div className="relative">
                <ContactForm
                  isVisible={mounted}
                  className="relative z-10 w-full"
                />
              </div>

              {/* What happens next — kills the black-box anxiety post-submit */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 rounded-lg bg-gray-50 p-5 ring-1 ring-gray-200"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <p className="font-geist-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    What happens next
                  </p>
                  <a
                    href="mailto:build@434media.com"
                    className="font-geist-mono text-[10px] font-medium tracking-wide text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    build@434media.com
                  </a>
                </div>
                <ol className="space-y-2.5">
                  {NEXT_STEPS.map((step) => (
                    <li key={step.label} className="flex gap-3">
                      <span className="font-geist-mono text-[11px] font-semibold tabular-nums text-gray-400 pt-0.5 shrink-0">
                        {step.label}
                      </span>
                      <div>
                        <p className="font-geist-sans text-[13px] font-semibold text-gray-900 leading-tight">
                          {step.title}
                        </p>
                        <p className="font-geist-sans text-[12px] text-gray-500 leading-snug mt-0.5">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
