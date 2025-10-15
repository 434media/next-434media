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
  duration = 25, // Reduced duration for faster animation
}) => {
  const [scrambledText, setScrambledText] = useState(text)
  const [isScrambled, setIsScrambled] = useState(scrambleOnMount)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const animationFrameRef = useRef<number | null>(null) // Added RAF for smoother animation

  const scramble = useCallback(() => {
    let index = 0
    const originalText = text
    const alphaNumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    const tech = "01010101"
    const characters = alphaNumeric + symbols + tech

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    const animate = () => {
      let newText = ""
      for (let i = 0; i < originalText.length; i++) {
        if (originalText[i] === " ") {
          newText += " "
        } else if (i < index) {
          newText += originalText[i]
        } else if (i === index) {
          newText += characters[Math.floor(Math.random() * characters.length)]
        } else {
          const charSet = i % 3 === 0 ? alphaNumeric : i % 3 === 1 ? symbols : tech
          newText += charSet[Math.floor(Math.random() * charSet.length)]
        }
      }
      setScrambledText(newText)

      if (Math.random() > 0.6) {
        index += 1
      }

      if (index > originalText.length) {
        setScrambledText(originalText)
        setIsScrambled(false)
      } else {
        intervalRef.current = setTimeout(animate, duration)
      }
    }

    animate()
  }, [text, duration])

  // Effect for initial scramble on mount
  useEffect(() => {
    if (scrambleOnMount) {
      scramble()
    }
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [scrambleOnMount, scramble])

  const handleMouseEnter = useCallback(() => {
    if (scrambleOnHover && !isScrambled) {
      setIsScrambled(true)
      scramble()
    }
  }, [scrambleOnHover, isScrambled, scramble])

  const handleMouseLeave = useCallback(() => {
    if (scrambleOnHover) {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setScrambledText(text)
      setIsScrambled(false)
    }
  }, [scrambleOnHover, text])

  return (
    <span
      className={`${className}`} // Removed transition to prevent layout conflicts
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        fontVariantNumeric: "tabular-nums",
        willChange: isScrambled ? "contents" : "auto",
      }}
    >
      {scrambledText}
    </span>
  )
}
