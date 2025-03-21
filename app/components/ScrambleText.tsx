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
  duration = 50,
}) => {
  const [scrambledText, setScrambledText] = useState(text)
  const [isScrambled, setIsScrambled] = useState(scrambleOnMount)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Define scramble function with useCallback to avoid recreating it on every render
  const scramble = useCallback(() => {
    let index = 0
    const originalText = text
    const characters = "!<>-_\\/[]{}—=+*^?#________"

    intervalRef.current = setInterval(() => {
      let newText = ""
      for (let i = 0; i < originalText.length; i++) {
        if (i < index) {
          newText += originalText[i]
        } else {
          newText += characters[Math.floor(Math.random() * characters.length)]
        }
      }
      setScrambledText(newText)
      index += 1

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
      clearInterval(intervalRef.current!)
      setScrambledText(text)
      setIsScrambled(false)
    }
  }

  return (
    <span className={className} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {scrambledText}
    </span>
  )
}

