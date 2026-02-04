"use client"

import { useEffect, useState } from "react"
import { HeroVideoSection } from "./HeroVideoSection"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

export interface SDOHHeroProps {
  locale: Locale
  dict?: Dictionary
}

/**
 * SDOHHero - Just the hero video section
 * 
 * Other sections (Intro, Partnership, Stats, etc.) are now separate components
 * for easier page flow ordering.
 */
export default function SDOHHero({ locale = "en" }: SDOHHeroProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
      setPrefersReducedMotion(mediaQuery.matches)

      const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return <HeroVideoSection prefersReducedMotion={prefersReducedMotion} />
}
