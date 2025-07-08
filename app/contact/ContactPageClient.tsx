"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { ContactForm } from "../components/ContactForm"

// Fixed particle positions to prevent hydration mismatch
const particlePositions = [
  { left: "10%", top: "20%" },
  { left: "85%", top: "15%" },
  { left: "25%", top: "70%" },
  { left: "75%", top: "80%" },
  { left: "5%", top: "60%" },
  { left: "90%", top: "45%" },
  { left: "40%", top: "25%" },
  { left: "60%", top: "85%" },
  { left: "15%", top: "40%" },
  { left: "80%", top: "65%" },
  { left: "35%", top: "10%" },
  { left: "65%", top: "30%" },
  { left: "20%", top: "90%" },
  { left: "70%", top: "20%" },
  { left: "45%", top: "75%" },
  { left: "55%", top: "50%" },
  { left: "30%", top: "35%" },
  { left: "85%", top: "70%" },
  { left: "12%", top: "85%" },
  { left: "88%", top: "25%" },
]

export function ContactPageClient() {
  const [mounted, setMounted] = useState(false)

  const renderMenuItems = useCallback(() => {
    const items = [
      "Discuss a ROI-driven media strategy",
      "Explore our brand storytelling services",
      "Get a quote for video or event production",
    ]

    return items.map((item, index) => (
      <motion.li
        key={index}
        className="flex items-start gap-4"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.4 + 0.15 * index }}
      >
        <motion.i
          className="ri-check-line h-6 w-6 flex-none text-emerald-500 mt-2"
          aria-hidden="true"
          whileHover={{ scale: 1.2, rotate: 360 }}
          transition={{ duration: 0.3 }}
        />
        <span className="flex-1 text-lg lg:text-xl xl:text-2xl leading-relaxed">{item}</span>
      </motion.li>
    ))
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Ensure page starts at top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white overflow-hidden">
      {/* Hero Section with Enhanced Visual Effects */}
      <div className="relative min-h-screen flex items-center">
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-1/2 -right-1/2 w-[120vw] h-[120vh] bg-gradient-radial from-emerald-500/10 via-emerald-500/5 to-transparent rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, 360],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 30,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
          <motion.div
            className="absolute -bottom-1/2 -left-1/2 w-[100vw] h-[100vh] bg-gradient-radial from-neutral-600/10 via-neutral-700/5 to-transparent rounded-full"
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [360, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 25,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />

          {/* Fixed Floating Particles */}
          {particlePositions.map((position, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-emerald-400/40 rounded-full"
              style={{
                left: position.left,
                top: position.top,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>

        <div className="relative w-full max-w-[95vw] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 xl:gap-16 items-center min-h-screen py-8 lg:py-12">
            {/* Left Column - Enhanced Content */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8 lg:space-y-10 xl:space-y-12"
            >
              {/* Main Headline - Single Row with Mobile Top Margin */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-6 lg:space-y-8 mt-20 sm:mt-24 lg:mt-0"
              >
                <motion.h1
                  className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-ggx88 text-white leading-[0.9] tracking-tight whitespace-nowrap"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="inline-block mr-3 lg:mr-4"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    Take the
                  </motion.span>
                  <motion.span
                    className="inline-block text-emerald-400"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    next step
                  </motion.span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="text-lg sm:text-xl lg:text-2xl xl:text-3xl text-neutral-300 leading-relaxed font-light max-w-4xl"
                >
                  We partner with venture capital firms, accelerators, startups, and industry leaders to create{" "}
                  <span className="text-emerald-400 font-medium">bold, strategic content</span> that delivers results.
                </motion.p>
              </motion.div>

              {/* Enhanced Services List - Compact for Desktop Viewport */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.9 }}
                className="space-y-4 lg:space-y-6"
              >
                <motion.h2
                  className="text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-ggx88 text-white"
                  whileHover={{ color: "#10b981" }}
                  transition={{ duration: 0.3 }}
                >
                  How can we help?
                </motion.h2>
                <ul className="space-y-3 lg:space-y-4 text-neutral-200 max-w-3xl">{renderMenuItems()}</ul>
              </motion.div>
            </motion.div>

            {/* Right Column - Enhanced Logo with Invert */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                duration: 1.2,
                delay: 0.6,
                type: "spring",
                stiffness: 80,
                damping: 12,
              }}
              className="relative flex items-center justify-center lg:justify-end"
            >
              <div className="relative">
                {/* Enhanced Glow Effects */}
                <motion.div
                  className="absolute inset-0 bg-emerald-400/30 rounded-full blur-3xl scale-150"
                  animate={{
                    scale: [1.2, 1.8, 1.2],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  className="absolute inset-0 bg-white/20 rounded-full blur-2xl scale-125"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.1, 0.3, 0.1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                />

                {/* Logo with Invert and Enhanced Animation */}
                <motion.div
                  animate={{
                    rotate: [0, 8, -8, 0],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                  className="relative z-10"
                  whileHover={{
                    scale: 1.1,
                    rotate: 15,
                    transition: { duration: 0.3 },
                  }}
                >
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
                    alt="434 Media Logo"
                    width={500}
                    height={500}
                    className="object-contain w-full h-full max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl mx-auto filter invert brightness-0 contrast-200 drop-shadow-2xl"
                    priority
                  />
                </motion.div>

                {/* Orbiting Elements */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <div className="absolute top-0 left-1/2 w-3 h-3 bg-emerald-400 rounded-full -translate-x-1/2 -translate-y-8" />
                  <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-white/60 rounded-full -translate-x-1/2 translate-y-8" />
                  <div className="absolute left-0 top-1/2 w-2.5 h-2.5 bg-emerald-300 rounded-full -translate-x-8 -translate-y-1/2" />
                  <div className="absolute right-0 top-1/2 w-2 h-2 bg-white/40 rounded-full translate-x-8 -translate-y-1/2" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Enhanced Contact Form Section */}
      <div className="relative bg-gradient-to-t from-black via-neutral-900 to-neutral-800 py-20 lg:py-32">
        {/* Enhanced Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 left-10 w-4 h-4 bg-emerald-400 rounded-full"
            animate={{
              scale: [1, 2, 1],
              opacity: [0.3, 1, 0.3],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
            }}
          />
          <motion.div
            className="absolute top-1/3 right-20 w-6 h-6 bg-white/20 rounded-full"
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              delay: 1,
            }}
          />
          <motion.div
            className="absolute bottom-1/4 left-1/4 w-3 h-3 bg-emerald-500 rounded-full"
            animate={{
              scale: [1, 2.5, 1],
              opacity: [0.4, 1, 0.4],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 5,
              repeat: Number.POSITIVE_INFINITY,
              delay: 2,
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-center mb-16 lg:mb-20"
          >
            <motion.h2
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-ggx88 text-white mb-8 leading-tight"
              whileHover={{ scale: 1.02, color: "#10b981" }}
              transition={{ duration: 0.3 }}
            >
              Ready to get started?
            </motion.h2>
            <motion.p
              className="text-xl sm:text-2xl lg:text-3xl text-neutral-300 max-w-4xl mx-auto leading-relaxed font-light"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              Fill out the form below and we'll be in touch to discuss your project and explore how we can bring your
              vision to life.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="max-w-3xl mx-auto"
          >
            <div className="relative">
              {/* Form Glow Effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-emerald-500/20 rounded-3xl blur-xl"
                animate={{
                  opacity: [0.5, 0.8, 0.5],
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              />
              <ContactForm
                isVisible={mounted}
                className="relative z-10 w-full shadow-2xl border border-emerald-500/20"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
