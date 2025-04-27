"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { motion, useInView, useAnimation } from "motion/react"

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
  direction?: "up" | "down" | "left" | "right" | "none"
  distance?: number
  once?: boolean
  threshold?: number
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
  direction = "up",
  distance = 20,
  once = true,
  threshold = 0.1,
}: FadeInProps) {
  const controls = useAnimation()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: threshold })
  const [hasAnimated, setHasAnimated] = useState(false)

  // Determine the initial and animate values based on the direction
  const getDirectionalValues = () => {
    switch (direction) {
      case "up":
        return { y: distance, opacity: 0 }
      case "down":
        return { y: -distance, opacity: 0 }
      case "left":
        return { x: distance, opacity: 0 }
      case "right":
        return { x: -distance, opacity: 0 }
      case "none":
        return { opacity: 0 }
      default:
        return { y: distance, opacity: 0 }
    }
  }

  useEffect(() => {
    if (isInView && !hasAnimated) {
      controls.start({
        x: 0,
        y: 0,
        opacity: 1,
        transition: {
          duration,
          delay,
          ease: [0.25, 0.1, 0.25, 1.0], // Improved easing function
        },
      })
      setHasAnimated(true)
    }
  }, [isInView, controls, delay, duration, hasAnimated])

  return (
    <motion.div ref={ref} className={className} initial={getDirectionalValues()} animate={controls}>
      {children}
    </motion.div>
  )
}
