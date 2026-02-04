"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useInView } from "motion/react"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SDOHIntroProps {
  locale: Locale
  dict: Dictionary
}

/**
 * SDOHIntro - Two-column layout with logo/text on left and image on right
 * 
 * Features the SDOH branding with a dynamic speaker image.
 */
export function SDOHIntro({ locale, dict }: SDOHIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: "-100px" })

  return (
    <section ref={containerRef} className="py-12 sm:py-16 lg:py-20 bg-white relative overflow-hidden">
      {/* Subtle animated background pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-[#A31545]/5 to-transparent blur-3xl"
          animate={{
            x: [0, 20, 0],
            y: [0, -10, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-bl from-[#FF6B35]/5 to-transparent blur-3xl"
          animate={{
            x: [0, -20, 0],
            y: [0, 10, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* Left Column - Logo inline with content */}
          <div className="order-2 lg:order-1 flex flex-col justify-center">
            {/* Logo + Header Row */}
            <div className="flex items-start gap-4 sm:gap-6 mb-6 lg:mb-8">
              {/* SVG Logo - Compact */}
              <motion.div 
                className="relative flex-shrink-0"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative w-[100px] sm:w-[120px]">
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                    alt={dict?.sdoh?.title || "¿Qué es SDOH?"}
                    width={120}
                    height={120}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </motion.div>

              {/* Big Bold Header - 80% stat */}
              <motion.h2 
                className="text-2xl sm:text-3xl lg:text-4xl font-black leading-[1.1] tracking-tight text-neutral-900"
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {locale === "es" 
                  ? "EL 80% DE LOS RESULTADOS DE SALUD ESTÁN DETERMINADOS POR LOS SDOH"
                  : "80% OF HEALTH OUTCOMES ARE DRIVEN BY SDOH"
                }
              </motion.h2>
            </div>

            {/* SDOH Definition Content */}
            <div className="space-y-6 lg:space-y-8">
              {/* Sub Header */}
              <motion.p 
                className="text-base sm:text-lg lg:text-xl leading-[1.6] text-neutral-600 font-normal"
                initial={{ opacity: 0, y: 12 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {locale === "es"
                  ? "El acceso a vivienda segura, escuelas de calidad, transporte confiable, alimentos saludables, ingresos estables y atención médica cercana determinan directamente los resultados y la esperanza de vida."
                  : "Access to safe housing, quality schools, reliable transportation, healthy food, stable income, and nearby care all directly determine outcomes and life expectancy."
                }
              </motion.p>

              {/* Definition Box */}
              <motion.div 
                className="relative"
                initial={{ opacity: 0, y: 12 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="relative p-5 sm:p-6 lg:p-8 border-l-4 border-[#A31545] bg-neutral-50">
                  <p className="text-base sm:text-lg lg:text-xl leading-[1.7] text-neutral-700 font-normal">
                    {locale === "es" ? (
                      <>
                        {"Eso es lo que son los"}{" "}
                        <span className="font-semibold text-[#A31545]">
                          {"Determinantes Sociales de la Salud (SDOH)"}
                        </span>
                        {": las condiciones del mundo real que impactan cuánto tiempo y qué tan bien vivimos."}
                      </>
                    ) : (
                      <>
                        {"That's what"}{" "}
                        <span className="font-semibold text-[#A31545]">
                          {"Social Determinants of Health (SDOH)"}
                        </span>{" "}
                        {"are: the real-world conditions that impact how long—and how well—we live."}
                      </>
                    )}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right Column - Image */}
          <motion.div 
            className="order-1 lg:order-2 relative flex items-center"
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-full">
              {/* Decorative frame */}
              <div className="absolute -inset-3 border border-[#A31545]/20 -z-10" />
              <div className="absolute -inset-3 border border-[#FF6B35]/20 translate-x-2 translate-y-2 -z-10" />
              
              {/* Image container - adjusted aspect ratio to match text height */}
              <div className="relative aspect-[5/4] lg:aspect-[4/3] overflow-hidden bg-neutral-100">
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-marcos.jpg"
                  alt="Awareness Drives Innovation - SDOH Speaker"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                
                {/* Accent corners */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-[#A31545]" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-[#FF6B35]" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
