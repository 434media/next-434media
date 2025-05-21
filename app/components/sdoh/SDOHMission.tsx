"use client"

import { useRef, useEffect, useState } from "react"
import { motion, useInView } from "motion/react"
import Image from "next/image"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SDOHMissionProps {
  locale: Locale
  dict: Dictionary
}

export default function SDOHMission({ locale, dict }: SDOHMissionProps) {
  const missionRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _isInView = useInView(missionRef, { once: true, amount: 0.2 })
  const introRef = useRef<HTMLDivElement>(null)
  const introInView = useInView(introRef, { once: true, amount: 0.2 })

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
    <section ref={missionRef} className="py-16 sm:py-24 bg-gradient-to-b from-white to-neutral-50 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
        <FadeIn>
          {/* SDOH Introduction Section - Typography focused */}
          <div ref={introRef} className="relative mb-20 sm:mb-28">
            {/* Title with animated reveal and gradient */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={introInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7 }}
              className="mb-12 sm:mb-16 max-w-5xl mx-auto"
            >
              {/* Main heading with gradient */}
              <motion.h2
                initial={{ opacity: 0 }}
                animate={introInView ? { opacity: 1 } : {}}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-extrabold mb-4 sm:mb-6 tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-700"
              >
                {dict?.sdoh?.title || "¿Qué es SDOH?"}
              </motion.h2>

              {/* Subtitle with reveal animation - fixed to prevent wrapping */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={introInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-lg sm:text-xl md:text-2xl text-neutral-600 font-medium leading-snug tracking-tight whitespace-nowrap overflow-hidden text-ellipsis px-4"
              >
                {dict?.sdoh?.subtitle || "(Or in plain terms: What the Heck is Social Determinants of Health?)"}
              </motion.p>
            </motion.div>

            {/* Main text with staggered reveal */}
            <div className="space-y-8 max-w-5xl mx-auto">
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={introInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="text-lg sm:text-xl leading-relaxed text-neutral-700"
              >
                {dict?.sdoh?.intro1 ||
                  "Most of what affects our health doesn't happen in a hospital—it happens in our everyday lives. Where we live, what we eat, how we get to work or school, whether we feel safe, supported, and seen... these things shape our health long before a doctor ever gets involved."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={introInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.7 }}
                className="pl-4 border-l-4 border-cyan-500"
              >
                <p className="text-lg sm:text-xl leading-relaxed text-neutral-700">
                  {locale === "es" ? (
                    <>
                      {dict?.sdoh?.intro2Part1 || "Eso es lo que son los"}{" "}
                      <motion.span
                        initial={{ color: "#0891b2" }} // cyan-600
                        animate={introInView ? { color: ["#0891b2", "#0e7490", "#0891b2"] } : {}}
                        transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                        className="font-bold"
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
                        initial={{ color: "#0891b2" }} // cyan-600
                        animate={introInView ? { color: ["#0891b2", "#0e7490", "#0891b2"] } : {}}
                        transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                        className="font-bold"
                      >
                        {dict?.sdoh?.sdohFull || "Social Determinants of Health (SDOH)"}
                      </motion.span>{" "}
                      {dict?.sdoh?.intro2Part2 ||
                        "are: the real-world conditions that impact how long—and how well—we live."}
                    </>
                  )}
                </p>
              </motion.div>
            </div>
          </div>

          {/* Partnership Banner */}
          <div className="relative mb-16 sm:mb-24 rounded-2xl overflow-hidden shadow-2xl transform hover:scale-[1.01] transition-transform duration-500">
            {/* Background gradient with subtle pattern */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-700 to-cyan-600 opacity-95">
              <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
            </div>

            {/* Main content */}
            <div className="relative py-10 sm:py-12 px-6 sm:px-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Text content */}
                <div className="text-white max-w-2xl">
                  <div className="mb-6">
                    <div className="inline-block px-4 py-1 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-3 border border-white/20">
                      {partnershipDict.label}
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-white">
                      {partnershipDict.title}
                    </h2>
                    <p className="text-white/90 text-base sm:text-lg">{partnershipDict.description}</p>
                  </div>
                </div>

                {/* Partner logos section */}
                <div className="flex flex-col items-center space-y-6 bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                  {/* VelocityTX logo */}
                  <div className="relative h-16 w-48 bg-white rounded-lg p-3 shadow-lg transform hover:scale-105 transition-transform">
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+BUTTON+RGB.png"
                      alt={partnershipDict.velocityAlt ?? "VelocityTX Logo"}
                      fill
                      className="object-contain p-2"
                    />
                  </div>

                  {/* Connector line */}
                  <div className="h-8 w-0.5 bg-gradient-to-b from-white/80 to-white/30"></div>

                  {/* Methodist Healthcare logo */}
                  <div className="relative h-16 w-48 bg-white rounded-lg p-3 shadow-lg transform hover:scale-105 transition-transform">
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png"
                      alt={partnershipDict.methodistAlt ?? "Methodist Healthcare Ministries Logo"}
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500 rounded-full filter blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-[100px] opacity-20 translate-y-1/2 -translate-x-1/2"></div>

            {/* Animated dots */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-1/4 left-1/4 w-2 h-2 bg-white rounded-full animate-ping"
                style={{ animationDuration: "3s" }}
              ></div>
              <div
                className="absolute top-3/4 right-1/4 w-2 h-2 bg-white rounded-full animate-ping"
                style={{ animationDuration: "4s" }}
              ></div>
              <div
                className="absolute top-1/2 right-1/3 w-2 h-2 bg-white rounded-full animate-ping"
                style={{ animationDuration: "5s" }}
              ></div>
            </div>
          </div>

          {/* Main Content - Updated with component number */}
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center mb-16 sm:mb-24">
            <div className="order-2 md:order-1">
              {/* Updated heading with component number */}
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-4 shadow-lg">
                  1
                </div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600">
                  {dict?.sdoh?.seminar?.title || "Seminar + Speaker Series"}
                </h2>
              </div>

              <div className="space-y-6 text-neutral-700">
                <p className="text-lg sm:text-xl leading-relaxed">
                  {locale === "es" ? (
                    <>
                      <span className="font-bold text-cyan-600">{dict?.sdoh?.title || "¿Qué es SDOH?"}</span>{" "}
                      {dict?.sdoh?.seminar?.description1 ||
                        "es un programa diseñado para desglosar este tema grande y a menudo mal entendido en un lenguaje cotidiano, y mostrar cómo los líderes locales, innovadores y emprendedores pueden convertir la conciencia en acción."}
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-cyan-600">¿Qué es SDOH?</span>{" "}
                      {dict?.sdoh?.seminar?.description1 ||
                        "is a program designed to break down this big, often misunderstood topic into everyday language—and show how local leaders, innovators, and entrepreneurs can turn awareness into action."}
                    </>
                  )}
                </p>

                <p className="text-lg sm:text-xl leading-relaxed">
                  {locale === "es" ? (
                    <>
                      {dict?.sdoh?.seminar?.description2 ||
                        "Creemos que al comprender las causas fundamentales de los resultados de salud"}{" "}
                      <span className="italic font-medium">{dict?.sdoh?.seminar?.causa || "la causa principal"}</span>
                      {dict?.sdoh?.seminar?.description2End ||
                        "—podemos inspirar a más personas a construir el futuro de la salud aquí mismo en nuestras comunidades."}
                    </>
                  ) : (
                    <>
                      {dict?.sdoh?.seminar?.description2 ||
                        "We believe that by understanding the root causes of health outcomes"}
                      —<span className="italic font-medium">{dict?.sdoh?.seminar?.causa || "la causa principal"}</span>
                      {dict?.sdoh?.seminar?.description2End ||
                        "—we can inspire more people to build the future of health right here in our communities."}
                    </>
                  )}
                </p>

                <div className="bg-gradient-to-r from-yellow-50 to-white p-6 rounded-xl border-l-4 border-yellow-400 shadow-sm">
                  <p className="text-lg leading-relaxed">
                    {dict?.sdoh?.seminar?.highlight ||
                      "The series features live events and panels designed to spark conversation, raise awareness, and make complex health topics feel approachable and relevant—especially for aspiring founders, healthcare workers, educators, and community changemakers."}
                  </p>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 relative">
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-100 rounded-full opacity-20 animate-pulse"></div>
              <div
                className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-100 rounded-full opacity-20 animate-pulse"
                style={{ animationDelay: "1s" }}
              ></div>

              {/* Main illustration */}
              <div className="relative z-10 shadow-xl overflow-hidden rounded-2xl">
                <div className="aspect-square relative">
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                    alt={(dict?.sdoh?.seminar?.imageAlt as string) ?? "SDOH Illustration"}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
