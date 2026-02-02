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
    <section ref={containerRef} className="py-20 sm:py-28 lg:py-32 bg-white relative overflow-hidden">
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
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Logo and Text */}
          <div className="order-2 lg:order-1">
            {/* SVG Logo */}
            <motion.div 
              className="relative mb-8 sm:mb-10"
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative max-w-xs lg:max-w-[280px]">
                {/* Animated glow behind logo */}
                <motion.div
                  className="absolute inset-0 -m-4 rounded-full bg-gradient-to-r from-[#A31545]/10 via-transparent to-[#FF6B35]/10 blur-2xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                  alt={dict?.sdoh?.title || "¿Qué es SDOH?"}
                  width={400}
                  height={200}
                  className="w-full h-auto relative z-10"
                  priority
                />
              </div>
            </motion.div>

            {/* SDOH Definition Content */}
            <div className="space-y-6">
              <motion.p 
                className="text-base sm:text-lg leading-relaxed text-neutral-600"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {dict?.sdoh?.intro1 ||
                  "Most of what affects our health doesn't happen in a hospital—it happens in our everyday lives. Where we live, what we eat, how we get to work or school, whether we feel safe, supported, and seen... these things shape our health long before a doctor ever gets involved."}
              </motion.p>

              <motion.div 
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <div className="relative p-5 sm:p-6 border border-neutral-200 bg-neutral-50">
                  {/* Accent lines */}
                  <motion.div 
                    className="absolute left-0 top-0 w-1 bg-[#A31545]"
                    initial={{ height: 0 }}
                    animate={isInView ? { height: "100%" } : { height: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  />
                  <motion.div 
                    className="absolute right-0 top-0 w-1 bg-[#FF6B35]"
                    initial={{ height: 0 }}
                    animate={isInView ? { height: "100%" } : { height: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                  />

                  <p className="text-base sm:text-lg leading-relaxed text-neutral-700">
                    {locale === "es" ? (
                      <>
                        {dict?.sdoh?.intro2Part1 || "Eso es lo que son los"}{" "}
                        <span className="font-bold text-[#A31545]">
                          {dict?.sdoh?.sdohFull || "Determinantes Sociales de la Salud (SDOH)"}
                        </span>{" "}
                        {dict?.sdoh?.intro2Part2 ||
                          ": las condiciones del mundo real que impactan cuánto tiempo y qué tan bien vivimos."}
                      </>
                    ) : (
                      <>
                        {dict?.sdoh?.intro2Part1 || "That's what"}{" "}
                        <span className="font-bold text-[#A31545]">
                          {dict?.sdoh?.sdohFull || "Social Determinants of Health (SDOH)"}
                        </span>{" "}
                        {dict?.sdoh?.intro2Part2 ||
                          "are: the real-world conditions that impact how long—and how well—we live."}
                      </>
                    )}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right Column - Image */}
          <motion.div 
            className="order-2 relative"
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              {/* Decorative frame */}
              <div className="absolute -inset-4 border border-[#A31545]/20 -z-10" />
              <div className="absolute -inset-4 border border-[#FF6B35]/20 translate-x-2 translate-y-2 -z-10" />
              
              {/* Image container */}
              <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-marcos.jpg"
                  alt="Awareness Drives Innovation - SDOH Speaker"
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                
                {/* Gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-neutral-900/60 to-transparent" />
                
                {/* Accent corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#A31545]" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FF6B35]" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
