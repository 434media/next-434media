"use client"

import { motion } from "motion/react"
import { useEffect, useState, useRef, useCallback } from "react"
import { ContactForm } from "@/components/ContactForm"
import { BRAND_RECORDS } from "@/lib/brand-records"

// Single-purpose contact page. Conversion is the only job.

export function ContactPageClient() {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Dot distortion shader
  const drawDots = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    const gap = 24
    const dotRadius = 1
    const alpha = 0.12

    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    for (let x = gap; x < w; x += gap) {
      for (let y = gap; y < h; y += gap) {
        ctx.beginPath()
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    drawDots()

    const onResize = () => drawDots()
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [drawDots])

  return (
    <div className="min-h-dvh bg-white text-neutral-900 overflow-hidden pt-10">
      <div className="relative min-h-dvh flex items-center py-4 lg:py-6">
        {/* Dot Distortion Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-linear-to-br from-neutral-50 via-white to-neutral-50" />
        </div>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 xl:gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-5 lg:space-y-6 mt-16 sm:mt-20 lg:mt-0"
            >
              {/* Main Headline */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-4 lg:space-y-5"
              >
                <motion.h1
                  className="font-ggx88 t-display-l text-neutral-900"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  Start a production.
                </motion.h1>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="space-y-3 max-w-md"
                >
                  {/* Master 1.1, verbatim. Never reword, shorten or split it. */}
                  <p className="font-geist-sans t-body text-neutral-900">{BRAND_RECORDS.canonicalDefinition}</p>
                  <p className="font-geist-sans t-body text-neutral-500">
                    Tell us what you want to produce, when you need it, and the budget behind it. We review every
                    request before confirming the right next step.
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-6 lg:mt-0"
            >
              <div className="relative">
                <ContactForm
                  isVisible={mounted}
                  className="relative z-10 w-full"
                />
              </div>

            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
