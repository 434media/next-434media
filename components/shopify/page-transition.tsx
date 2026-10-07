"use client"

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
  
  // For admin pages OR before hydration, render without the fade wrapper
  // This prevents faded appearance during SSR/hydration
  if (isAdminPage || !isMounted) {
    return <>{children}</>
  }

  // Fades in over 0.3s (.m-page-fade, globals.css) each time the keyed
  // wrapper mounts — on every client navigation, and once after hydration,
  // exactly where motion animated (2b fix 10).
  return (
    <div key={pathname} className={isFirstMount ? undefined : "m-page-fade"}>
      {children}
    </div>
  )
}