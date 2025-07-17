"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useState, useRef } from "react"

interface NavMenuProps {
  isOpen: boolean
  onClose: () => void
  id?: string
}

interface NavigationSquare {
  id: string
  title: string
  subtitle: string
  href: string
  gradient: string
  textColor: string
  delay: number
  size: "large" | "medium" | "small"
  logo?: string // Add optional logo URL
}

const navigationSquares: NavigationSquare[] = [
  {
    id: "digital-canvas",
    title: "DIGITAL CANVAS",
    subtitle: "Creative layer of 434 MEDIA",
    href: "/digital-canvas",
    gradient: "from-amber-500 via-yellow-500 to-orange-400",
    textColor: "text-white",
    delay: 0.1,
    size: "large",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-ymas.svg",
  },
  {
    id: "shop",
    title: "SHOP",
    subtitle: "434 SHOP NOW OPEN",
    href: "/shop",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    textColor: "text-white",
    delay: 0.2,
    size: "large",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg"
  },
    {
    id: "events",
    title: "COMMUNITY EVENTS",
    subtitle: "Where Networks Meet Action",
    href: "/events",
    gradient: "from-orange-500 via-red-500 to-pink-500",
    textColor: "text-white",
    delay: 0.3,
    size: "large",
  },
  {
    id: "sdoh",
    title: "¿Qué es SDOH?",
    subtitle: "Turn awareness into action",
    href: "/en/sdoh",
    gradient: "from-blue-500 via-cyan-400 to-teal-400",
    textColor: "text-white",
    delay: 0.15,
    size: "large",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg",
  },
  {
    id: "blog",
    title: "BLOG",
    subtitle: "Insights & Stories",
    href: "/blog",
    gradient: "from-violet-600 via-purple-600 to-indigo-600",
    textColor: "text-white",
    delay: 0.25,
    size: "medium",
  },
  {
    id: "contact",
    title: "CONTACT US",
    subtitle: "Take the next step",
    href: "/contact",
    gradient: "from-purple-600 via-pink-600 to-blue-600",
    textColor: "text-white",
    delay: 0.35,
    size: "medium",
  },
]

export default function NavMenu({ isOpen, onClose, id = "nav-menu" }: NavMenuProps) {
  const [menuMounted, setMenuMounted] = useState(false)
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const getSquareClasses = (size: string) => {
    switch (size) {
      case "large":
        return "col-span-2 row-span-2 h-48 md:h-56 lg:h-64"
      case "medium":
        return "col-span-2 row-span-1 h-24 md:h-28 lg:h-32"
      case "small":
        return "col-span-2 row-span-1 h-24 md:h-28 lg:h-32"
      default:
        return "col-span-2 row-span-1 h-24 md:h-28 lg:h-32"
    }
  }

  const renderNavigationSquares = useCallback(() => {
    return navigationSquares.map((square) => (
      <motion.div
        key={square.id}
        initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{
          duration: 0.7,
          delay: square.delay,
          type: "spring",
          stiffness: 120,
          damping: 15,
        }}
        className={`group relative overflow-hidden rounded-3xl ${getSquareClasses(square.size)}`}
        onMouseEnter={() => setHoveredSquare(square.id)}
        onMouseLeave={() => setHoveredSquare(null)}
      >
        <Link href={square.href} onClick={onClose} className="block relative w-full h-full">
          {/* Gradient Background */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${square.gradient}`}
            animate={{
              scale: hoveredSquare === square.id ? 1.1 : 1,
              rotate: hoveredSquare === square.id ? 2 : 0,
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />

          {/* 434 Media Logo Background Pattern - Clean Static Version */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
              backgroundSize: "80px 80px",
              backgroundRepeat: "repeat",
              backgroundPosition: "center",
              filter: "invert(1) brightness(2)",
            }}
          />

          {/* Animated mesh overlay */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)] animate-pulse" />
          </div>

          {/* Hover glow effect */}
          <motion.div
            className="absolute inset-0 bg-white/10 rounded-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: hoveredSquare === square.id ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Content Container */}
          <div className="relative h-full flex flex-col justify-center items-center p-6 md:p-8 z-10 text-center">
            {/* Logo or Text Content */}
            <div className="flex flex-col justify-center items-center">
              {square.logo ? (
                // Logo version
                <div className="flex flex-col items-center justify-center space-y-3">
                  <motion.div
                    className="relative"
                    animate={{
                      y: hoveredSquare === square.id ? -4 : 0,
                      scale: hoveredSquare === square.id ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <img
                      src={square.logo || "/placeholder.svg"}
                      alt={square.title}
                      className="h-16 md:h-20 lg:h-32 w-auto object-contain drop-shadow-lg"
                    />
                  </motion.div>
                  <motion.p
                    className={`font-geist-sans text-sm md:text-base ${square.textColor}/90 leading-relaxed drop-shadow-sm relative z-20`}
                    initial={{ opacity: 0.8 }}
                    animate={{
                      opacity: hoveredSquare === square.id ? 1 : 0.8,
                      y: hoveredSquare === square.id ? -2 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {square.subtitle}
                  </motion.p>
                </div>
              ) : (
                // Text version (existing)
                <>
                  <motion.h3
                    className={`font-ggx88 text-xl md:text-2xl lg:text-3xl ${square.textColor} leading-tight mb-2 drop-shadow-md relative z-20`}
                    animate={{
                      y: hoveredSquare === square.id ? -4 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {square.title}
                  </motion.h3>
                  <motion.p
                    className={`font-geist-sans text-sm md:text-base ${square.textColor}/90 leading-relaxed drop-shadow-sm relative z-20`}
                    initial={{ opacity: 0.8 }}
                    animate={{
                      opacity: hoveredSquare === square.id ? 1 : 0.8,
                      y: hoveredSquare === square.id ? -2 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {square.subtitle}
                  </motion.p>
                </>
              )}
            </div>
          </div>

          {/* Animated border */}
          <motion.div
            className="absolute inset-0 border-2 border-white/30 rounded-3xl"
            animate={{
              borderColor: hoveredSquare === square.id ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
              scale: hoveredSquare === square.id ? 1.02 : 1,
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Shimmer effect on hover */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
            animate={{
              translateX: hoveredSquare === square.id ? "200%" : "-100%",
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        </Link>
      </motion.div>
    ))
  }, [hoveredSquare, onClose])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "hidden"
      setTimeout(() => {
        setMenuMounted(true)
      }, 100)
    } else {
      document.body.style.overflow = "unset"
      setMenuMounted(false)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-menu-title"
          id={id}
        >
          <div className="relative w-full h-full">
            <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-2">
              {/* Left Side - Navigation Squares */}
              <motion.div
                ref={menuRef}
                initial={{ x: "-100%", rotateY: -15 }}
                animate={{ x: 0, rotateY: 0 }}
                exit={{ x: "-100%", rotateY: -15 }}
                transition={{
                  type: "spring",
                  damping: 25,
                  stiffness: 200,
                  duration: 0.8,
                }}
                className="relative h-full bg-gradient-to-br from-slate-900 via-gray-900 to-black overflow-y-auto"
              >
                <div className="p-6 md:p-8 lg:p-12 h-full">
                  {/* Header */}
                  <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-8 lg:mb-12"
                  >
                    <h2
                      id="nav-menu-title"
                      className="text-4xl md:text-5xl lg:text-6xl font-menda-black text-white mb-4 leading-tight"
                    >
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                        434 MEDIA
                      </span>
                    </h2>
                    <motion.p
                      className="text-gray-300 text-lg md:text-xl max-w-2xl leading-relaxed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                    >
                      Explore our digital ecosystem and discover what we're building
                    </motion.p>
                  </motion.div>

                  {/* Navigation Grid - Fixed to prevent cutoff */}
                  <div className="grid grid-cols-4 gap-4 md:gap-6 lg:gap-8 auto-rows-min max-w-full">
                    {renderNavigationSquares()}
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-20 right-10 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <div className="absolute top-40 right-20 w-1 h-1 bg-purple-400 rounded-full animate-pulse delay-1000" />
                <div className="absolute bottom-32 left-10 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse delay-500" />
              </motion.div>

              {/* Right Side - 434 Media Logo with Vibrant Gradient Background */}
              <motion.div
                initial={{ x: "100%", rotateY: 15 }}
                animate={{ x: 0, rotateY: 0 }}
                exit={{ x: "100%", rotateY: 15 }}
                transition={{
                  type: "spring",
                  damping: 25,
                  stiffness: 200,
                  delay: 0.1,
                  duration: 0.8,
                }}
                className="hidden lg:block relative h-full overflow-hidden"
              >
                {/* Dynamic Gradient Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500"
                  animate={{
                    background: [
                      "linear-gradient(135deg, #60a5fa 0%, #a855f7 50%, #ec4899 100%)",
                      "linear-gradient(135deg, #34d399 0%, #3b82f6 50%, #8b5cf6 100%)",
                      "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)",
                      "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #f59e0b 100%)",
                      "linear-gradient(135deg, #60a5fa 0%, #a855f7 50%, #ec4899 100%)",
                    ],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />

                {/* Animated overlay patterns */}
                <motion.div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                                     radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
                  }}
                  animate={{
                    backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
                  }}
                  transition={{
                    duration: 12,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />

                {/* Floating gradient orbs */}
                <motion.div
                  className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/20 rounded-full blur-2xl"
                  animate={{
                    x: [0, 50, 0],
                    y: [0, -30, 0],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-white/15 rounded-full blur-3xl"
                  animate={{
                    x: [0, -40, 0],
                    y: [0, 40, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: 2,
                  }}
                />

                {/* Close Button */}
                <motion.button
                  onClick={onClose}
                  className="absolute top-8 right-8 text-white p-3 rounded-full z-50 bg-black/20 backdrop-blur-sm hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/30 group transition-all duration-200 shadow-lg"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  aria-label="Close menu"
                >
                  <i className="ri-close-line h-8 w-8 transition-transform duration-200" />
                </motion.button>

                {/* Enhanced Logo Container */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  {/* Pulsing glow effect */}
                  <motion.div
                    className="absolute w-[90%] h-[90%] bg-white/20 rounded-full blur-3xl"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Main Logo with Enhanced Animations */}
                  <motion.div
                    className="relative w-full h-full flex items-center justify-center z-10"
                    initial={{ rotate: -20, scale: 0.6, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 150,
                      damping: 20,
                      delay: 0.4,
                      duration: 1.2,
                    }}
                    whileHover={{
                      scale: 1.1,
                      rotate: [0, 5, -5, 0],
                      transition: {
                        duration: 0.6,
                        rotate: {
                          duration: 0.8,
                          ease: "easeInOut",
                        },
                      },
                    }}
                  >
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
                      alt="434 Media Logo"
                      width={800}
                      height={800}
                      className="object-contain w-full h-full max-w-[95%] max-h-[95%] drop-shadow-2xl filter brightness-0 invert"
                      priority
                    />

                    {/* Sparkle effects around logo */}
                    <motion.div
                      className="absolute top-1/4 left-1/4 w-3 h-3 bg-white rounded-full"
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: 0,
                      }}
                    />
                    <motion.div
                      className="absolute top-1/3 right-1/4 w-2 h-2 bg-white rounded-full"
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: 0.7,
                      }}
                    />
                    <motion.div
                      className="absolute bottom-1/3 left-1/3 w-2.5 h-2.5 bg-white rounded-full"
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: 1.4,
                      }}
                    />
                  </motion.div>
                </div>

                {/* Floating geometric shapes */}
                <motion.div
                  className="absolute top-1/4 right-1/4 w-6 h-6 bg-white/40 rotate-45"
                  animate={{
                    y: [0, -20, 0],
                    rotate: [45, 225, 45],
                    opacity: [0.4, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  className="absolute bottom-1/4 left-1/4 w-4 h-4 bg-white/50 rounded-full"
                  animate={{
                    x: [0, 15, 0],
                    y: [0, -10, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 7,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                />
              </motion.div>
            </div>

            {/* Mobile Close Button */}
            <motion.button
              onClick={onClose}
              className="lg:hidden absolute top-6 right-6 text-white p-3 rounded-full z-50 bg-black/30 backdrop-blur-sm hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 shadow-lg"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Close menu"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <i className="ri-close-line h-6 w-6" />
            </motion.button>

            {/* Mobile Logo Overlay */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.6 }}
              className="lg:hidden absolute bottom-8 right-8 w-16 h-16"
            >
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
                alt="434 Media Logo"
                width={64}
                height={64}
                className="object-contain w-full h-full opacity-70"
              />
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
