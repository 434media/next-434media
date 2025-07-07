"use client"

import { useRef, useEffect, useState } from "react"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { FadeIn } from "../FadeIn"
import SeminarSeries from "./SeminarSeries"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SDOHMissionProps {
  locale: Locale
  dict: Dictionary
}

export function SDOHMission({ locale, dict }: SDOHMissionProps) {
  const missionRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const definitionRef = useRef<HTMLDivElement>(null)
  const partnershipRef = useRef<HTMLDivElement>(null)

  const heroInView = useInView(heroRef, { once: true, amount: 0.3 })
  const definitionInView = useInView(definitionRef, { once: true, amount: 0.2 })
  const partnershipInView = useInView(partnershipRef, { once: true, amount: 0.2 })

  // Scroll-driven animations for performance (removed from partnership section)
  const { scrollYProgress } = useScroll({
    target: missionRef,
    offset: ["start end", "end start"],
  })

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  })

  // Performance-optimized transforms (removed partnership parallax)
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])
  const heroScale = useTransform(heroScrollProgress, [0, 0.5, 1], [0.95, 1, 1.05])
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.8])

  // Track when dictionary or locale changes
  const [, setKey] = useState(0)

  // Force re-render when locale or dictionary changes
  useEffect(() => {
    setKey((prev) => prev + 1)
    console.log(`SDOHMission: Locale changed to ${locale}`)
    console.log(`SDOHMission: Dictionary available:`, !!dict)
  }, [locale, dict])

  console.log("SDOHMission rendering with locale:", locale, "and dict available:", !!dict)

  // Ensure we have the partnership dictionary or provide fallbacks
  const partnershipDict = dict?.sdoh?.partnership || {
    label: "STRATEGIC PARTNERSHIP",
    title: "Powered by VelocityTX & Methodist Healthcare Ministries",
    description:
      "In partnership with VelocityTX and Methodist Healthcare Ministries, the Community Health Accelerator program connects education, entrepreneurship, and innovation through three core components.",
    velocityAlt: "VelocityTX Logo",
    methodistAlt: "Methodist Healthcare Ministries Logo",
  }

  return (
    <section ref={missionRef} className="relative py-16 sm:py-24 overflow-hidden">
      {/* Optimized background with scroll-driven parallax */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 bg-gradient-to-br from-white via-cyan-50/30 to-yellow-50/20"
      >
        {/* Static background elements for performance */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-200/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-l from-yellow-200/20 to-transparent rounded-full blur-3xl" />
      </motion.div>

      <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10">
        <FadeIn>
          {/* Hero SDOH Introduction - Enhanced Impact */}
          <motion.div
            ref={heroRef}
            style={{
              scale: heroScale,
              opacity: heroOpacity,
            }}
            className="relative mb-20 sm:mb-24 text-center"
          >
            {/* Dramatic title with enhanced gradient and effects */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={heroInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative mb-8 sm:mb-12"
            >
              {/* Background glow effect */}
              <div className="absolute inset-0 blur-3xl opacity-30">
                <h1 className="text-4xl sm:text-6xl md:text-7xl xl:text-8xl font-black tracking-tight leading-none text-cyan-400">
                  {dict?.sdoh?.title || "¿Qué es SDOH?"}
                </h1>
              </div>

              {/* Main title with enhanced gradient */}
              <motion.h1
                initial={{ backgroundPosition: "0% 50%" }}
                animate={heroInView ? { backgroundPosition: "100% 50%" } : {}}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                className="relative text-4xl sm:text-6xl md:text-7xl xl:text-8xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-cyan-500 to-blue-600 bg-[length:200%_100%]"
                style={{
                  textShadow: "0 0 40px rgba(6, 182, 212, 0.3)",
                  filter: "drop-shadow(0 4px 20px rgba(6, 182, 212, 0.2))",
                }}
              >
                {dict?.sdoh?.title || "¿Qué es SDOH?"}
              </motion.h1>

              {/* Animated underline */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={heroInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1.5, delay: 0.5 }}
                className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full"
                style={{ width: "60%" }}
              />
            </motion.div>

            {/* Enhanced subtitle with better typography */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="relative max-w-4xl mx-auto"
            >
              <p className="text-lg sm:text-xl md:text-2xl text-neutral-600 font-medium leading-relaxed tracking-wide px-4">
                {dict?.sdoh?.subtitle || "(Or in plain terms: What the Heck is Social Determinants of Health?)"}
              </p>

              {/* Decorative elements */}
              <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 w-1 h-16 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60" />
              <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 w-1 h-16 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60" />
            </motion.div>
          </motion.div>

          {/* SDOH Definition Content - Moved directly after hero */}
          <div ref={definitionRef} className="relative mb-24 sm:mb-32">
            {/* Main text with enhanced presentation */}
            <div className="space-y-12 max-w-5xl mx-auto">
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={definitionInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-xl sm:text-2xl md:text-3xl leading-relaxed text-neutral-700 font-light text-center"
              >
                {dict?.sdoh?.intro1 ||
                  "Most of what affects our health doesn't happen in a hospital—it happens in our everyday lives. Where we live, what we eat, how we get to work or school, whether we feel safe, supported, and seen... these things shape our health long before a doctor ever gets involved."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={definitionInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="relative"
              >
                {/* Enhanced background with gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 rounded-3xl p-1">
                  <div className="w-full h-full bg-gradient-to-r from-cyan-50/80 via-white to-cyan-50/80 rounded-3xl" />
                </div>

                <div className="relative p-10 sm:p-12 md:p-16 rounded-3xl">
                  <p className="text-xl sm:text-2xl md:text-3xl leading-relaxed text-neutral-700 font-light text-center">
                    {locale === "es" ? (
                      <>
                        {dict?.sdoh?.intro2Part1 || "Eso es lo que son los"}{" "}
                        <motion.span
                          initial={{ backgroundPosition: "0% 50%" }}
                          animate={definitionInView ? { backgroundPosition: "100% 50%" } : {}}
                          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                          className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 bg-[length:200%_100%]"
                          style={{
                            textShadow: "0 2px 10px rgba(6, 182, 212, 0.2)",
                          }}
                        >
                          {dict?.sdoh?.sdohFull || "Determinantes Sociales de la Salud (SDOH)"}
                        </motion.span>{" "}
                        {dict?.sdoh?.intro2Part2 ||
                          ": las condiciones del mundo real que impactan cuánto tiempo y qué tan bien vivimos."}
                      </>
                    ) : (
                      <>
                        {dict?.sdoh?.intro2Part1 || "That's what"}{" "}
                        <motion.span
                          initial={{ backgroundPosition: "0% 50%" }}
                          animate={definitionInView ? { backgroundPosition: "100% 50%" } : {}}
                          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                          className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 bg-[length:200%_100%]"
                          style={{
                            textShadow: "0 2px 10px rgba(6, 182, 212, 0.2)",
                          }}
                        >
                          {dict?.sdoh?.sdohFull || "Social Determinants of Health (SDOH)"}
                        </motion.span>{" "}
                        {dict?.sdoh?.intro2Part2 ||
                          "are: the real-world conditions that impact how long—and how well—we live."}
                      </>
                    )}
                  </p>

                  {/* Decorative corner elements */}
                  <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-cyan-400/40 rounded-tl-2xl" />
                  <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-cyan-400/40 rounded-br-2xl" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* STRATEGIC PARTNERSHIP - Enhanced Spotlight (Reduced Height) */}
          <motion.div
            ref={partnershipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={partnershipInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="relative mb-24 sm:mb-32"
          >
            {/* Partnership spotlight container */}
            <div className="relative">
              {/* Dramatic background with enhanced effects */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-900 via-cyan-800 to-cyan-900 rounded-3xl transform rotate-1 shadow-2xl" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-800 via-cyan-700 to-cyan-800 rounded-3xl shadow-2xl" />

              {/* Glowing border effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 p-1">
                <div className="w-full h-full bg-gradient-to-r from-cyan-800 via-cyan-700 to-cyan-800 rounded-3xl" />
              </div>

              {/* Main content container - Reduced padding for better viewport fit */}
              <div className="relative py-12 sm:py-16 px-8 sm:px-12 rounded-3xl overflow-hidden">
                {/* Enhanced background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:40px_40px]" />
                </div>

                {/* Redesigned layout for better logo spotlight - matching max-w-5xl */}
                <div className="relative max-w-5xl mx-auto">
                  {/* Strategic Partnership badge - centered */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={partnershipInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-center mb-8"
                  >
                    <div className="inline-flex items-center px-6 py-3 bg-white/15 backdrop-blur-sm rounded-full text-white/95 text-base font-bold tracking-wider border border-white/20 shadow-lg">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3 animate-pulse" />
                      {partnershipDict.label}
                    </div>
                  </motion.div>

                  {/* Simplified title - "Powered by" with proper Spanish translation */}
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={partnershipInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="text-3xl sm:text-4xl md:text-5xl font-bold mb-10 text-white leading-tight text-center"
                    style={{
                      textShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    {locale === "es" ? "Impulsado por" : "Powered by"}
                  </motion.h2>

                  {/* LOGO SHOWCASE - Reduced size for better viewport fit */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={partnershipInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="relative mb-10"
                  >
                    {/* Spotlight effect behind logos */}
                    <div className="absolute inset-0 bg-gradient-radial from-white/30 via-white/15 to-transparent rounded-3xl blur-2xl scale-110" />

                    {/* Logo container with clean presentation - reduced sizes */}
                    <div className="relative flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
                      {/* VelocityTX logo - Reduced size */}
                      <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={partnershipInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 1, delay: 0.8 }}
                        className="relative group"
                      >
                        <Link
                          href="https://velocitytx.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block transform hover:scale-105 transition-transform duration-300"
                        >
                          <div className="relative h-28 sm:h-32 lg:h-36 w-72 sm:w-80 lg:w-96">
                            <Image
                              src="https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+BUTTON+RGB.png"
                              alt={partnershipDict.velocityAlt ?? "VelocityTX Logo"}
                              fill
                              className="object-contain filter brightness-0 invert group-hover:brightness-110 transition-all duration-300"
                            />
                          </div>
                          {/* Enhanced glow effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 to-blue-400/0 group-hover:from-cyan-400/20 group-hover:to-blue-400/20 rounded-2xl blur-xl transition-all duration-300" />
                        </Link>
                      </motion.div>

                      {/* Enhanced connector - reduced size */}
                      <div className="relative flex lg:flex-col items-center justify-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={partnershipInView ? { scale: 1 } : {}}
                          transition={{ duration: 0.8, delay: 1 }}
                          className="flex lg:flex-col items-center gap-4"
                        >
                          {/* Connection line */}
                          <div className="w-16 lg:w-1 h-1 lg:h-16 bg-gradient-to-r lg:bg-gradient-to-b from-white/80 via-yellow-400 to-white/80 rounded-full" />

                          {/* Center connector badge */}
                          <div className="relative w-16 h-16 border-4 border-white/60 rounded-full bg-yellow-400/20 backdrop-blur-sm flex items-center justify-center">
                            <div className="w-6 h-6 bg-yellow-400 rounded-full animate-pulse" />
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full blur-lg" />
                          </div>

                          {/* Connection line */}
                          <div className="w-16 lg:w-1 h-1 lg:h-16 bg-gradient-to-r lg:bg-gradient-to-b from-white/80 via-yellow-400 to-white/80 rounded-full" />
                        </motion.div>
                      </div>

                      {/* Methodist Healthcare logo - Reduced size */}
                      <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={partnershipInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 1, delay: 1 }}
                        className="relative group"
                      >
                        <Link
                          href="https://mhm.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block transform hover:scale-105 transition-transform duration-300"
                        >
                          <div className="relative h-28 sm:h-32 lg:h-36 w-72 sm:w-80 lg:w-96">
                            <Image
                              src="https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png"
                              alt={partnershipDict.methodistAlt ?? "Methodist Healthcare Ministries Logo"}
                              fill
                              className="object-contain filter brightness-0 invert group-hover:brightness-110 transition-all duration-300"
                            />
                          </div>
                          {/* Enhanced glow effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/20 group-hover:to-cyan-400/20 rounded-2xl blur-xl transition-all duration-300" />
                        </Link>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Enhanced description with highlighted "three core components" - Using proper locale switching */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={partnershipInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="text-center"
                  >
                    <p className="text-lg sm:text-xl leading-relaxed text-white/90 mb-6">
                      {locale === "es" ? (
                        <>
                          En asociación con VelocityTX y Methodist Healthcare Ministries, el programa Community Health
                          Accelerator conecta educación, emprendimiento e innovación a través de{" "}
                          <motion.span
                            initial={{ backgroundPosition: "0% 50%" }}
                            animate={partnershipInView ? { backgroundPosition: "100% 50%" } : {}}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                            className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300 bg-[length:200%_100%] px-2 py-1 rounded-lg"
                            style={{
                              textShadow: "0 2px 10px rgba(255, 255, 0, 0.3)",
                              filter: "drop-shadow(0 2px 8px rgba(255, 255, 0, 0.2))",
                            }}
                          >
                            tres componentes principales
                          </motion.span>
                          .
                        </>
                      ) : (
                        <>
                          In partnership with VelocityTX and Methodist Healthcare Ministries, the Community Health
                          Accelerator program connects education, entrepreneurship, and innovation through{" "}
                          <motion.span
                            initial={{ backgroundPosition: "0% 50%" }}
                            animate={partnershipInView ? { backgroundPosition: "100% 50%" } : {}}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                            className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300 bg-[length:200%_100%] px-2 py-1 rounded-lg"
                            style={{
                              textShadow: "0 2px 10px rgba(255, 255, 0, 0.3)",
                              filter: "drop-shadow(0 2px 8px rgba(255, 255, 0, 0.2))",
                            }}
                          >
                            three core components
                          </motion.span>
                          .
                        </>
                      )}
                    </p>

                    {/* Call-to-action for the components - with proper Spanish translation */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={partnershipInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ duration: 0.8, delay: 1.4 }}
                      className="inline-flex items-center px-5 py-2 bg-yellow-400/20 backdrop-blur-sm rounded-full text-yellow-200 text-base font-medium border border-yellow-400/30 shadow-lg"
                    >
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse" />
                      {locale === "es" ? "Descubre cada componente a continuación" : "Discover each component below"}
                    </motion.div>
                  </motion.div>
                </div>

                {/* Enhanced decorative elements */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-radial from-cyan-400/20 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-yellow-400/20 to-transparent rounded-full blur-3xl" />

                {/* Animated corner accents */}
                <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-white/30 rounded-tl-3xl" />
                <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-white/30 rounded-br-3xl" />
              </div>
            </div>
          </motion.div>

          {/* Seminar Series Content - Component 1 */}
          <SeminarSeries locale={locale} dict={dict} />
        </FadeIn>
      </div>
    </section>
  )
}
