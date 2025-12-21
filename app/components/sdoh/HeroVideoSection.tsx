"use client"

import { useState } from "react"

interface HeroVideoSectionProps {
  prefersReducedMotion?: boolean
}

export function HeroVideoSection({ prefersReducedMotion = false }: HeroVideoSectionProps) {
  const [isMuted, setIsMuted] = useState(true)

  const toggleMute = () => {
    const video = document.querySelector("video")
    if (video) {
      video.muted = !video.muted
      setIsMuted(video.muted)
    }
  }

  return (
    <section 
      className="relative w-full h-[100dvh] overflow-hidden" 
      aria-label="SDOH Conference Hero Video"
    >
      <div className="absolute inset-0 bg-neutral-900">
        {/* Fallback background */}
        <div className="relative w-full h-full">
          <div className="absolute inset-0 bg-neutral-900 z-0" />

          {/* Video player */}
          <div className="absolute inset-0 z-10">
            <video
              autoPlay={!prefersReducedMotion}
              loop
              muted
              playsInline
              poster="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-poster.png"
              className="w-full h-full object-cover"
              preload="metadata"
            >
              <source
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/Start+Up+Week+Post+Promo+WEB.mp4"
                type="video/mp4"
              />
              <track kind="captions" src="/captions.vtt" label="English captions" />
              Your browser does not support the video tag.
            </video>

            {/* Simple overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/40 via-transparent to-neutral-900/20 z-20" />
          </div>

          {/* Video controls */}
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
            <button
              onClick={toggleMute}
              className="p-3 sm:p-4 bg-white text-neutral-900 hover:bg-neutral-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 sm:h-6 sm:w-6"
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
                  className="h-5 w-5 sm:h-6 sm:w-6"
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
