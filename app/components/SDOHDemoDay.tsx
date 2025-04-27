"use client"
import { useState, useRef } from "react"
import { FadeIn } from "./FadeIn"
import type { Locale } from "../../i18n-config"

interface SDOHDemoDayProps {
  locale: Locale
  dict: any
}

export function SDOHDemoDay({ locale, dict }: SDOHDemoDayProps) {
  // Video state
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // Use the dictionary if provided, otherwise use default English text
  const d = dict?.sdoh?.demoDay || {
    // Default English text
    title: "Demo Day Highlights",
    description: "Watch how our accelerator cohort companies are transforming healthcare through innovation.",
    loadingText: "Loading video...",
    errorTitle: "Video Error",
    errorMessage: "There was a problem loading the video. Please try again later.",
    learnMore: "Learn More About the Accelerator",
  }

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      // Attempt to play and handle any autoplay restrictions
      const playPromise = videoRef.current.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback started successfully
          })
          .catch((error) => {
            // Auto-play was prevented
            console.error("Video playback was prevented:", error)
            setIsPlaying(false)
          })
      }
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return

    const newMutedState = !isMuted
    videoRef.current.muted = newMutedState
    setIsMuted(newMutedState)
  }

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden shadow-xl border border-cyan-500/30 transform transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-cyan-500/10">
          <div className="aspect-video relative flex items-center justify-center">
            {/* Video player with controls */}
            <div className="absolute inset-0 z-0">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
                playsInline
                preload="metadata"
                poster="https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onLoadStart={() => setIsLoading(true)}
                onCanPlay={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false)
                  setHasError(true)
                }}
                aria-label="Demo Day Highlights video"
              />
            </div>

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-white text-sm">{d.loadingText}</p>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {hasError && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                <div className="text-center p-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-red-500 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h4 className="text-xl font-bold text-white mb-2">{d.errorTitle}</h4>
                  <p className="text-white/80">{d.errorMessage}</p>
                </div>
              </div>
            )}

            {/* Play button overlay - only shown when video is not playing */}
            {!isPlaying && !isLoading && !hasError && (
              <button
                className="group absolute inset-0 flex items-center justify-center z-10 bg-black/30 transition-all duration-300 hover:bg-black/40 focus:outline-none focus:bg-black/40"
                onClick={toggleVideoPlayback}
                aria-label="Play Demo Day video"
              >
                <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-6 border-2 border-yellow-300/30 transition-all duration-300 group-hover:scale-110 group-focus:scale-110 group-hover:bg-cyan-500/30 group-focus:bg-cyan-500/30">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16 text-white group-hover:text-yellow-300 group-focus:text-yellow-300 transition-colors duration-300"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}

            {/* Video controls overlay - only shown when video is playing */}
            {isPlaying && (
              <>
                {/* Persistent pause button in the center */}
                <button
                  onClick={toggleVideoPlayback}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 rounded-full p-4 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
                  aria-label="Pause video"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                  </svg>
                </button>

                {/* Bottom controls bar - appears on hover */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10 opacity-0 hover:opacity-100 transition-opacity duration-300"
                  aria-hidden="true"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={toggleVideoPlayback}
                      className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400"
                      aria-label="Pause video"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={toggleMute}
                      className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400"
                      aria-label={isMuted ? "Unmute video" : "Mute video"}
                    >
                      {isMuted ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
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
                          className="h-6 w-6"
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
              </>
            )}

            {/* Video title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10">
              <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300 mb-2">
                {d.title}
              </h3>
              <p className="text-base md:text-lg text-white/90 max-w-md">{d.description}</p>
            </div>
          </div>
        </div>

        {/* Learn more link */}
        <div className="text-center mt-8">
          <a
            href="https://velocitytx.org/startup-programs/support/accelerator/"
            className="inline-flex items-center text-cyan-700 hover:text-cyan-800 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
            aria-label="Learn more about the Community Health Accelerator"
          >
            {d.learnMore}
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
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </FadeIn>
  )
}
