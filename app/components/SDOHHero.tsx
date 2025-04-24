"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion, useAnimation, useInView } from "motion/react"
import { useMobile } from "../hooks/use-mobile"
import { PartnerLogos } from "./PartnerLogos"
import { FadeIn } from "./FadeIn"
import Link from "next/link"

// Update the SpeakerCard component for better mobile display and accessibility
const SpeakerCard = ({
  name,
  title,
  company,
  imageUrl,
  logoUrl,
  role = "Speaker", // Default role is Speaker, can be overridden for Moderator
}: {
  name: string
  title: string
  company: string
  imageUrl: string
  logoUrl: string
  role?: "Moderator" | "Speaker"
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isTouched, setIsTouched] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const isMobile = useMobile()
  const cardRef = useRef<HTMLDivElement>(null)

  // For mobile, toggle on touch instead of hover
  const handleTouch = () => {
    if (isMobile) {
      setIsTouched(!isTouched)
    }
  }

  // Handle keyboard focus for accessibility
  const handleFocus = () => setIsFocused(true)
  const handleBlur = () => setIsFocused(false)

  // Use either hover, touch, or focus state depending on interaction method
  const isActive = isMobile ? isTouched : isHovered || isFocused

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setIsTouched(!isTouched)
    }
  }

  return (
    <motion.div
      ref={cardRef}
      className="bg-white rounded-xl shadow-md overflow-hidden relative h-[240px] sm:h-[280px]"
      whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleTouch}
      onTouchEnd={handleTouch}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`${name}, ${title} at ${company}, ${role}`}
    >
      {/* Role tag - positioned at the top right */}
      <div
        className={`absolute top-2 sm:top-3 right-2 sm:right-3 z-20 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
          role === "Moderator"
            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
            : "bg-cyan-100 text-cyan-800 border border-cyan-300"
        }`}
        aria-hidden="true"
      >
        {role}
      </div>

      <div className="p-4 sm:p-6 flex flex-col items-center justify-center h-full">
        {/* Speaker info with image */}
        <motion.div
          className="flex flex-col items-center text-center"
          animate={{ opacity: isActive ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 sm:mb-4 border-2 border-yellow-300/30">
            <Image
              src={imageUrl || "/placeholder.svg?height=96&width=96&query=person"}
              alt={`Photo of ${name}`}
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="font-bold text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600">
            {name}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">
            {title}, {company}
          </p>
        </motion.div>

        {/* Company logo on hover/touch - darker background but keep RGV color accents */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col items-center justify-center">
            <motion.div animate={{ scale: isActive ? 1.1 : 1 }} transition={{ duration: 0.3 }}>
              <Image
                src={logoUrl || "/placeholder.svg?height=150&width=150&query=company logo"}
                alt={`${company} logo`}
                width={150}
                height={75}
                className="h-auto max-h-20 sm:max-h-28 w-auto object-contain mb-3 sm:mb-4"
              />
            </motion.div>
            <p className="text-sm sm:text-base font-medium text-cyan-400 border-t border-yellow-300/30 pt-2 sm:pt-3 mt-1 sm:mt-2">
              {company}
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Scroll indicator component for better UX
const ScrollIndicator = () => {
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-bounce">
      <span className="sr-only">Scroll down for more content</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white drop-shadow-md"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    </div>
  )
}

// Update the SDOHHero component to add more spacing and improve the layout
export function SDOHHero() {
  const controls = useAnimation()
  const heroRef = useRef<HTMLElement>(null)
  const detailsRef = useRef<HTMLElement>(null)
  const isHeroInView = useInView(heroRef, { once: true })
  const isDetailsInView = useInView(detailsRef, { once: true, amount: 0.1 })
  const isMobile = useMobile()
  const [hasScrolled, setHasScrolled] = useState(false)
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

  // Common heading styles for consistency
  const gradientHeadingClass = "font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600"
  const sectionHeadingClass = `${gradientHeadingClass} text-3xl md:text-4xl lg:text-5xl mb-6 md:mb-8 text-center`
  const subHeadingClass = `${gradientHeadingClass} text-2xl md:text-3xl mb-4`

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setHasScrolled(true)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (isHeroInView) {
      controls.start("visible")
    }
  }, [controls, isHeroInView])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  }

  // Placeholder company logos - replace with actual logos
  const companyLogos = {
    "434 MEDIA": "https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png",
    "Emerge and Rise": "https://ampd-asset.s3.us-east-2.amazonaws.com/WY%2Blogo.png",
    "The SAVE Clinic": "https://ampd-asset.s3.us-east-2.amazonaws.com/save-nobg.png",
    "Tabiat Research": "https://ampd-asset.s3.us-east-2.amazonaws.com/tabiat.svg",
  }

  return (
    <>
      {/* Hero section with responsive images */}
      <section
        className="relative w-full h-screen overflow-hidden"
        ref={heroRef}
        aria-label="SDOH Conference Hero Banner"
      >
        {/* Desktop hero image - hidden on mobile */}
        <div className="hidden md:block w-full h-full">
          <Image
            src="https://ampd-asset.s3.us-east-2.amazonaws.com/AWARENESS+DRIVES+INNOVATION+Desktop.png"
            alt="SDOH Conference - Awareness Drives Innovation"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {/* Mobile hero image - shown only on mobile */}
        <div className="block md:hidden w-full h-full">
          <Image
            src="https://ampd-asset.s3.us-east-2.amazonaws.com/AWARENESS+DRIVES+INNOVATION+Mobile.png"
            alt="SDOH Conference - Awareness Drives Innovation"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {/* Scroll indicator */}
        {!prefersReducedMotion && <ScrollIndicator />}
      </section>

      {/* What is SDOH Section */}
      <section className="py-16 sm:py-24 bg-neutral-50">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <FadeIn>
            <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-16">
              <h2 className={sectionHeadingClass}>
                <span className="block text-xs sm:text-sm font-semibold text-neutral-500 mb-2">
                  What the heck is Social Determinants of Health?
                </span>
                <span className="block">¿Qué es SDOH?</span>
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-neutral-700 leading-relaxed max-w-prose mx-auto">
                <strong>Social Determinants of Health (SDOH)</strong> are the conditions in the environments where
                people are born, live, learn, work, play, worship, and age that affect a wide range of health,
                functioning, and quality-of-life outcomes and risks.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-12 mb-10 sm:mb-16">
              <div className="bg-white p-5 sm:p-8 rounded-xl shadow-md border-l-4 border-cyan-500">
                <h3 className={subHeadingClass}>Why It Matters</h3>
                <p className="text-base sm:text-lg text-neutral-700">
                  SDOH can be grouped into 5 domains: economic stability, education access and quality, health care
                  access and quality, neighborhood and built environment, and social and community context. SDOH
                  contribute to wide health disparities and inequities. For example, people who don&apos;t have access
                  to grocery stores with healthy foods are less likely to have good nutrition. That raises their risk of
                  health conditions like heart disease, diabetes, and obesity — and even lowers life expectancy.
                </p>
              </div>

              <div className="bg-white p-5 sm:p-8 rounded-xl shadow-md border-l-4 border-yellow-300">
                <h3 className={subHeadingClass}>Our Focus</h3>
                <p className="text-base sm:text-lg text-neutral-700">
                  This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how
                  we can address SDOH in the Rio Grande Valley. We&apos;ll explore how technology, community engagement,
                  and cross-sector collaboration can create sustainable solutions to improve health outcomes for all
                  residents.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Event details section that appears on scroll */}
      <section ref={detailsRef} className="bg-white py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          {/* In Partnership With section */}
          <div className="mb-16 sm:mb-28">
            <h2 className={sectionHeadingClass}>In Partnership With</h2>
            <div className="flex flex-wrap justify-center items-center">
              <div className="w-full">
                <PartnerLogos />
              </div>
            </div>
          </div>

          {/* Video Section - Redesigned */}
          <div className="max-w-6xl mx-auto mb-16 sm:mb-28">
            <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-xl overflow-hidden shadow-lg border border-cyan-500/30">
              <div className="aspect-video relative flex items-center justify-center">
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div
                    className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-6 border-2 border-yellow-300/30"
                    role="button"
                    tabIndex={0}
                    aria-label="Play video: ¿Qué es SDOH? (Coming Soon)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        // Video play functionality would go here
                      }
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-16 w-16 text-white"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>

                {/* Coming soon text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
                  <h3 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300 mb-4">
                    COMING SOON
                  </h3>
                  <p className="text-xl md:text-2xl text-cyan-300 mb-2">¿Qué es SDOH?</p>
                  <p className="text-lg md:text-xl text-white/80">An RGV Startup Week Main Stage Panel</p>
                </div>

                {/* Video thumbnail background with gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 z-[1]"></div>

                {/* Background image */}
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/QueEsSDOHStory.png"
                  alt="Video thumbnail for ¿Qué es SDOH?"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                  className="object-cover opacity-30 z-0"
                />
              </div>
            </div>
          </div>

          {/* Event Details Section */}
          <section className="py-8 sm:py-16">
            <div className="container px-4 sm:px-6 max-w-5xl mx-auto text-center">
              <FadeIn>
                <h2 className={sectionHeadingClass}>¿WTF es SDOH? And What It Means to Y-O-U!</h2>
                <p className="text-lg sm:text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-2xl mx-auto mb-8 sm:mb-12">
                  Join us for a panel discussion on{" "}
                  <strong className="text-cyan-600">Social Determinants of Health</strong> during RGV Startup Week.
                  Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.
                </p>

                {/* Event Card Design */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-3xl mx-auto border border-cyan-100">
                  <div className="grid md:grid-cols-2">
                    {/* Left side - Date and Time */}
                    <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white p-6 sm:p-10 flex flex-col justify-center">
                      <h3 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-white">When</h3>
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-white/20 p-3 rounded-full">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 sm:h-8 w-6 sm:w-8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          </div>
                          <div>
                            <span className="font-medium text-base sm:text-xl block text-white/90">Monday</span>
                            <span className="font-bold text-lg sm:text-2xl block mt-1">April 28, 2025</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="bg-white/20 p-3 rounded-full">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 sm:h-8 w-6 sm:w-8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                          </div>
                          <div>
                            <span className="font-medium text-base sm:text-xl block text-white/90">Time</span>
                            <span className="font-bold text-lg sm:text-2xl block mt-1">1:00 PM – 1:45 PM</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - Location */}
                    <div className="p-6 sm:p-10 flex flex-col justify-center bg-white">
                      <h3 className={subHeadingClass}>Where</h3>
                      <div className="flex items-start gap-4">
                        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 sm:h-8 w-6 sm:w-8"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                        </div>
                        <div>
                          <span className="font-bold text-lg sm:text-2xl block text-neutral-800">eBridge Center</span>
                          <span className="text-base sm:text-xl text-neutral-600 block mt-2">1304 E Adams St</span>
                          <span className="text-base sm:text-xl text-neutral-600 block">Brownsville, TX 78520</span>
                          <Link
                            href="https://maps.google.com/?q=1304+E+Adams+St,+Brownsville,+TX+78520"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-4 text-cyan-600 hover:text-cyan-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 rounded-md"
                          >
                            View on Google Maps
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 ml-1"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <line x1="7" y1="17" x2="17" y2="7"></line>
                              <polyline points="7 7 17 7 17 17"></polyline>
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom CTA */}
                  <div className="bg-neutral-50 p-6 flex justify-center border-t border-neutral-100">
                    <Link
                      href="https://rgvsw25.events.whova.com/registration"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-500 text-neutral-900 font-bold py-3 px-8 rounded-full text-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                    >
                      Register for RGV Startup Week
                      <span className="ml-2 inline-block" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </div>
                </div>
              </FadeIn>
            </div>
          </section>

          {/* Panel Speakers Section */}
          <div className="mt-12 sm:mt-20">
            <h2 className={sectionHeadingClass}>Panel Speakers</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 max-w-6xl mx-auto">
              {/* Moderator */}
              <SpeakerCard
                name="Marcos Resendez"
                title="Founder"
                company="434 MEDIA"
                imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/49d10ec854acc0af8a20810dd891eafb.jpeg"
                logoUrl={companyLogos["434 MEDIA"]}
                role="Moderator"
              />

              {/* Speaker 1 */}
              <SpeakerCard
                name="Dr. Lyssa Ochoa"
                title="Founder"
                company="SAVE Clinic"
                imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Lyssa_Ochoa_LinkedIn_Headshot.jpeg"
                logoUrl={companyLogos["The SAVE Clinic"]}
              />

              {/* Speaker 2 */}
              <SpeakerCard
                name="Daniyal Liaqat"
                title="Founder, 2024 MHM Accelerator Cohort"
                company="Tabiat"
                imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/daniyal-liaqat.jpeg"
                logoUrl={companyLogos["Tabiat Research"]}
              />

              {/* Speaker 3 */}
              <SpeakerCard
                name="Lina Rugova"
                title="Founder"
                company="Emerge & Rise"
                imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/lina-rugova.jpeg"
                logoUrl={companyLogos["Emerge and Rise"]}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
