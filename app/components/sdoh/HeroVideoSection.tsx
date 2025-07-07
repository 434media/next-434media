"use client"

import { useState, useEffect } from "react"

interface HeroVideoSectionProps {
  prefersReducedMotion?: boolean
}

export function HeroVideoSection({ prefersReducedMotion = false }: HeroVideoSectionProps) {
  const [isMuted, setIsMuted] = useState(true)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setHasScrolled(true)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const toggleMute = () => {
    const video = document.querySelector("video")
    if (video) {
      video.muted = !video.muted
      setIsMuted(video.muted)
    }
  }

  return (
    <section className="relative w-full h-screen overflow-hidden" aria-label="SDOH Conference Hero Video">
      <div className="absolute inset-0 bg-black">
        {/* Enhanced fallback background */}
        <div className="relative w-full h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a2a3a] via-[#2d4356] to-[#1a2a3a] z-0">
            {/* Enhanced patterns for visual interest */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(6,182,212,0.15)_0%,rgba(0,0,0,0)_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(251,191,36,0.15)_0%,rgba(0,0,0,0)_50%)]"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/40"></div>

            {/* Animated grid pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="w-full h-full bg-[linear-gradient(rgba(6,182,212,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.3)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse"></div>
            </div>
          </div>

          {/* Enhanced video player */}
          <div className="absolute inset-0 z-10">
            {/* Resource hints for faster loading */}
            <link
              rel="preload"
              href="https://ampd-asset.s3.us-east-2.amazonaws.com/Start+Up+Week+Post+Promo+WEB.mp4"
              as="video"
              type="video/mp4"
              fetchPriority="high"
              crossOrigin="anonymous"
            />
            <link
              rel="preload"
              href="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-poster.png"
              as="image"
              type="image/png"
              fetchPriority="high"
              crossOrigin="anonymous"
            />

            {/* Enhanced video element */}
            <video
              autoPlay={!prefersReducedMotion}
              loop
              muted
              playsInline
              poster="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-poster.png"
              className="w-full h-full object-cover transition-all duration-1000"
              preload="metadata"
              style={{
                filter: hasScrolled ? "brightness(0.8) contrast(1.1)" : "brightness(1) contrast(1)",
              }}
            >
              <source
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/Start+Up+Week+Post+Promo+WEB.mp4"
                type="video/mp4"
              />
              <track kind="captions" src="/captions.vtt" label="English captions" />
              Your browser does not support the video tag.
            </video>

            {/* Enhanced overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 z-20"></div>
          </div>

          {/* Enhanced video controls */}
          <div className="absolute bottom-6 right-6 z-40">
            <button
              onClick={toggleMute}
              className="group p-4 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 hover:scale-110 shadow-lg"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
