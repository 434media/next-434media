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

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden shadow-xl border border-cyan-500/30">
          {/* Video container with Instagram aspect ratio (1080x1350 = 4:5) */}
          <div className="aspect-[4/5] relative">
            {/* Simple video element with native controls */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              src="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
              poster="https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              preload="metadata"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Video title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-5">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300 mb-2">
                {title}
              </h3>
              <p className="text-sm sm:text-base md:text-lg text-white/90 max-w-md leading-relaxed">{description}</p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
