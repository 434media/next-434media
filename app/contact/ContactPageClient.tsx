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
      "ROI-driven media strategies that deliver measurable results",
      "Brand storytelling that connects with your audience",
      "Video production and event coverage that captivates",
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
          className="ri-check-line h-6 w-6 flex-none text-emerald-500 mt-1"
          aria-hidden="true"
          whileHover={{ scale: 1.2, rotate: 360 }}
          transition={{ duration: 0.3 }}
        />
        <span className="flex-1 text-base lg:text-lg leading-relaxed">{item}</span>
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
      <div className="relative min-h-screen flex items-center py-8 lg:py-12">
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

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6 lg:space-y-8 mt-16 sm:mt-20 lg:mt-0"
            >
              {/* Main Headline */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-4 lg:space-y-6"
              >
                <motion.h1
                  className="text-4xl lg:text-5xl xl:text-6xl font-ggx88 text-white leading-[0.9] tracking-tight"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="block"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    Take the
                  </motion.span>
                  <motion.span
                    className="block text-emerald-400"
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
                  className="text-lg sm:text-xl lg:text-2xl text-neutral-300 leading-relaxed font-light"
                >
                  We partner with venture capital firms, accelerators, startups, and industry leaders to create{" "}
                  <span className="text-emerald-400 font-medium">bold, strategic content</span> that deliver results.
                </motion.p>
              </motion.div>

              {/* Services List */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.9 }}
                className="space-y-4"
              >
                <motion.h2
                  className="text-xl sm:text-2xl lg:text-3xl font-ggx88 text-white"
                  whileHover={{ color: "#10b981" }}
                  transition={{ duration: 0.3 }}
                >
                  What we specialize in:
                </motion.h2>
                <ul className="space-y-3 text-neutral-200">{renderMenuItems()}</ul>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-8 lg:mt-0"
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
    </div>
  )
}
