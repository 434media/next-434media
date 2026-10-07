"use client"

import { HeroSection } from "@/components/HeroSection"

// NewsletterPopup was imported here, with a timer that set state, but never
// rendered. Both are gone so the popup's motion code cannot reach the homepage
// (2b fix 10); the component itself is untouched and unused.
export default function HomeClient() {
  return (
    <>
      <HeroSection />
    </>
  )
}
