"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, useInView, useScroll, useTransform } from "motion/react"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SDOHIntroProps {
  locale: Locale
  dict: Dictionary
}

/**
 * SDOHIntro - Dynamic hero introduction with animated SVG logo
 * 
 * Features parallax scrolling and scale effects for a more dynamic feel.
 */
export function SDOHIntro({ locale, dict }: SDOHIntroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: "-100px" })
  
  // Parallax scroll effect
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  })
  
  // Transform values for dynamic effects
  const logoScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.95])
  const logoY = useTransform(scrollYProgress, [0, 0.5, 1], [30, 0, -20])
  const textOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.5])

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

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
        <FadeIn>
          {/* Dynamic SVG Logo with parallax */}
          <motion.div 
            className="relative mb-10 sm:mb-12 lg:mb-16 text-center"
            style={{ scale: logoScale, y: logoY }}
          >
            <motion.div 
              className="relative max-w-lg mx-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Animated glow behind logo */}
              <motion.div
                className="absolute inset-0 -m-8 rounded-full bg-gradient-to-r from-[#A31545]/10 via-transparent to-[#FF6B35]/10 blur-2xl"
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
                width={500}
                height={250}
                className="w-full h-auto relative z-10"
                priority
              />
            </motion.div>
          </motion.div>

          {/* Subtitle with scroll-based opacity */}
          <motion.div 
            className="relative max-w-3xl mx-auto text-center mb-12 sm:mb-16"
            style={{ opacity: textOpacity }}
          >
            <motion.p 
              className="text-lg sm:text-xl text-neutral-500 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {dict?.sdoh?.subtitle || "(Or in plain terms: What the Heck is Social Determinants of Health?)"}
            </motion.p>
          </motion.div>

          {/* SDOH Definition Content */}
          <div className="space-y-8 sm:space-y-10 max-w-4xl mx-auto">
            <motion.p 
              className="text-lg sm:text-xl md:text-2xl leading-relaxed text-neutral-600 text-center"
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
              <div className="relative p-6 sm:p-8 md:p-10 border border-neutral-200 bg-neutral-50">
                {/* Animated accent lines */}
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

                <p className="text-lg sm:text-xl md:text-2xl leading-relaxed text-neutral-700 text-center">
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
        </FadeIn>
      </div>
    </section>
  )
}
