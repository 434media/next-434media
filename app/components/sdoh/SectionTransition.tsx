"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "motion/react"

interface SectionTransitionProps {
  variant?: "lines" | "dotted" | "gradient" | "circuit" | "wave"
  colorScheme?: "magenta" | "orange" | "mixed"
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl"
  className?: string
  children?: React.ReactNode
}

/**
 * SectionTransition - Decorative lines that fill the white space on left/right
 * of content containers, creating visual continuity as users scroll.
 * 
 * Inspired by MHMxVelocity Impact Report design patterns with flowing wave curves.
 * Brand colors: Magenta (#A31545) and Orange (#FF6B35)
 */
export function SectionTransition({
  variant = "lines",
  colorScheme = "magenta",
  maxWidth = "5xl",
  className = "",
  children,
}: SectionTransitionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: false, margin: "-100px" })

  const maxWidthClasses = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  }

  const colors = {
    magenta: { primary: "bg-[#A31545]", secondary: "bg-[#C41E54]", accent: "bg-[#8B1E3F]" },
    orange: { primary: "bg-[#FF6B35]", secondary: "bg-[#FF8C5A]", accent: "bg-[#F26522]" },
    mixed: { primary: "bg-[#A31545]", secondary: "bg-[#FF6B35]", accent: "bg-[#C41E54]" },
  }

  const colorSet = colors[colorScheme]

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Left Side Decorative Lines */}
      <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 lg:w-32 xl:w-48 hidden lg:flex flex-col items-end justify-center pointer-events-none overflow-hidden">
        {variant === "lines" && (
          <LinesPattern isInView={isInView} side="left" colorSet={colorSet} />
        )}
        {variant === "dotted" && (
          <DottedPattern isInView={isInView} side="left" colorSet={colorSet} />
        )}
        {variant === "gradient" && (
          <GradientPattern isInView={isInView} side="left" colorSet={colorSet} />
        )}
        {variant === "circuit" && (
          <CircuitPattern isInView={isInView} side="left" colorSet={colorSet} />
        )}
        {variant === "wave" && (
          <WavePattern isInView={isInView} side="left" colorScheme={colorScheme} />
        )}
      </div>

      {/* Right Side Decorative Lines */}
      <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 lg:w-32 xl:w-48 hidden lg:flex flex-col items-start justify-center pointer-events-none overflow-hidden">
        {variant === "lines" && (
          <LinesPattern isInView={isInView} side="right" colorSet={colorSet} />
        )}
        {variant === "dotted" && (
          <DottedPattern isInView={isInView} side="right" colorSet={colorSet} />
        )}
        {variant === "gradient" && (
          <GradientPattern isInView={isInView} side="right" colorSet={colorSet} />
        )}
        {variant === "circuit" && (
          <CircuitPattern isInView={isInView} side="right" colorSet={colorSet} />
        )}
        {variant === "wave" && (
          <WavePattern isInView={isInView} side="right" colorScheme={colorScheme} />
        )}
      </div>

      {/* Content */}
      <div className={`relative z-10 mx-auto ${maxWidthClasses[maxWidth]}`}>
        {children}
      </div>
    </div>
  )
}

// Lines Pattern - Simple horizontal lines
function LinesPattern({ 
  isInView, 
  side, 
  colorSet 
}: { 
  isInView: boolean
  side: "left" | "right"
  colorSet: { primary: string; secondary: string; accent: string }
}) {
  return (
    <div className="space-y-8">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className={`h-[2px] ${i % 2 === 0 ? colorSet.primary : colorSet.secondary}`}
          initial={{ width: 0, opacity: 0 }}
          animate={isInView ? { 
            width: [16, 32, 48, 24, 40][i], 
            opacity: [0.3, 0.5, 0.7, 0.4, 0.6][i] 
          } : { width: 0, opacity: 0 }}
          transition={{ 
            duration: 0.6, 
            delay: i * 0.1,
            ease: "easeOut"
          }}
          style={{
            marginLeft: side === "left" ? "auto" : 0,
            marginRight: side === "right" ? "auto" : 0,
          }}
        />
      ))}
    </div>
  )
}

// Dotted Pattern - Animated dots
function DottedPattern({ 
  isInView, 
  side, 
  colorSet 
}: { 
  isInView: boolean
  side: "left" | "right"
  colorSet: { primary: string; secondary: string; accent: string }
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.div
          key={i}
          className={`rounded-full ${i % 3 === 0 ? colorSet.primary : i % 3 === 1 ? colorSet.secondary : colorSet.accent}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { 
            scale: 1, 
            opacity: [0.3, 0.6, 0.4, 0.7, 0.5, 0.4, 0.6][i]
          } : { scale: 0, opacity: 0 }}
          transition={{ 
            duration: 0.4, 
            delay: i * 0.08,
            ease: "easeOut"
          }}
          style={{
            width: [6, 4, 8, 4, 6, 4, 8][i],
            height: [6, 4, 8, 4, 6, 4, 8][i],
          }}
        />
      ))}
    </div>
  )
}

// Gradient Pattern - Fading lines
function GradientPattern({ 
  isInView, 
  side, 
  colorSet 
}: { 
  isInView: boolean
  side: "left" | "right"
  colorSet: { primary: string; secondary: string; accent: string }
}) {
  return (
    <motion.div
      className={`w-full h-64 ${side === "left" ? "bg-gradient-to-r" : "bg-gradient-to-l"} from-transparent via-[#A31545]/20 to-[#A31545]/40`}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className={`absolute ${side === "left" ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 space-y-4`}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`h-[1px] ${colorSet.primary}`}
            initial={{ width: 0 }}
            animate={isInView ? { width: [20, 32, 24][i] } : { width: 0 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// Wave Pattern - Flowing curves inspired by MHMxVelocity Impact Report
function WavePattern({ 
  isInView, 
  side, 
  colorScheme 
}: { 
  isInView: boolean
  side: "left" | "right"
  colorScheme: "magenta" | "orange" | "mixed"
}) {
  const strokeColors = {
    magenta: ["#A31545", "#C41E54", "#8B1E3F"],
    orange: ["#FF6B35", "#FF8C5A", "#F26522"],
    mixed: ["#A31545", "#FF6B35", "#C41E54"],
  }
  
  const strokes = strokeColors[colorScheme]
  
  return (
    <motion.div
      className="relative w-full h-80"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <svg
        viewBox="0 0 100 300"
        className={`absolute ${side === "left" ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 h-full w-auto`}
        style={{ transform: side === "right" ? "scaleX(-1) translateY(-50%)" : "translateY(-50%)" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.path
            key={i}
            d={`M ${80 - i * 12} 0 Q ${40 - i * 8} 75, ${70 - i * 10} 150 T ${80 - i * 12} 300`}
            fill="none"
            stroke={strokes[i % 3]}
            strokeWidth={1.5 - i * 0.2}
            strokeOpacity={0.6 - i * 0.1}
            initial={{ pathLength: 0 }}
            animate={isInView ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
          />
        ))}
      </svg>
    </motion.div>
  )
}

// Circuit Pattern - Tech-inspired connecting lines
function CircuitPattern({ 
  isInView, 
  side, 
  colorSet 
}: { 
  isInView: boolean
  side: "left" | "right"
  colorSet: { primary: string; secondary: string; accent: string }
}) {
  return (
    <div className="relative h-96 w-full">
      {/* Vertical line */}
      <motion.div
        className={`absolute ${side === "left" ? "right-4" : "left-4"} top-0 w-[2px] ${colorSet.primary}`}
        initial={{ height: 0 }}
        animate={isInView ? { height: "100%" } : { height: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      
      {/* Horizontal branches */}
      {[0.2, 0.4, 0.6, 0.8].map((position, i) => (
        <motion.div
          key={i}
          className={`absolute ${side === "left" ? "right-4" : "left-4"} h-[2px] ${i % 2 === 0 ? colorSet.primary : colorSet.secondary}`}
          style={{ top: `${position * 100}%` }}
          initial={{ width: 0 }}
          animate={isInView ? { width: [24, 16, 32, 20][i] } : { width: 0 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.15 }}
        />
      ))}
      
      {/* Junction dots */}
      {[0.2, 0.4, 0.6, 0.8].map((position, i) => (
        <motion.div
          key={`dot-${i}`}
          className={`absolute ${side === "left" ? "right-3" : "left-3"} w-3 h-3 rounded-full ${colorSet.accent}`}
          style={{ top: `calc(${position * 100}% - 6px)` }}
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
        />
      ))}
    </div>
  )
}

/**
 * SectionDivider - A horizontal decorative divider between sections
 */
export function SectionDivider({
  variant = "simple",
  colorScheme = "mixed",
}: {
  variant?: "simple" | "double" | "connector"
  colorScheme?: "magenta" | "orange" | "mixed"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: false, margin: "-50px" })

  const colors = {
    magenta: { line1: "bg-[#A31545]", line2: "bg-[#C41E54]", dot: "bg-[#A31545]" },
    orange: { line1: "bg-[#FF6B35]", line2: "bg-[#FF8C5A]", dot: "bg-[#FF6B35]" },
    mixed: { line1: "bg-[#A31545]", line2: "bg-[#FF6B35]", dot: "bg-neutral-900" },
  }

  const colorSet = colors[colorScheme]

  if (variant === "simple") {
    return (
      <div ref={ref} className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            className={`h-[2px] ${colorSet.line1}`}
            initial={{ width: 0, marginLeft: "50%", marginRight: "50%" }}
            animate={isInView ? { width: "100%", marginLeft: 0, marginRight: 0 } : { width: 0, marginLeft: "50%", marginRight: "50%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    )
  }

  if (variant === "double") {
    return (
      <div ref={ref} className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-2">
          <motion.div
            className={`h-[2px] ${colorSet.line1}`}
            initial={{ width: 0, marginLeft: "50%", marginRight: "50%" }}
            animate={isInView ? { width: "100%", marginLeft: 0, marginRight: 0 } : { width: 0, marginLeft: "50%", marginRight: "50%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.div
            className={`h-[2px] ${colorSet.line2}`}
            initial={{ width: 0, marginLeft: "50%", marginRight: "50%" }}
            animate={isInView ? { width: "60%", marginLeft: "20%", marginRight: "20%" } : { width: 0, marginLeft: "50%", marginRight: "50%" }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>
      </div>
    )
  }

  // Connector variant - lines connecting to a center point
  return (
    <div ref={ref} className="py-16 sm:py-20 lg:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-center gap-4">
          {/* Left line */}
          <motion.div
            className={`h-[2px] ${colorSet.line1} flex-1`}
            initial={{ scaleX: 0, transformOrigin: "right" }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          
          {/* Center dot */}
          <motion.div
            className={`w-4 h-4 ${colorSet.dot} rounded-full flex-shrink-0`}
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : { scale: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          />
          
          {/* Right line */}
          <motion.div
            className={`h-[2px] ${colorSet.line2} flex-1`}
            initial={{ scaleX: 0, transformOrigin: "left" }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * ImpactStatistic - Animated statistic display for impact report sections
 */
export function ImpactStatistic({
  value,
  label,
  suffix = "",
  prefix = "",
  colorScheme = "magenta",
}: {
  value: number
  label: string
  suffix?: string
  prefix?: string
  colorScheme?: "magenta" | "orange" | "mixed"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (isInView) {
      const duration = 2000
      const steps = 60
      const increment = value / steps
      let current = 0
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(timer)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, duration / steps)
      return () => clearInterval(timer)
    }
  }, [isInView, value])

  const colors = {
    magenta: "text-[#A31545]",
    orange: "text-[#FF6B35]",
    mixed: "text-[#A31545]",
  }

  return (
    <motion.div
      ref={ref}
      className="text-center overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6 }}
    >
      <div className={`text-2xl sm:text-3xl md:text-4xl font-black ${colors[colorScheme]} whitespace-nowrap`}>
        {prefix}{displayValue.toLocaleString()}{suffix}
      </div>
      <div className="text-neutral-600 text-xs sm:text-sm mt-2 font-medium leading-tight">
        {label}
      </div>
    </motion.div>
  )
}

export default SectionTransition
