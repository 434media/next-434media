"use client"

import { useState, useEffect } from "react"
import { HeroSection } from "./components/HeroSection"
import TrustedBy from "./components/TrustedBy"
import NewsletterPopup from "./components/NewsletterPopup"

export default function Home() {
  const [showNewsletter, setShowNewsletter] = useState(false)

  // Show newsletter popup after 5 seconds on first visit
  useEffect(() => {
    const hasSeenNewsletter = localStorage.getItem("434-newsletter-seen")

    if (!hasSeenNewsletter) {
      const timer = setTimeout(() => {
        setShowNewsletter(true)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleCloseNewsletter = () => {
    setShowNewsletter(false)
    localStorage.setItem("434-newsletter-seen", "true")
  }

  return (
    <>
      <HeroSection />
      <TrustedBy />
      <NewsletterPopup showModal={showNewsletter} onClose={handleCloseNewsletter} />
    </>
  )
}
