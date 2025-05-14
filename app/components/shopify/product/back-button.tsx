"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import clsx from "clsx"

interface BackButtonProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "ghost" | "outline" | "solid"
  label?: string
  showLabel?: boolean
  showArrow?: boolean
  referrer?: string
}

export function BackButton({
  className,
  size = "md",
  variant = "ghost",
  label = "Back",
  showLabel = true,
  showArrow = true,
  referrer = "/shop",
}: BackButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle back navigation
  const handleBack = () => {
    try {
      window.history.back()

      // Fallback to router.push if history navigation doesn't work
      setTimeout(() => {
        // Check if we're still on the same page after 100ms
        if (window.location.pathname === pathname) {
          router.push(referrer)
        }
      }, 100)
    } catch (error) {
      console.error("Error navigating back:", error)
      // Direct fallback if history.back() fails
      router.push(referrer)
    }
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Navigate back on Backspace or Alt+Left Arrow
      if ((e.key === "Backspace" && !isInputElement(e.target)) || (e.key === "ArrowLeft" && e.altKey)) {
        e.preventDefault()
        handleBack()
      }

      // Navigate back on Escape if the button is focused
      if (e.key === "Escape" && document.activeElement === buttonRef.current) {
        e.preventDefault()
        try {
          window.history.back()

          // Fallback if Escape + history doesn't work
          setTimeout(() => {
            if (window.location.pathname === pathname) {
              router.push(referrer)
            }
          }, 100)
        } catch (error) {
          console.error("Error navigating back with Escape key:", error)
          router.push(referrer)
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [pathname, referrer, router])

  // Helper function to check if the target is an input element
  const isInputElement = (target: EventTarget | null): boolean => {
    if (!target) return false
    const element = target as HTMLElement
    const tagName = element.tagName.toLowerCase()
    return tagName === "input" || tagName === "textarea" || tagName === "select" || element.isContentEditable
  }

  // Size classes
  const sizeClasses = {
    sm: "h-8 text-xs",
    md: "h-10 text-sm",
    lg: "h-12 text-base",
  }

  // Variant classes
  const variantClasses = {
    ghost: "hover:bg-neutral-800 active:bg-neutral-700",
    outline: "border border-neutral-700 hover:bg-neutral-800 active:bg-neutral-700",
    solid: "bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600",
  }

  return (
    <motion.button
      ref={buttonRef}
      onClick={handleBack}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onBlur={() => {
        setIsHovered(false)
        setIsPressed(false)
      }}
      className={clsx(
        "flex items-center justify-center rounded-md px-3 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Go back"
    >
      {showArrow && (
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          className={clsx("h-4 w-4", showLabel && "mr-2")}
          viewBox="0 0 20 20"
          fill="currentColor"
          animate={{ x: isHovered ? -2 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </motion.svg>
      )}
      {showLabel && <span>{label}</span>}
    </motion.button>
  )
}
