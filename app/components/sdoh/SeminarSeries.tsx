"use client"

import { useRef } from "react"
import { motion, useInView } from "motion/react"
import Image from "next/image"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SeminarSeriesProps {
  locale: Locale
  dict: Dictionary
}

export default function SeminarSeries({ locale, dict }: SeminarSeriesProps) {
  const titleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)

  const titleInView = useInView(titleRef, { once: true, amount: 0.3 })
  const contentInView = useInView(contentRef, { once: true, amount: 0.2 })
  const imageInView = useInView(imageRef, { once: true, amount: 0.3 })

  return (
    <div className="space-y-16 md:space-y-20">
      {/* TITLE SECTION - Full Width Row */}
      <motion.div
        ref={titleRef}
        initial={{ opacity: 0 }}
        animate={titleInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative text-center"
      >
        {/* Background glow effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-radial from-cyan-200/30 via-cyan-100/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-radial from-yellow-200/20 to-transparent rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-radial from-blue-200/20 to-transparent rounded-full blur-2xl" />
        </div>

        {/* Component Number - Enhanced with dramatic entrance */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={titleInView ? { scale: 1, rotate: 0 } : {}}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.3,
          }}
          className="relative inline-block mb-8"
        >
          {/* Outer glow ring */}
          <div className="absolute inset-0 w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400 to-cyan-600 blur-xl opacity-60 animate-pulse" />

          {/* Main number container */}
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-600 via-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-500 group">
            {/* Inner highlight */}
            <div className="absolute inset-1 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />

            {/* Number */}
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={titleInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="relative text-4xl font-black tracking-tight z-10"
              style={{
                textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              1
            </motion.span>

            {/* Animated border */}
            <motion.div
              initial={{ pathLength: 0 }}
              animate={titleInView ? { pathLength: 1 } : {}}
              transition={{ delay: 1, duration: 2 }}
              className="absolute inset-0 rounded-3xl"
            >
              <svg className="w-full h-full" viewBox="0 0 96 96">
                <motion.rect
                  x="2"
                  y="2"
                  width="92"
                  height="92"
                  rx="20"
                  ry="20"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  initial={{ pathLength: 0, rotate: 0 }}
                  animate={titleInView ? { pathLength: 1, rotate: 360 } : {}}
                  transition={{ delay: 1, duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "loop" }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* Title with enhanced typography and animations */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Main title */}
          <motion.h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-6">
            {/* Animated gradient text */}
            <motion.span
              initial={{ backgroundPosition: "0% 50%" }}
              animate={titleInView ? { backgroundPosition: "100% 50%" } : {}}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
                delay: 1.2,
              }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 bg-[length:200%_100%]"
              style={{
                textShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
                filter: "drop-shadow(0 4px 20px rgba(6, 182, 212, 0.2))",
              }}
            >
              {dict?.sdoh?.seminar?.title || "Seminar + Speaker Series"}
            </motion.span>
          </motion.h2>

          {/* Decorative underline with animation */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={titleInView ? { scaleX: 1, opacity: 1 } : {}}
            transition={{ duration: 1.5, delay: 1.4, ease: "easeOut" }}
            className="relative mx-auto mb-8"
            style={{ width: "min(400px, 80%)" }}
          >
            {/* Main underline */}
            <div className="h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full" />

            {/* Animated accent dots */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={titleInView ? { x: "100%" } : {}}
              transition={{
                duration: 3,
                delay: 2,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "loop",
                ease: "easeInOut",
              }}
              className="absolute top-0 left-0 w-4 h-2 bg-yellow-400 rounded-full blur-sm"
            />
          </motion.div>

          {/* Section introduction text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 1.6 }}
            className="relative"
          >
            <p className="text-lg sm:text-xl md:text-2xl text-neutral-600 font-medium leading-relaxed max-w-3xl mx-auto">
              {locale === "es"
                ? "Descubre el primer componente de nuestro programa integral"
                : "Discover the first component of our comprehensive program"}
            </p>

            {/* Decorative side elements */}
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-8 w-1 h-12 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60" />
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-8 w-1 h-12 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* CONTENT SECTION - Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-16 md:gap-20 items-center">
        {/* Text Content Column */}
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, x: -50 }}
          animate={contentInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="order-2 md:order-1 space-y-8"
        >
          {/* First paragraph with enhanced entrance */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={contentInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <p className="text-lg sm:text-xl leading-relaxed text-neutral-700">
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

            {/* Animated accent line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={contentInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1, delay: 0.8 }}
              className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-cyan-400 via-cyan-300 to-transparent rounded-full origin-top"
            />
          </motion.div>

          {/* Second paragraph with staggered animation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={contentInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative"
          >
            <p className="text-lg sm:text-xl leading-relaxed text-neutral-700">
              {locale === "es" ? (
                <>
                  {dict?.sdoh?.seminar?.description2 ||
                    "Creemos que al comprender las causas fundamentales de los resultados de salud"}{" "}
                  <span className="italic font-medium text-cyan-600">
                    {dict?.sdoh?.seminar?.causa || "la causa principal"}
                  </span>
                  {dict?.sdoh?.seminar?.description2End ||
                    "—podemos inspirar a más personas a construir el futuro de la salud aquí mismo en nuestras comunidades."}
                </>
              ) : (
                <>
                  {dict?.sdoh?.seminar?.description2 ||
                    "We believe that by understanding the root causes of health outcomes"}
                  —
                  <span className="italic font-medium text-cyan-600">
                    {dict?.sdoh?.seminar?.causa || "la causa principal"}
                  </span>
                  {dict?.sdoh?.seminar?.description2End ||
                    "—we can inspire more people to build the future of health right here in our communities."}
                </>
              )}
            </p>
          </motion.div>

          {/* Highlighted content with enhanced design */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={contentInView ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
            className="relative"
          >
            {/* Enhanced background with multiple layers */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-yellow-300/15 to-yellow-400/10 rounded-2xl blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-50 via-yellow-25 to-white rounded-2xl border border-yellow-200/50" />

            {/* Animated border accent */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={contentInView ? { scaleY: 1 } : {}}
              transition={{ duration: 1.2, delay: 1.2 }}
              className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-400 rounded-full origin-top"
            />

            <div className="relative p-8 rounded-2xl">
              <motion.p
                initial={{ opacity: 0 }}
                animate={contentInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 1.4 }}
                className="text-lg leading-relaxed font-medium text-neutral-700"
              >
                {dict?.sdoh?.seminar?.highlight ||
                  "The series features live events and panels designed to spark conversation, raise awareness, and make complex health topics feel approachable and relevant—especially for aspiring founders, healthcare workers, educators, and community changemakers."}
              </motion.p>

              {/* Decorative corner elements */}
              <div className="absolute top-3 right-3 w-8 h-8 border-r-2 border-t-2 border-yellow-400/40 rounded-tr-xl" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-l-2 border-b-2 border-yellow-400/40 rounded-bl-xl" />
            </div>
          </motion.div>
        </motion.div>

        {/* Image Column with Enhanced Effects */}
        <motion.div
          ref={imageRef}
          initial={{ opacity: 0, x: 50, rotateY: -15 }}
          animate={imageInView ? { opacity: 1, x: 0, rotateY: 0 } : {}}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
          className="order-1 md:order-2 relative"
        >
          {/* Enhanced decorative background elements */}
          <div className="absolute -inset-8 -z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={imageInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.6 }}
              className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-radial from-cyan-200/40 via-cyan-100/20 to-transparent rounded-full blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={imageInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.8 }}
              className="absolute -bottom-16 -left-16 w-40 h-40 bg-gradient-radial from-yellow-200/40 via-yellow-100/20 to-transparent rounded-full blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={imageInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 1 }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-radial from-blue-200/30 to-transparent rounded-full blur-xl"
            />
          </div>

          {/* Main image container with enhanced effects */}
          <motion.div
            initial={{ scale: 0.9, rotateX: 10 }}
            animate={imageInView ? { scale: 1, rotateX: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
            className="relative z-10 group"
          >
            {/* Outer glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-cyan-400/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            {/* Image container */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl transform hover:scale-105 transition-all duration-700 group">
              <div className="aspect-square relative">
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                  alt={(dict?.sdoh?.seminar?.imageAlt as string) ?? "SDOH Illustration"}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Enhanced overlay gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/20 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-900/10" />

                {/* Animated overlay on hover */}
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10"
                />
              </div>

              {/* Animated border frame */}
              <motion.div
                initial={{ pathLength: 0, opacity: 0 }}
                animate={imageInView ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ duration: 2, delay: 1.2 }}
                className="absolute inset-0 rounded-3xl pointer-events-none"
              >
                <svg className="w-full h-full" viewBox="0 0 400 400">
                  <motion.rect
                    x="4"
                    y="4"
                    width="392"
                    height="392"
                    rx="24"
                    ry="24"
                    fill="none"
                    stroke="url(#imageGradient)"
                    strokeWidth="2"
                    strokeDasharray="12 8"
                    initial={{ pathLength: 0 }}
                    animate={imageInView ? { pathLength: 1 } : {}}
                    transition={{ duration: 3, delay: 1.5 }}
                  />
                  <defs>
                    <linearGradient id="imageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            </div>

            {/* Corner accent elements */}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={imageInView ? { scale: 1, rotate: 0 } : {}}
              transition={{ duration: 0.8, delay: 1.6 }}
              className="absolute -top-3 -left-3 w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full shadow-lg"
            />
            <motion.div
              initial={{ scale: 0, rotate: 45 }}
              animate={imageInView ? { scale: 1, rotate: 0 } : {}}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="absolute -bottom-3 -right-3 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
