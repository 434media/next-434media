"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useState, useRef } from "react"
import { GlowingEffect } from "./GlowingEffect"

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
  logo?: string
}

const navigationSquares: NavigationSquare[] = [
  {
    id: "digital-canvas",
    title: "DIGITAL CANVAS",
    subtitle: "Creative layer of 434 MEDIA",
    href: "https://www.digitalcanvas.community/",
    gradient: "from-gray-800 via-gray-700 to-gray-900",
    textColor: "text-white",
    delay: 0.1,
    size: "large",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-ymas.svg",
  },
  {
    id: "shop",
    title: "SHOP",
    subtitle: "Founders Tee Available Now",
    href: "/shop",
    gradient: "from-black via-gray-900 to-gray-800",
    textColor: "text-white",
    delay: 0.2,
    size: "large",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg",
  },
  {
    id: "sdoh",
    title: "¿Qué es SDOH?",
    subtitle: "Turn awareness into action",
    href: "/en/sdoh",
    gradient: "from-gray-700 via-gray-800 to-black",
    textColor: "text-white",
    delay: 0.15,
    size: "large",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg",
  },
  {
    id: "events",
    title: "COMMUNITY EVENTS",
    subtitle: "Where Networks Meet Action",
    href: "/events",
    gradient: "from-gray-900 via-gray-800 to-black",
    textColor: "text-white",
    delay: 0.3,
    size: "large",
  },
  {
    id: "blog",
    title: "BLOG",
    subtitle: "Insights & Stories",
    href: "/blog",
    gradient: "from-gray-900 via-black to-gray-800",
    textColor: "text-white",
    delay: 0.25,
    size: "medium",
  },
  {
    id: "contact",
    title: "CONTACT US",
    subtitle: "Take the next step",
    href: "/contact",
    gradient: "from-gray-800 via-gray-900 to-black",
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
        return "col-span-2 row-span-1 h-24 md:col-span-2 md:row-span-2 md:h-56 lg:h-64"
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
        <GlowingEffect
          variant="white"
          glow={true}
          disabled={true}
          proximity={50}
          spread={30}
          blur={2}
          borderWidth={2}
          className="rounded-3xl"
        />

        <Link
          href={square.href}
          onClick={onClose}
          className="block relative w-full h-full"
          {...(square.id === "digital-canvas" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {/* Gradient Background */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${square.gradient}`}
            animate={{
              scale: hoveredSquare === square.id ? 1.02 : 1,
              rotate: hoveredSquare === square.id ? 1 : 0,
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
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
                    className={`hidden md:block font-geist-sans text-sm md:text-base ${square.textColor}/90 leading-relaxed drop-shadow-sm relative z-20`}
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
                // Text version
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
                    className={`hidden md:block font-geist-sans text-sm md:text-base ${square.textColor}/90 leading-relaxed drop-shadow-sm relative z-20`}
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
                className="relative h-full bg-black overflow-y-auto"
              >
                <div className="h-full flex flex-col p-4 md:p-8 lg:p-12">
                  {/* Mobile Close Button - Fixed positioning */}
                  <div className="lg:hidden flex justify-end mb-4">
                    <motion.button
                      onClick={onClose}
                      className="text-white p-2 rounded-full z-50 bg-black/30 backdrop-blur-sm hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200 shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label="Close menu"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <i className="ri-close-line h-5 w-5" />
                    </motion.button>
                  </div>

                  {/* Header - Optimized spacing */}
                  <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-6 md:mb-8 lg:mb-12 flex-shrink-0"
                  >
                    <motion.p
                      className="text-gray-100 font-semibold text-xl md:text-2xl lg:text-3xl xl:text-4xl max-w-2xl leading-tight md:leading-tight lg:leading-tight tracking-wide text-center md:text-left"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                    >
                      Explore how we blend creativity with community impact through innovative storytelling and design.
                    </motion.p>
                  </motion.div>

                  {/* Navigation Grid - Flex-grow to fill remaining space */}
                  <div className="flex-grow flex flex-col justify-center">
                    <div className="grid grid-cols-4 gap-3 md:gap-6 lg:gap-8 auto-rows-min max-w-full">
                      {renderNavigationSquares()}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right Side - 434 Media Logo with Black and White Background */}
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
                  className="absolute inset-0 bg-black"
                  animate={{
                    background: [
                      "linear-gradient(135deg, #000000 0%, #1f2937 50%, #374151 100%)",
                      "linear-gradient(135deg, #111827 0%, #000000 50%, #1f2937 100%)",
                      "linear-gradient(135deg, #374151 0%, #111827 50%, #000000 100%)",
                      "linear-gradient(135deg, #1f2937 0%, #374151 50%, #111827 100%)",
                      "linear-gradient(135deg, #000000 0%, #1f2937 50%, #374151 100%)",
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
                  className="absolute top-1/4 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-2xl"
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
                  className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-gray-300/15 rounded-full blur-3xl"
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
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
