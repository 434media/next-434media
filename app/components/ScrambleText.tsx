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
  duration = 35, // Reduced duration for smoother animation
}) => {
  const [scrambledText, setScrambledText] = useState(text)
  const [isScrambled, setIsScrambled] = useState(scrambleOnMount)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

    intervalRef.current = setInterval(() => {
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

      if (Math.random() > 0.7) {
        index += 1
      }

      if (index > originalText.length) {
        clearInterval(intervalRef.current!)
        setScrambledText(originalText)
        setIsScrambled(false)
      }
    }, duration)
  }, [text, duration])

  // Effect for initial scramble on mount
  useEffect(() => {
    if (scrambleOnMount) {
      scramble()
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [scrambleOnMount, scramble])

  const handleMouseEnter = () => {
    if (scrambleOnHover && !isScrambled) {
      setIsScrambled(true)
      scramble()
    }
  }

  const handleMouseLeave = () => {
    if (scrambleOnHover) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      setScrambledText(text)
      setIsScrambled(false)
    }
  }

  return (
    <span
      className={`${className} transition-all duration-100`} // Added smooth transition
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ fontVariantNumeric: "tabular-nums" }} // Prevent layout shift during scramble
    >
      {scrambledText}
    </span>
  )
}
