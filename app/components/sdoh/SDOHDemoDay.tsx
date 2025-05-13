"use client"

import { useState, useRef } from "react"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "../../types/dictionary"

interface SDOHDemoDayProps {
  locale: Locale
  dict: Partial<Dictionary>
}

export default function SDOHDemoDay({ dict }: SDOHDemoDayProps) {
  // Minimal state - just track if playing
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Use type guards to safely access dictionary values
  const sdohDict = dict?.sdoh
  const demoDayDict = sdohDict?.demoDay

  // Default text with proper type guards
  const title = demoDayDict?.title || "Demo Day Highlights"
  const description =
    demoDayDict?.description ||
    "Watch how our accelerator cohort companies are transforming healthcare through innovation."
  const learnMore = demoDayDict?.learnMore || "Learn More About the Accelerator"

  // Simple toggle function
  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      // Simple play attempt
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Video play error:", err)
          setIsPlaying(false)
        })
    }
  }

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden shadow-xl border border-cyan-500/30">
          <div className="aspect-video relative">
            {/* Simplified video element with direct src */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              src="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
              poster="https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"
              playsInline
              preload="auto"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              controls={isPlaying} // Show native controls when playing
            />

            {/* Simple play button - only shown when not playing */}
            {!isPlaying && (
              <button
                className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/30 z-10"
                onClick={togglePlay}
                aria-label="Play Demo Day video"
              >
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
              </button>
            )}

            {/* Video title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10">
              <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300 mb-2">
                {title}
              </h3>
              <p className="text-base md:text-lg text-white/90 max-w-md">{description}</p>
            </div>
          </div>
        </div>

        {/* Learn more link */}
        <div className="text-center mt-8">
          <a
            href="https://velocitytx.org/startup-programs/support/accelerator/"
            className="inline-flex items-center text-cyan-700 hover:text-cyan-800 font-medium"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Learn more about the Community Health Accelerator"
          >
            {learnMore}
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
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </FadeIn>
  )
}
