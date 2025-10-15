"use client"

import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import { useCallback, useEffect, useState, useRef } from "react"
import { Vortex } from "./vortex"
import { XCircleIcon } from "lucide-react"

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
    title: "EVENTS",
    subtitle: "Where Networks Meet Action",
    href: "/events",
    gradient: "from-gray-900 via-gray-800 to-black",
    textColor: "text-white",
    delay: 0.3,
    size: "medium",
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
        return "col-span-1 row-span-1 h-32 md:col-span-1 md:row-span-2 md:h-48 lg:h-52 rounded-none md:rounded-3xl"
      case "medium":
        return "col-span-1 row-span-1 h-32 md:h-24 lg:h-26 rounded-none md:rounded-3xl"
      case "small":
        return "col-span-1 row-span-1 h-32 md:h-24 lg:h-26 rounded-none md:rounded-3xl"
      default:
        return "col-span-1 row-span-1 h-32 md:h-24 lg:h-26 rounded-none md:rounded-3xl"
    }
  }

  const renderNavigationSquares = useCallback(() => {
    return navigationSquares.map((square, index) => (
      <div
        key={square.id}
        className={`group relative overflow-hidden ${getSquareClasses(square.size)}`}
        onMouseEnter={() => setHoveredSquare(square.id)}
        onMouseLeave={() => setHoveredSquare(null)}
      >
        {(square.id === "digital-canvas" || hoveredSquare === square.id) && (
          <div className="absolute inset-0 z-0">
            <Vortex
              backgroundColor="#000"
              particleCount={200}
              baseHue={120 + index * 60}
              baseSpeed={0.15}
              rangeSpeed={1.2}
              baseRadius={0.8}
              rangeRadius={1.5}
              containerClassName="w-full h-full"
            />
          </div>
        )}

        <Link
          href={square.href}
          onClick={onClose}
          className="block relative w-full h-full"
          {...(square.id === "digital-canvas" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <div className="relative h-full flex flex-col justify-center items-center p-4 md:p-6 z-20 text-center">
            <div className="flex flex-col justify-center items-center">
              {square.logo ? (
                <div className="flex flex-col items-center justify-center space-y-2 md:space-y-3">
                  <div className="relative">
                    <img
                      src={square.logo || "/placeholder.svg"}
                      alt={square.title}
                      className="h-12 md:h-16 lg:h-20 w-auto object-contain drop-shadow-lg transition-colors duration-300"
                    />
                  </div>
                  <p
                    className={`block font-geist-sans text-xs md:text-sm lg:text-base ${square.textColor}/90 leading-relaxed drop-shadow-sm relative z-20`}
                  >
                    {square.subtitle}
                  </p>
                </div>
              ) : (
                <>
                  <h3
                    className={`font-ggx88 text-lg md:text-xl lg:text-2xl ${square.textColor} leading-tight mb-1.5 md:mb-2 drop-shadow-md relative z-20`}
                  >
                    {square.title}
                  </h3>
                  <p
                    className={`block font-geist-sans text-xs md:text-sm ${square.textColor}/90 leading-relaxed drop-shadow-sm relative z-20`}
                  >
                    {square.subtitle}
                  </p>
                </>
              )}
            </div>
          </div>
        </Link>
      </div>
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
              className="relative h-full bg-black overflow-y-auto md:overflow-hidden w-full"
            >
              <div className="h-full flex flex-col p-4 md:py-6 md:px-8 lg:py-8 lg:px-12">
                <div className="flex justify-end mb-3 md:mb-0">
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
                    <XCircleIcon className="h-6 w-6 md:h-8 md:w-8" />
                  </motion.button>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: -30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mb-4 md:mb-6 lg:mb-8 flex-shrink-0"
                >
                  <motion.p
                    className="max-w-sm mx-auto md:mx-0 md:px-12 lg:px-16 text-gray-100 font-semibold text-2xl lg:text-4xl md:max-w-4xl leading-snug md:leading-snug lg:leading-snug tracking-wide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
                    Explore how we blend creativity with community impact through innovative storytelling and design.
                  </motion.p>
                </motion.div>

                <div className="flex-grow flex flex-col justify-center md:justify-start">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-4 lg:gap-6 auto-rows-min max-w-full">
                    {renderNavigationSquares()}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
