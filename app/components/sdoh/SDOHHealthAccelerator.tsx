"use client"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import { useEffect, useState, useRef } from "react"
import SDOHDemoDay from "./SDOHDemoDay"
import type { Dictionary } from "../../types/dictionary"
import { useLanguage } from "../../context/language-context"
import { motion, useInView } from "motion/react"

// Define the structure of the accelerator dictionary
interface AcceleratorDictionary {
  title: string
  subtitle: string
  description1: string
  description2: string
}

// Define the structure of the dictionary props
interface SDOHHealthAcceleratorProps {
  locale: Locale
  dict: Partial<Dictionary>
}

// Helper function to safely get string values from dictionary
const getStringValue = (value: any): string => {
  if (typeof value === "string") return value
  return String(value || "")
}

export default function SDOHHealthAccelerator({ locale, dict }: SDOHHealthAcceleratorProps) {
  // Get dictionary from language context
  const { dictionary } = useLanguage()

  // Track when dictionary or locale changes
  const [key, setKey] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Refs for intersection observer
  const titleRef = useRef<HTMLDivElement>(null)
  const titleInView = useInView(titleRef, { once: true, amount: 0.1 })

  const [forceVisible, setForceVisible] = useState(false)

  // Check for reduced motion preference and mobile device
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const mobileQuery = window.matchMedia("(max-width: 768px)")

    setPrefersReducedMotion(mediaQuery.matches)
    setIsMobile(mobileQuery.matches)

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    const handleMobileChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    mediaQuery.addEventListener("change", handleMotionChange)
    mobileQuery.addEventListener("change", handleMobileChange)

    return () => {
      mediaQuery.removeEventListener("change", handleMotionChange)
      mobileQuery.removeEventListener("change", handleMobileChange)
    }
  }, [])

  useEffect(() => {
    // Fallback to show content after 2 seconds if intersection observer doesn't trigger
    const timer = setTimeout(() => {
      setForceVisible(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  // Force re-render when locale or dictionary changes
  useEffect(() => {
    setKey((prev) => prev + 1)
    console.log(`SDOHHealthAccelerator: Locale changed to ${locale}`)
    console.log(`SDOHHealthAccelerator: Dictionary available:`, !!dict)
  }, [locale, dict])

  // Default English text - ORIGINAL APPROVED TEXT
  const defaultDictionary: AcceleratorDictionary = {
    title: "Community Health Accelerator",
    subtitle: "Growth-Stage Program",
    description1:
      "For startups ready to scale, this accelerator provides deeper support—from mentoring and expert workshops to connections with healthcare systems, investors, and ecosystem partners focused on sustainable health innovation.",
    description2:
      "This program exists to answer big questions in a practical way—and to make sure the people closest to the issues have the tools, resources, and support to solve them.",
  }

  // Use the dictionary if provided, otherwise use default English text
  const currentDict = dictionary || dict
  const sdohDict = currentDict?.sdoh
  const d = (sdohDict?.accelerator as AcceleratorDictionary) || defaultDictionary

  // Get the "Learn More" text from the dictionary
  const demoDayDict = sdohDict?.demoDay
  const learnMore = getStringValue(demoDayDict?.learnMore) || "Learn More About the Accelerator"

  return (
    <FadeIn key={key}>
      {/* Added proper spacing from component above */}
      <div className="max-w-7xl mx-auto pt-24 sm:pt-32 md:pt-40 mb-16 sm:mb-20 relative">
        {/* Reduced Animated Background Elements for mobile performance */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Simplified floating geometric shapes */}
          {!isMobile && (
            <>
              <motion.div
                className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-cyan-200/20 to-blue-300/20 rounded-full blur-xl"
                animate={
                  !prefersReducedMotion
                    ? {
                        y: [0, -20, 0],
                        x: [0, 10, 0],
                        scale: [1, 1.1, 1],
                      }
                    : {}
                }
                transition={
                  !prefersReducedMotion
                    ? {
                        duration: 8,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }
                    : {}
                }
              />
              <motion.div
                className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-br from-blue-200/20 to-cyan-300/20 rounded-lg blur-xl rotate-45"
                animate={
                  !prefersReducedMotion
                    ? {
                        y: [0, 15, 0],
                        x: [0, -15, 0],
                        rotate: [45, 135, 225],
                      }
                    : {}
                }
                transition={
                  !prefersReducedMotion
                    ? {
                        duration: 10,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }
                    : {}
                }
              />
            </>
          )}
        </div>

        {/* Header Section - Matching SeminarSeries Layout */}
        <div className="text-center mb-16 relative" ref={titleRef}>
          {/* Reduced background glow effects for mobile */}
          <div className="absolute inset-0 -z-10">
            <motion.div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-cyan-200/30 via-cyan-100/20 to-transparent rounded-full blur-3xl"
              animate={
                !prefersReducedMotion && !isMobile
                  ? {
                      scale: [1, 1.1, 1],
                      opacity: [0.3, 0.5, 0.3],
                    }
                  : {}
              }
              transition={
                !prefersReducedMotion && !isMobile
                  ? {
                      duration: 8,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
                  : {}
              }
            />
          </div>

          {/* Component Number - Enhanced with dramatic entrance - NO SPINNING */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={titleInView || forceVisible ? { scale: 1, rotate: 0 } : {}}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.3,
            }}
            className="relative inline-block mb-8"
          >
            {/* Reduced outer glow ring for mobile performance */}
            <motion.div
              className="absolute inset-0 w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400 to-cyan-600 blur-xl opacity-60"
              animate={
                !prefersReducedMotion && !isMobile
                  ? {
                      scale: [1, 1.2, 1],
                      opacity: [0.6, 0.8, 0.6],
                    }
                  : {}
              }
              transition={
                !prefersReducedMotion && !isMobile
                  ? {
                      duration: 3,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
                  : {}
              }
            />

            {/* Main number container with reduced effects for mobile */}
            <motion.div
              className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-600 via-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-500 group"
              whileHover={
                !isMobile
                  ? {
                      scale: 1.15,
                      boxShadow: "0 25px 50px -12px rgba(6, 182, 212, 0.5)",
                    }
                  : {}
              }
            >
              {/* Inner highlight with reduced animation */}
              <motion.div
                className="absolute inset-1 rounded-2xl bg-gradient-to-br from-white/20 to-transparent"
                animate={
                  !prefersReducedMotion && !isMobile
                    ? {
                        opacity: [0.2, 0.4, 0.2],
                      }
                    : {}
                }
                transition={
                  !prefersReducedMotion && !isMobile
                    ? {
                        duration: 4,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }
                    : {}
                }
              />

              {/* Number with enhanced styling */}
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={titleInView || forceVisible ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="relative text-4xl font-black tracking-tight z-10"
                style={{
                  textShadow: "0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.3)",
                }}
              >
                3
              </motion.span>

              {/* Static border - NO SPINNING */}
              <motion.div
                initial={{ pathLength: 0 }}
                animate={titleInView || forceVisible ? { pathLength: 1 } : {}}
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
                    stroke="url(#gradient3)"
                    strokeWidth="3"
                    strokeDasharray="8 4"
                    initial={{ pathLength: 0 }}
                    animate={titleInView || forceVisible ? { pathLength: 1 } : {}}
                    transition={{ delay: 1, duration: 2 }}
                  />
                  <defs>
                    <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="25%" stopColor="#3b82f6" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="75%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#0891b2" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Title with reduced animations for mobile */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={titleInView || forceVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
            className="relative max-w-4xl mx-auto"
          >
            {/* Main title with reduced effects for mobile */}
            <motion.h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-6">
              {/* Animated gradient text with reduced effects for mobile */}
              <motion.span
                initial={{ backgroundPosition: "0% 50%" }}
                animate={
                  titleInView || (forceVisible && !prefersReducedMotion && !isMobile)
                    ? { backgroundPosition: "100% 50%" }
                    : {}
                }
                transition={
                  !prefersReducedMotion && !isMobile
                    ? {
                        duration: 4,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatType: "reverse",
                        delay: 1.2,
                      }
                    : {}
                }
                className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-purple-500 to-cyan-600 bg-[length:300%_100%]"
                style={{
                  textShadow: "0 4px 20px rgba(6, 182, 212, 0.4)",
                  filter:
                    "drop-shadow(0 4px 20px rgba(6, 182, 212, 0.3)) drop-shadow(0 0 40px rgba(139, 92, 246, 0.2))",
                }}
              >
                {getStringValue(d.title)}
              </motion.span>
            </motion.h2>

            {/* Simplified decorative underline for mobile */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={titleInView || forceVisible ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 1.4, ease: "easeOut" }}
              className="relative mx-auto mb-8"
              style={{ width: "min(500px, 90%)" }}
            >
              {/* Main underline */}
              <div className="h-3 bg-gradient-to-r from-transparent via-cyan-400 to-blue-500 rounded-full" />

              {/* Reduced animated accent dots for mobile */}
              {!isMobile && (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={titleInView || (forceVisible && !prefersReducedMotion) ? { x: "100%" } : {}}
                  transition={
                    !prefersReducedMotion
                      ? {
                          duration: 3,
                          delay: 2,
                          repeat: Number.POSITIVE_INFINITY,
                          repeatType: "loop",
                          ease: "easeInOut",
                        }
                      : {}
                  }
                  className="absolute top-0 left-0 w-6 h-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-sm"
                />
              )}
            </motion.div>

            {/* Enhanced section introduction text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={titleInView || forceVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 1.6 }}
              className="relative"
            >
              <motion.p
                className="text-lg sm:text-xl md:text-2xl text-neutral-600 font-medium leading-relaxed max-w-3xl mx-auto"
                animate={
                  !prefersReducedMotion && !isMobile
                    ? {
                        textShadow: [
                          "0 0 0px rgba(6, 182, 212, 0)",
                          "0 0 10px rgba(6, 182, 212, 0.3)",
                          "0 0 0px rgba(6, 182, 212, 0)",
                        ],
                      }
                    : {}
                }
                transition={
                  !prefersReducedMotion && !isMobile
                    ? {
                        duration: 4,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: 3,
                      }
                    : {}
                }
              >
                {locale === "es"
                  ? "Descubre el tercer componente de nuestro programa integral"
                  : "Discover the third component of our comprehensive program"}
              </motion.p>

              {/* Simplified decorative side elements for mobile */}
              {!isMobile && (
                <>
                  <motion.div
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-8 w-1 h-16 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60"
                    animate={
                      !prefersReducedMotion
                        ? {
                            height: [64, 80, 64],
                            opacity: [0.6, 0.8, 0.6],
                          }
                        : {}
                    }
                    transition={
                      !prefersReducedMotion
                        ? {
                            duration: 3,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                          }
                        : {}
                    }
                  />
                  <motion.div
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-8 w-1 h-16 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60"
                    animate={
                      !prefersReducedMotion
                        ? {
                            height: [64, 80, 64],
                            opacity: [0.6, 0.8, 0.6],
                          }
                        : {}
                    }
                    transition={
                      !prefersReducedMotion
                        ? {
                            duration: 3,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeInOut",
                            delay: 1.5,
                          }
                        : {}
                    }
                  />
                </>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Main Content - Updated with component number and grid layout */}
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center mb-16">
          <motion.div
            className="order-2 md:order-1"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
          >
            <div className="mb-8">
              <motion.div
                className="inline-block p-3 px-6 mb-6 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 backdrop-blur-sm text-yellow-800 text-sm font-medium shadow-lg border border-yellow-200/50 relative overflow-hidden"
                whileHover={!isMobile ? { scale: 1.05 } : {}}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {/* Simplified animated dot for mobile */}
                <motion.div
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-yellow-500 rounded-full"
                  animate={
                    !prefersReducedMotion && !isMobile
                      ? {
                          scale: [1, 1.2, 1],
                          opacity: [0.7, 1, 0.7],
                        }
                      : {}
                  }
                  transition={
                    !prefersReducedMotion && !isMobile
                      ? {
                          duration: 2,
                          repeat: Number.POSITIVE_INFINITY,
                        }
                      : {}
                  }
                />
                <span className="ml-4">{getStringValue(d.subtitle)}</span>
              </motion.div>
            </div>

            <div className="relative">
              <div className="absolute -top-10 -left-10 w-60 h-60 bg-cyan-200/20 rounded-full blur-3xl -z-10"></div>
              <motion.div
                className="p-8 border border-cyan-200/40 rounded-xl bg-gradient-to-br from-white to-cyan-50/50 shadow-lg hover:shadow-xl transition-all duration-500 relative overflow-hidden"
                whileHover={!isMobile ? { y: -5 } : {}}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {/* Simplified background pattern for mobile */}
                <div className="absolute inset-0 opacity-5">
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500"
                    style={{
                      backgroundImage: `radial-gradient(circle at 25% 25%, rgba(34, 211, 238, 0.1) 0%, transparent 50%), 
                                        radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)`,
                    }}
                  />
                </div>

                <motion.p
                  className="text-lg md:text-xl text-neutral-700 leading-relaxed font-light relative z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.8 }}
                >
                  {getStringValue(d.description1)}
                </motion.p>

                <motion.p
                  className="text-lg md:text-xl text-neutral-700 leading-relaxed font-light mt-6 relative z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4, duration: 0.8 }}
                >
                  {getStringValue(d.description2)}
                </motion.p>

                {/* Learn more link with reduced animation */}
                <motion.div
                  className="mt-8 relative z-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.6, duration: 0.8 }}
                >
                  <motion.a
                    href="https://velocitytx.org/startup-programs/support/accelerator/"
                    className="inline-flex items-center text-cyan-700 hover:text-cyan-800 font-medium transition-colors duration-200 group"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Learn more about the Community Health Accelerator"
                    whileHover={!isMobile ? { x: 5 } : {}}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {learnMore}
                    <motion.svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 ml-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      animate={!prefersReducedMotion && !isMobile ? { x: [0, 5, 0] } : {}}
                      transition={
                        !prefersReducedMotion && !isMobile
                          ? {
                              duration: 2,
                              repeat: Number.POSITIVE_INFINITY,
                            }
                          : {}
                      }
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </motion.svg>
                  </motion.a>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>

          {/* Demo Day Video - Right side on desktop with 1080x1350 aspect ratio */}
          <motion.div
            className="order-1 md:order-2 relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br from-yellow-200/10 to-orange-200/10 rounded-full blur-3xl -z-10"></div>
            <div style={{ aspectRatio: "1080/1350" }} className="w-full">
              <SDOHDemoDay dict={currentDict} locale={locale} />
            </div>
          </motion.div>
        </div>
      </div>
    </FadeIn>
  )
}
