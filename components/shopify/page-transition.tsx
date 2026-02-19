"use client"

import { motion } from "motion/react"
import { usePathname } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [isFirstMount, setIsFirstMount] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Track mount state to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
    setIsFirstMount(false)
  }, [])

  // Skip opacity animation on admin pages - they handle their own transitions
  const isAdminPage = pathname?.startsWith("/admin")
  
  // For admin pages OR before hydration, render without motion wrapper
  // This prevents faded appearance during SSR/hydration
  if (isAdminPage || !isMounted) {
    return <>{children}</>
  }

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