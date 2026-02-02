"use client"

import { useRef } from "react"
import { motion, useInView } from "motion/react"
import type { Locale } from "../../../i18n-config"

interface SDOHPillarsProps {
  locale: Locale
}

/**
 * SDOHPillars - Three-column Learn/Build/Sustain section
 * 
 * Inspired by the MHMxVelocity Impact Report page 2 design
 * showcasing the three stages of growth in the Community Health Accelerator.
 */
export default function SDOHPillars({ locale }: SDOHPillarsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const pillars = locale === "es" ? [
    {
      number: "01",
      title: "APRENDER",
      subtitle: "Serie de Seminarios",
      tagline: "Conciencia a través de la educación",
      color: "bg-neutral-100",
      textColor: "text-neutral-900",
      accentColor: "bg-[#A31545]",
      icon: (
        <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="24" cy="16" r="8" />
          <path d="M24 28v12M16 36h16" />
          <path d="M12 44h24" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      number: "02",
      title: "CONSTRUIR",
      subtitle: "Startup Bootcamp",
      tagline: "Ideas en innovación",
      color: "bg-[#8B1E3F]",
      textColor: "text-white",
      accentColor: "bg-[#FF6B35]",
      icon: (
        <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="8" y="20" width="12" height="20" />
          <rect x="18" y="12" width="12" height="28" />
          <rect x="28" y="8" width="12" height="32" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "SOSTENER",
      subtitle: "Community Health Accelerator",
      tagline: "Mentoría en impacto",
      color: "bg-[#FF6B35]",
      textColor: "text-white",
      accentColor: "bg-white",
      icon: (
        <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M24 8v8M24 32v8" />
          <path d="M16 24h-8M40 24h-8" />
          <path d="M18 18l-4-4M34 34l-4-4M18 30l-4 4M34 14l-4 4" />
          <circle cx="24" cy="24" r="6" />
        </svg>
      ),
    },
  ] : [
    {
      number: "01",
      title: "LEARN",
      subtitle: "Speaker Seminar Series",
      tagline: "Awareness through education",
      color: "bg-neutral-100",
      textColor: "text-neutral-900",
      accentColor: "bg-[#A31545]",
      icon: (
        <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="24" cy="16" r="8" />
          <path d="M24 28v12M16 36h16" />
          <path d="M12 44h24" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      number: "02",
      title: "BUILD",
      subtitle: "Startup Bootcamp",
      tagline: "Ideas into innovation",
      color: "bg-[#8B1E3F]",
      textColor: "text-white",
      accentColor: "bg-[#FF6B35]",
      icon: (
        <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="8" y="20" width="12" height="20" />
          <rect x="18" y="12" width="12" height="28" />
          <rect x="28" y="8" width="12" height="32" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "SUSTAIN",
      subtitle: "Community Health Accelerator",
      tagline: "Mentorship into impact",
      color: "bg-[#FF6B35]",
      textColor: "text-white",
      accentColor: "bg-white",
      icon: (
        <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M24 8v8M24 32v8" />
          <path d="M16 24h-8M40 24h-8" />
          <path d="M18 18l-4-4M34 34l-4-4M18 30l-4 4M34 14l-4 4" />
          <circle cx="24" cy="24" r="6" />
        </svg>
      ),
    },
  ]

  const introText = locale === "es"
    ? "El Community Health Accelerator avanzó a través de tres etapas de crecimiento:"
    : "The Community Health Accelerator moved through three stages of growth:"

  return (
    <section ref={ref} className="py-20 sm:py-28 lg:py-32 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Section intro */}
        <motion.div
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-lg sm:text-xl text-neutral-500 max-w-2xl mx-auto">
            {introText}
          </p>
        </motion.div>

        {/* Three Pillars Grid */}
        <div className="grid md:grid-cols-3 gap-0 overflow-hidden">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.number}
              className={`${pillar.color} ${pillar.textColor} p-8 sm:p-10 lg:p-12 relative`}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${pillar.accentColor}`} />
              
              {/* Pillar Title */}
              <div className="mb-8">
                <h3 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                  {pillar.title}<span className="text-[#FF6B35]">.</span>
                </h3>
              </div>

              {/* Icon */}
              <div className={`w-20 h-20 rounded-full ${pillar.accentColor} ${pillar.textColor === "text-white" ? "text-neutral-900" : "text-white"} flex items-center justify-center mb-8`}>
                {pillar.icon}
              </div>

              {/* Content */}
              <div>
                <h4 className="text-lg font-bold mb-2">{pillar.subtitle}</h4>
                <div className={`w-12 h-0.5 ${pillar.accentColor} mb-4`} />
                <p className={`text-sm leading-relaxed ${pillar.textColor === 'text-white' ? 'text-white/70' : 'text-neutral-500'}`}>
                  {pillar.tagline}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
