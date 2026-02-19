"use client"

import { motion } from "motion/react"
import { useEffect, useState, useRef, useCallback } from "react"
import { ContactForm } from "@/components/ContactForm"

const trustedByLogos = [
  {
    name: "Builders VC",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/builders-dark.svg",
    height: "h-8 md:h-9",
  },
  {
    name: "Alamo Angels",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/angels.png",
    height: "h-6 md:h-7",
  },
  {
    name: "Digital Canvas",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-ymas.svg",
    invert: true,
    height: "h-6 md:h-7",
  },
  {
    name: "Univision",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/univision-logo.svg",
    height: "h-7 md:h-9",
  },
  {
    name: "TXMX Boxing",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg",
    invert: true,
    height: "h-6 md:h-8",
  },
  {
    name: "VelocityTX",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+MAIN+RGB+(1).png",
    height: "h-6 md:h-9",
  },
  {
    name: "SDOH",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg",
    height: "h-7 md:h-9",
  },
  {
    name: "The Health Cell",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell.png",
    height: "h-7 md:h-8",
  },
  {
    name: "Mission Road Ministries",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/missionroad.svg",
    height: "h-6 md:h-9",
  },
  {
    name: "Methodist Healthcare Ministries",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png",
    height: "h-9 md:h-10",
  },
  {
    name: "Tech Bloc",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell-2-techbloc.png",
    height: "h-9 md:h-12",
  },
  {
    name: "Learn2AI",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/Learn2ai.svg",
    height: "h-6 md:h-7",
  },
]

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
    <div className="min-h-dvh bg-white text-gray-900 overflow-hidden pt-10">
      <div className="relative min-h-dvh flex items-center py-4 lg:py-6">
        {/* Dot Distortion Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-linear-to-br from-gray-50 via-white to-gray-50" />
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
                  className="font-ggx88 font-black text-5xl lg:text-6xl xl:text-7xl text-gray-900 leading-[0.9] tracking-tighter"
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="block"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    Bold Stories.
                  </motion.span>
                  <motion.span
                    className="block"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    Proven Impact.
                  </motion.span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="font-geist-sans text-base text-gray-500 leading-relaxed font-normal max-w-md"
                >
                  From brand campaigns, to event production, we help the world&apos;s most innovative firms find their voice and amplify their impact through bold storytelling and experiences.
                </motion.p>
              </motion.div>

              {/* Trust Indicator - Logo Carousel (mobile) / Grid (desktop) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.5 }}
                className="pt-4 border-t border-gray-100"
              >
                <p className="font-geist-sans text-[11px] text-gray-400 font-semibold tracking-widest uppercase mb-3.5">
                  Trusted by <span className="font-medium text-gray-700">leading organizations</span>
                </p>

                {/* Mobile: scrolling marquee */}
                <div className="relative overflow-hidden lg:hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-linear-to-r from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-linear-to-l from-white to-transparent z-10 pointer-events-none" />
                  
                  <motion.div
                    className="flex items-center gap-8"
                    animate={{
                      x: [0, -1200],
                    }}
                    transition={{
                      x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 25,
                        ease: "linear",
                      },
                    }}
                  >
                    {[...trustedByLogos, ...trustedByLogos].map((company, index) => (
                      <div
                        key={`${company.name}-${index}`}
                        className="shrink-0 h-6 flex items-center justify-center"
                      >
                        <img
                          src={company.logo}
                          alt={`${company.name} logo`}
                          className={`${company.height} w-auto object-contain opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300${company.invert ? ' invert' : ''}`}
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Desktop: logo grid */}
                <div className="hidden lg:grid grid-cols-3 xl:grid-cols-4 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {trustedByLogos.map((company) => (
                    <div
                      key={company.name}
                      className="bg-white flex items-center justify-center p-5 xl:p-6 group"
                    >
                      <img
                        src={company.logo}
                        alt={`${company.name} logo`}
                        className={`${company.height} w-auto object-contain opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300${company.invert ? ' invert' : ''}`}
                      />
                    </div>
                  ))}
                </div>
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
