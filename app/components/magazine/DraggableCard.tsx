"use client"

import { motion, useMotionValue, useTransform } from "motion/react"
import { useRef } from "react"
import type { MagazineSection } from "./MagazineData"

interface DraggableCardProps {
  section: MagazineSection
  onCardClick: (section: MagazineSection) => void
  className?: string
}

export function DraggableCard({ section, onCardClick, className = "" }: DraggableCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Motion values for smooth dragging
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Transform values for rotation during drag
  const rotateX = useTransform(y, [-100, 100], [5, -5])
  const rotateY = useTransform(x, [-100, 100], [-5, 5])

  // Get the first image from content or use a placeholder
  const coverImage =
    section.content?.images?.[0] ||
    section.content?.gallery?.[0]?.src ||
    "/placeholder.svg?height=400&width=300&text=Magazine+Cover"

  return (
    <motion.div
      ref={cardRef}
      className={`w-72 h-96 md:w-80 md:h-[28rem] cursor-grab active:cursor-grabbing group ${className}`}
      style={{ x, y, rotateX, rotateY }}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ left: -300, right: 300, top: -300, bottom: 300 }}
      whileHover={{ scale: 1.02 }}
      whileDrag={{
        scale: 1.05,
        zIndex: 1000,
        cursor: "grabbing",
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onCardClick(section)}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        mass: 0.5,
      }}
    >
      <div className="w-full h-full relative overflow-hidden rounded-lg shadow-2xl border-4 border-black will-change-transform">
        {/* Full Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${coverImage})`,
          }}
        />

        {/* Dark Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        {/* Content Overlay */}
        <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
          {/* Title */}
          <h3
            className="text-xl md:text-2xl font-black uppercase tracking-wide leading-tight mb-2 drop-shadow-lg"
            style={{
              fontFamily: "Impact, Arial Black, sans-serif",
              textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            {section.title}
          </h3>

          {/* Subtitle */}
          <h4
            className="text-sm md:text-base font-bold text-gray-200 uppercase tracking-wide mb-3 drop-shadow-md"
            style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
          >
            {section.subtitle}
          </h4>

          {/* Preview Text */}
          <p
            className="text-xs md:text-sm text-gray-300 line-clamp-3 drop-shadow-md"
            style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}
          >
            {section.preview}
          </p>
        </div>

        {/* Hover Effects */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none">
          {/* Animated Border on Hover */}
          <div className="absolute inset-0 border-4 border-transparent group-hover:border-white/50 transition-all duration-300 rounded-lg"></div>
        </div>

        {/* Comic Book Burst Effect on Hover */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-300">
          <motion.div
            className="relative"
            initial={{ scale: 0, rotate: 0 }}
            whileHover={{ scale: 1, rotate: 360 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Star burst rays */}
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="absolute bg-yellow-300/60 origin-bottom"
                style={{
                  width: "3px",
                  height: "40px",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                }}
              />
            ))}
            {/* Center circle */}
            <div className="w-6 h-6 bg-yellow-300/80 rounded-full relative z-10" />
          </motion.div>
        </div>

        {/* Shine effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </div>

        {/* Comic Book "POW!" style corner accent */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <motion.div
            className="bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full border-2 border-white transform rotate-12"
            initial={{ scale: 0, rotate: 0 }}
            whileHover={{ scale: 1, rotate: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            READ!
          </motion.div>
        </div>

        {/* Corner Accent */}
        <div className="absolute top-0 right-0 w-0 h-0 border-l-12 border-b-12 border-l-transparent border-b-white/20"></div>
      </div>
    </motion.div>
  )
}
