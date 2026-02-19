"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"

interface ScrambleTextProps {
  text: string
  className?: string
  scrambleOnMount?: boolean
  scrambleOnHover?: boolean
  duration?: number
}

export const ScrambleText: React.FC<ScrambleTextProps> = ({
  text,
  className = "",
  scrambleOnMount = false,
  scrambleOnHover = false,
  duration = 30,
}) => {
  const [scrambledText, setScrambledText] = useState(text)
  const [isScrambling, setIsScrambling] = useState(false)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  const scramble = useCallback(() => {
    const originalText = text
    // Clean character set — uppercase alpha only for a refined look
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const totalDuration = originalText.length * duration
    setIsScrambling(true)
    startTimeRef.current = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / totalDuration, 1)
      // Number of characters that have resolved
      const resolved = Math.floor(progress * originalText.length)

      let result = ""
      for (let i = 0; i < originalText.length; i++) {
        if (originalText[i] === " ") {
          result += " "
        } else if (i < resolved) {
          result += originalText[i]
        } else {
          result += chars[Math.floor(Math.random() * chars.length)]
        }
      }

      setScrambledText(result)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setScrambledText(originalText)
        setIsScrambling(false)
      }
    }

    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(animate)
  }, [text, duration])

  useEffect(() => {
    if (scrambleOnMount) {
      scramble()
    }
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [scrambleOnMount, scramble])

  const handleMouseEnter = useCallback(() => {
    if (scrambleOnHover && !isScrambling) {
      scramble()
    }
  }, [scrambleOnHover, isScrambling, scramble])

  const handleMouseLeave = useCallback(() => {
    if (scrambleOnHover) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      setScrambledText(text)
      setIsScrambling(false)
    }
  }, [scrambleOnHover, text])

  return (
    <span
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
      }}
    >
      {scrambledText}
    </span>
  )
}
