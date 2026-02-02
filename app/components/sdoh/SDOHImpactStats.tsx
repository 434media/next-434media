"use client"

import { useRef } from "react"
import { motion, useInView } from "motion/react"
import { ImpactStatistic, SectionTransition } from "./SectionTransition"
import type { Locale } from "../../../i18n-config"

interface SDOHImpactStatsProps {
  locale: Locale
}

/**
 * SDOHImpactStats - Impact report statistics section
 * 
 * Displays key metrics from the Community Health Accelerator program Year 2
 * with animated counters and decorative transition lines.
 * Updated with MHMxVelocity Impact Report brand colors and statistics.
 */
export default function SDOHImpactStats({ locale }: SDOHImpactStatsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  // Year 2 Impact Report Statistics
  const stats = locale === "es" ? [
    { value: 7, label: "Sesiones de Seminarios", suffix: "", prefix: "", colorScheme: "magenta" as const },
    { value: 969, label: "Miles de Visualizaciones", suffix: "K+", prefix: "", colorScheme: "orange" as const },
    { value: 1600, label: "Participantes en Seis Ciudades", suffix: "+", prefix: "", colorScheme: "magenta" as const },
    { value: 403, label: "Miles de Cuentas Alcanzadas", suffix: "K+", prefix: "", colorScheme: "orange" as const },
  ] : [
    { value: 7, label: "Speaker Sessions", suffix: "", prefix: "", colorScheme: "magenta" as const },
    { value: 969, label: "Thousand Views", suffix: "K+", prefix: "", colorScheme: "orange" as const },
    { value: 1600, label: "Participants Across Six Cities", suffix: "+", prefix: "", colorScheme: "magenta" as const },
    { value: 403, label: "Thousand Accounts Reached", suffix: "K+", prefix: "", colorScheme: "orange" as const },
  ]

  const sectionTitle = locale === "es" 
    ? "Impacto del Año 2" 
    : "Year 2 Impact"

  const sectionSubtitle = locale === "es"
    ? "Cuando la conciencia impulsa la innovación, las comunidades prosperan"
    : "When awareness drives innovation, communities thrive"

  return (
    <section ref={ref} className="py-20 sm:py-28 lg:py-32 bg-neutral-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#A31545] via-transparent to-[#FF6B35]" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#FF6B35] via-transparent to-[#A31545]" />
      </div>

      <SectionTransition variant="wave" colorScheme="mixed" maxWidth="6xl" className="px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center px-4 py-2 bg-[#A31545] text-white text-sm font-bold tracking-wider mb-6">
            <div className="w-2 h-2 bg-[#FF6B35] rounded-full mr-3" />
            {locale === "es" ? "REPORTE DE IMPACTO" : "IMPACT REPORT"}
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-neutral-900 mb-4">
            {sectionTitle}
          </h2>
          
          <div className="mx-auto w-24 h-1 bg-[#A31545] mb-6" />
          
          <p className="text-lg sm:text-xl text-neutral-500 max-w-3xl mx-auto">
            {sectionSubtitle}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 lg:gap-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              <div className="relative p-6 sm:p-8 bg-white border border-neutral-200 h-full">
                {/* Accent corner */}
                <div className={`absolute top-0 left-0 w-3 h-3 ${stat.colorScheme === "magenta" ? "bg-[#A31545]" : "bg-[#FF6B35]"}`} />
                
                <ImpactStatistic
                  value={stat.value}
                  label={stat.label}
                  suffix={stat.suffix}
                  prefix={stat.prefix || ""}
                  colorScheme={stat.colorScheme}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom tagline */}
        <motion.div
          className="text-center mt-16 sm:mt-20"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p className="text-neutral-500 text-sm font-medium tracking-wide">
            {locale === "es" 
              ? "Datos del Año 2 • Community Health Accelerator • MHM x VelocityTX"
              : "Year 2 Data • Community Health Accelerator • MHM x VelocityTX"}
          </p>
        </motion.div>
      </SectionTransition>
    </section>
  )
}
