"use client"

import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [isFirstMount, setIsFirstMount] = useState(true)

  // Skip animation on first mount
  useEffect(() => {
    setIsFirstMount(false)
  }, [])

  return (
    <motion.div
      key={pathname}
      initial={isFirstMount ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}