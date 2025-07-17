"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import TXMXNewsletter from "../components/txmx/TXMXNewsletter"

export default function ShopPage() {
  const [showNewsletter, setShowNewsletter] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showSoundButton, setShowSoundButton] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mobileVideoRef = useRef<HTMLVideoElement>(null)

  // Show newsletter modal after page load (only once per session)
  useEffect(() => {
    const hasShown = sessionStorage.getItem("txmx-newsletter-shown")

    if (!hasShown) {
      const timer = setTimeout(() => {
        setShowNewsletter(true)
        sessionStorage.setItem("txmx-newsletter-shown", "true")
      }, 3000) // Show after 3 seconds to let video play

      return () => clearTimeout(timer)
    }
  }, [])

  // Show sound button after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSoundButton(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const handleCloseNewsletter = useCallback(() => {
    setShowNewsletter(false)
  }, [])

  const handleJoinFight = useCallback(() => {
    setIsLoading(true)
    // Simulate brief loading for better UX feedback
    setTimeout(() => {
      setShowNewsletter(true)
      setIsLoading(false)
    }, 150)
  }, [])

  const handleShopNow = useCallback(() => {
    setIsLoading(true)
    // Brief loading state for better UX
    setTimeout(() => {
      window.location.href = "/search/txmx-boxing"
    }, 150)
  }, [])

  const toggleSound = useCallback(() => {
    const newMutedState = !isMuted
    setIsMuted(newMutedState)

    // Update both videos
    if (videoRef.current) {
      videoRef.current.muted = newMutedState
    }
    if (mobileVideoRef.current) {
      mobileVideoRef.current.muted = newMutedState
    }
  }, [isMuted])

  return (
    <>
      <main className="min-h-screen bg-black text-white overflow-hidden">
        {/* Desktop Hero Section with Video */}
        <section className="hidden md:block relative h-screen">
          {/* Background Video */}
          <div className="absolute inset-0 z-0">
            <video
              ref={videoRef}
              autoPlay
              muted={isMuted}
              loop
              playsInline
              className="w-full h-full object-cover"
              poster="/placeholder.svg?height=1080&width=1920"
            >
              <source src="https://ampd-asset.s3.us-east-2.amazonaws.com/TXMX+DROP+TEASER.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Shop Now Button Overlay - Desktop */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-10"
          >
            <button
              onClick={handleShopNow}
              disabled={isLoading}
              className="px-8 py-4 border-2 border-white bg-black/80 backdrop-blur-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Shop TXMX Boxing Collection"
            >
              <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              <span className="text-2xl md:text-3xl font-black tracking-wider relative z-10 group-hover:text-black transition-colors duration-500">
                {isLoading ? "LOADING..." : "SHOP NOW"}
              </span>
            </button>
          </motion.div>

          {/* Sound Control Button - Positioned below navbar */}
          <AnimatePresence>
            {showSoundButton && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                onClick={toggleSound}
                className="absolute top-24 right-6 z-20 p-4 bg-black/70 backdrop-blur-sm border border-white/30 text-white hover:bg-black/90 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
              >
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </motion.div>

                {/* Tooltip */}
                <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-black text-white text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none border border-white/20">
                  {isMuted ? "Unmute" : "Mute"}
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </section>

        {/* Mobile Video Section (1080x1350 aspect ratio) */}
        <section className="block md:hidden min-h-screen bg-black">
          <div className="w-full h-screen flex items-center justify-center relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative w-full max-w-sm mx-auto"
              style={{ aspectRatio: "1080/1350" }}
            >
              <video
                ref={mobileVideoRef}
                autoPlay
                muted={isMuted}
                loop
                playsInline
                className="w-full h-full object-cover"
                poster="/placeholder.svg?height=1350&width=1080"
              >
                <source src="https://ampd-asset.s3.us-east-2.amazonaws.com/TXMX+DROP+TEASER.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Mobile Sound Control Button - Positioned below mobile navbar */}
              <AnimatePresence>
                {showSoundButton && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    onClick={toggleSound}
                    className="absolute top-16 right-1 z-20 p-3 bg-black/70 backdrop-blur-sm border border-white/30 text-white hover:bg-black/90 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-label={isMuted ? "Unmute video" : "Mute video"}
                  >
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </motion.div>
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Shop Now Button Overlay - Mobile */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-10"
            >
              <button
                onClick={handleShopNow}
                disabled={isLoading}
                className="px-6 py-3 border-2 border-white bg-black/80 backdrop-blur-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Shop TXMX Boxing Collection"
              >
                <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                <span className="text-xl font-black tracking-wider relative z-10 group-hover:text-black transition-colors duration-500">
                  {isLoading ? "LOADING..." : "SHOP NOW"}
                </span>
              </button>
            </motion.div>
          </div>
        </section>

        {/* Enhanced Coming Soon Section */}
        <section
          className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-black"
          role="main"
          aria-labelledby="main-heading"
        >
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              viewport={{ once: true, margin: "-100px" }}
              className="space-y-8 sm:space-y-10 lg:space-y-12"
            >
              {/* TXMX Logo with improved accessibility and loading */}
              <div className="flex justify-center">
                <div className="relative">
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg"
                    alt="TXMX Boxing - Premium Boxing Merchandise"
                    width={400}
                    height={160}
                    className="w-72 sm:w-80 md:w-96 h-auto"
                    priority
                    sizes="(max-width: 640px) 288px, (max-width: 768px) 320px, 384px"
                  />
                </div>
              </div>

              {/* Drop Date with enhanced visual hierarchy and accessibility */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                viewport={{ once: true }}
                className="space-y-6 sm:space-y-8"
              >
                {/* Drop Date Badge with improved interaction */}
                <div className="inline-flex items-center justify-center">
                  <div className="px-6 sm:px-8 py-3 sm:py-4 border-2 border-white bg-black relative overflow-hidden group cursor-default focus-within:ring-2 focus-within:ring-white/50 focus-within:ring-offset-2 focus-within:ring-offset-black">
                    <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                    <h1
                      className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wider relative z-10 group-hover:text-black transition-colors duration-500"
                      id="main-heading"
                    >
                      DROPPING 07.19
                    </h1>
                  </div>
                </div>

                {/* Enhanced Description with better typography and spacing */}
                <div className="space-y-4 sm:space-y-6">
                  <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                    Get exclusive access to limited drops, premium gear, and insider content from the world of TXMX
                    boxing.
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Newsletter Modal */}
      <TXMXNewsletter showModal={showNewsletter} onClose={handleCloseNewsletter} />
    </>
  )
}
