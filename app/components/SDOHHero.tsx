"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion, useAnimation, useInView } from "motion/react"
import { useMobile } from "../hooks/use-mobile"
import { PartnerLogos } from "./PartnerLogos"
import { InteractiveSDOHLogo } from "./InteractiveSDOHLogo"
import { FadeIn } from "./FadeIn"

// Update the Particles component to respect reduced motion preferences
const Particles = ({ count = 40 }: { count?: number }) => {
  // Use useEffect and useState to ensure client-side only rendering
  const [particles, setParticles] = useState<
    Array<{
      id: number
      x: number
      y: number
      size: number
      speed: number
      color: string
    }>
  >([])

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    // Generate fewer particles on mobile
    const particleCount = isMobile ? Math.floor(count / 2) : count

    // Generate particles only on the client side to avoid hydration mismatch
    const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1, // Smaller particles on mobile
      speed: Math.random() * 0.2 + 0.1, // Slower movement
      color: Math.random() > 0.5 ? "cyan" : "yellow", // Use cyan and yellow colors
    }))
    setParticles(newParticles)
  }, [count, isMobile])

  if (particles.length === 0) {
    return null // Return null on initial server render
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full ${
            particle.color === "cyan"
              ? "bg-gradient-to-br from-cyan-400/20 to-cyan-600/20"
              : "bg-gradient-to-br from-yellow-300/20 to-yellow-500/20"
          } opacity-30`}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
          }}
          animate={
            prefersReducedMotion
              ? {}
              : {
                  y: ["0%", `${particle.speed * 30}%`], // Reduced movement range for mobile
                  x: [`0%`, `${(Math.random() - 0.5) * 5}%`], // Reduced movement range for mobile
                }
          }
          transition={{
            duration: 15 / particle.speed, // Slower animation
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

// Update the AnimatedGradient component to include cyan and yellow accents
const AnimatedGradient = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  return (
    <motion.div
      className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-800/80 via-neutral-900 to-neutral-700/50"
      animate={
        prefersReducedMotion
          ? {}
          : {
              background: [
                "linear-gradient(135deg, rgba(64,64,64,0.8) 0%, rgba(23,23,23,1) 50%, rgba(82,82,82,0.5) 100%)",
                "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(23,23,23,1) 50%, rgba(253,224,71,0.1) 100%)",
                "linear-gradient(135deg, rgba(64,64,64,0.8) 0%, rgba(23,23,23,1) 50%, rgba(82,82,82,0.5) 100%)",
              ],
            }
      }
      transition={{
        duration: 20,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse",
      }}
      aria-hidden="true"
    />
  )
}

// Update the SpeakerCard component for better mobile display
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
  const isMobile = useMobile()

  // For mobile, toggle on touch instead of hover
  const handleTouch = () => {
    if (isMobile) {
      setIsTouched(!isTouched)
    }
  }

  // Use either hover or touch state depending on device
  const isActive = isMobile ? isTouched : isHovered

  return (
    <motion.div
      className="bg-white rounded-xl shadow-md overflow-hidden relative h-[240px] sm:h-[280px]"
      whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleTouch}
      onTouchEnd={handleTouch}
    >
      {/* Role tag - positioned at the top right */}
      <div
        className={`absolute top-2 sm:top-3 right-2 sm:right-3 z-20 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${
          role === "Moderator"
            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
            : "bg-cyan-100 text-cyan-800 border border-cyan-300"
        }`}
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
              alt={name}
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

// Update the SDOHHero component to add more spacing and improve the layout
export function SDOHHero() {
  const controls = useAnimation()
  const heroRef = useRef(null)
  const detailsRef = useRef(null)
  const isHeroInView = useInView(heroRef, { once: true })
  const isDetailsInView = useInView(detailsRef, { once: true, amount: 0.1 })
  const isMobile = useMobile()

  // Scroll animation
  const [hasScrolled, setHasScrolled] = useState(false)

  // Common heading styles for consistency
  const gradientHeadingClass = "font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600"
  const sectionHeadingClass = `${gradientHeadingClass} text-3xl md:text-4xl lg:text-5xl mb-6 text-center`
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

  // Update the CTA button to use cyan and yellow accents
  return (
    <>
      {/* Hero section - only logo with interactive motion */}
      <section className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden bg-neutral-900">
        {/* Animated background particles - client-side only */}
        <Particles count={isMobile ? 20 : 40} />

        {/* Animated gradient background */}
        <AnimatedGradient />

        {/* Content overlay with improved contrast */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 to-transparent z-[1]"
          aria-hidden="true"
        />

        <div className="container mx-auto px-4 py-8 md:py-12 z-10 relative">
          <motion.div
            ref={heroRef}
            initial="hidden"
            animate={controls}
            variants={containerVariants}
            className="flex flex-col items-center justify-center h-screen"
          >
            {/* Interactive SDOH Logo - centered in hero */}
            <motion.div variants={itemVariants} className="w-full md:max-w-[65%] mx-auto">
              <InteractiveSDOHLogo />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Event details section that appears on scroll - add more spacing */}
      <motion.section
        ref={detailsRef}
        style={{ opacity: hasScrolled ? 1 : 0 }}
        animate={{ opacity: hasScrolled ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white py-24" // Increased padding
      >
        <div className="container mx-auto px-6 max-w-7xl">
          {" "}
          {/* Increased padding and max width */}
          {/* In Partnership With section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isDetailsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-28" // Increased margin
          >
            <h2 className={sectionHeadingClass}>In Partnership With</h2>
            <div className="mt-32 md:mt-0 flex flex-wrap justify-center items-center gap-12 md:gap-20">
              <div className="h-40 w-full flex items-center justify-center">
                <PartnerLogos />
              </div>
            </div>
          </motion.div>
          {/* Video Section - Redesigned */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isDetailsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-6xl mx-auto lg:mb-28 mt-40"
          >
            <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-xl overflow-hidden shadow-lg border border-cyan-500/30">
              <div className="aspect-video relative flex items-center justify-center">
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-6 border-2 border-yellow-300/30">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-16 w-16 text-white"
                      viewBox="0 0 24 24"
                      fill="currentColor"
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

                {/* Background image - fixed visibility issue */}
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/QueEsSDOHStory.png"
                  alt="Video placeholder"
                  fill
                  className="object-cover opacity-30 z-0"
                />
              </div>
            </div>
          </motion.div>
          {/* Event Details Section - Redesigned */}
          <section className="py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isDetailsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="container px-6 max-w-4xl mx-auto text-center" // Increased max width and margin
            >
              <FadeIn>
                <h2 className={sectionHeadingClass}>¿WTF es SDOH? And What It Means to Y-O-U!</h2>
                <p className="text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-2xl mx-auto mb-8">
                  {" "}
                  {/* Increased font size */}
                  Join us for a panel discussion on{" "}
                  <strong className="text-cyan-600">Social Determinants of Health</strong> during RGV Startup Week.
                  Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.
                </p>
                {/* New Event Card Design */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-3xl mx-auto border border-cyan-100">
                  <div className="grid md:grid-cols-2">
                    {/* Left side - Date and Time */}
                    <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white p-10 flex flex-col justify-center">
                      <h3 className="text-3xl font-bold mb-8 text-white">When</h3>
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-white/20 p-3 rounded-full">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-8 w-8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          </div>
                          <div>
                            <span className="font-medium text-xl block text-white/90">Monday</span>
                            <span className="font-bold text-2xl block mt-1">April 28, 2025</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="bg-white/20 p-3 rounded-full">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-8 w-8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                          </div>
                          <div>
                            <span className="font-medium text-xl block text-white/90">Time</span>
                            <span className="font-bold text-2xl block mt-1">1:00 PM – 1:45 PM</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side - Location */}
                    <div className="p-10 flex flex-col justify-center bg-white">
                      <h3 className={subHeadingClass}>Where</h3>
                      <div className="flex items-start gap-4">
                        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                        </div>
                        <div>
                          <span className="font-bold text-2xl block text-neutral-800">eBridge Center</span>
                          <span className="text-xl text-neutral-600 block mt-2">1304 E Adams St</span>
                          <span className="text-xl text-neutral-600 block">Brownsville, TX 78520</span>
                          <a
                            href="https://maps.google.com/?q=1304+E+Adams+St,+Brownsville,+TX+78520"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
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
                            >
                              <line x1="7" y1="17" x2="17" y2="7"></line>
                              <polyline points="7 7 17 7 17 17"></polyline>
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom CTA */}
                  <div className="bg-neutral-50 p-6 flex justify-center border-t border-neutral-100">
                    <a
                      href="https://rgvsw25.events.whova.com/registration"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-500 text-neutral-900 font-bold py-3 px-8 rounded-full text-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                    >
                      Register for RGV Startup Week
                      <span className="ml-2 inline-block">→</span>
                    </a>
                  </div>
                </div>
              </FadeIn>
            </motion.div>
          </section>
          {/* Panel Speakers Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isDetailsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 sm:mt-20" // Adjusted spacing
          >
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
          </motion.div>
        </div>
      </motion.section>
    </>
  )
}
