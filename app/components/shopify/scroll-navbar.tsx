"use client"

import { motion, useScroll, useTransform } from "motion/react"
import type { ReactNode } from "react"

interface ScrollNavbarProps {
  children: ReactNode
}

export function ScrollNavbar({ children }: ScrollNavbarProps) {
  const { scrollY } = useScroll()
  const backgroundColor = useTransform(scrollY, [0, 100], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.9)"])
  const boxShadow = useTransform(scrollY, [0, 100], ["none", "0 2px 10px rgba(0, 0, 0, 0.1)"])

  return (
    <motion.header
      style={{ backgroundColor, boxShadow }}
      className="sticky top-0 z-40 w-full backdrop-blur-md transition-all duration-300"
    >
      {children}
    </motion.header>
  )
}