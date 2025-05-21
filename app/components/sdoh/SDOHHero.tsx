"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { useAnimation, useInView } from "motion/react"
import { FadeIn } from "../FadeIn"
import SDOHMission from "./SDOHMission"
import { Dialog, DialogPanel, Transition, TransitionChild, DialogTitle } from "@headlessui/react"
import { Fragment } from "react"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

// Removed dynamic import of ReactPlayer in favor of native HTML video elements
// const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false })

// Update the SessionCard component for better accessibility and UX
const SessionCard = ({
  title,
  description,
  image,
  videoId,
  videoUrl,
  href,
  viewSessionText,
  comingSoonText,
  comingSoonDescriptionText,
  visitWebsiteText,
  closeText,
  sessionIdText,
}: {
  title: string
  description: string
  image: string
  videoId: string
  videoUrl?: string
  href?: string
  viewSessionText?: string
  comingSoonText?: string
  comingSoonDescriptionText?: string
  visitWebsiteText?: string
  closeText?: string
  sessionIdText?: string
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Fix 1: Remove unused state variables but keep setters for side effects
  const [, setIsHovered] = useState(false)
  const [, setIsFocused] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const openModal = () => setIsModalOpen(true)
  const closeModal = () => setIsModalOpen(false)

  return (
    <>
      <div
        ref={cardRef}
        className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200 flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:border-cyan-200 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <div
          className="aspect-video relative overflow-hidden cursor-pointer"
          onClick={openModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openModal()
            }
          }}
          aria-label={`Open ${title} session video`}
        >
          {/* Subtle gradient overlay - reduced opacity for better image visibility */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/30 to-neutral-800/30 z-10 transition-opacity duration-300 group-hover:opacity-50"></div>

          <Image
            src={image || "/placeholder.svg?height=720&width=1280&query=conference presentation"}
            alt={title}
            width={640}
            height={360}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        </div>

        <div className="p-6 flex-grow">
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600 mb-3">
            {title}
          </h3>
          <p className="text-neutral-700 mb-4 text-base leading-relaxed">{description}</p>
        </div>

        <div className="px-6 pb-6 mt-auto">
          <button
            onClick={openModal}
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            aria-label={`View ${title} session`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
            {viewSessionText || "View Session"}
          </button>
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={isModalOpen}
        closeModal={closeModal}
        title={title}
        videoId={videoId}
        videoUrl={videoUrl}
        href={href}
        image={image}
        comingSoonText={comingSoonText}
        comingSoonDescriptionText={comingSoonDescriptionText}
        visitWebsiteText={visitWebsiteText}
        closeText={closeText}
        sessionIdText={sessionIdText}
      />
    </>
  )
}

// Add the VideoModal component
const VideoModal = ({
  isOpen,
  closeModal,
  title,
  videoId,
  videoUrl,
  href,
  image,
  comingSoonText,
  comingSoonDescriptionText,
  visitWebsiteText,
  closeText,
  sessionIdText,
}: {
  isOpen: boolean
  closeModal: () => void
  title: string
  videoId: string
  videoUrl?: string
  href?: string
  image: string
  comingSoonText?: string
  comingSoonDescriptionText?: string
  visitWebsiteText?: string
  closeText?: string
  sessionIdText?: string
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [duration, setDuration] = useState(0)
  // Fix 2: Remove unused state variables
  // const [_isVideoError, _setIsVideoError] = useState(false)

  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying)
    setShowControls(true)

    // Find the video element and play/pause
    const videoElement = videoRef.current?.querySelector("video")
    if (videoElement) {
      if (isPlaying) {
        videoElement.pause()
      } else {
        videoElement.play().catch((e) => console.log("Playback prevented:", e))
      }
    }
  }, [isPlaying])

  // Handle keyboard events
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal()
    }

    const handleSpaceBar = (e: KeyboardEvent) => {
      if (
        e.key === " " &&
        document.activeElement?.tagName !== "BUTTON" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault()
        togglePlayback()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("keydown", handleSpaceBar)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("keydown", handleSpaceBar)
    }
  }, [isOpen, closeModal, isPlaying, togglePlayback])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setProgress(0)
      setShowControls(true)
    }
  }, [isOpen])

  // Auto-hide controls after inactivity
  useEffect(() => {
    if (isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }

      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying, showControls])

  const handleReady = () => {
    setIsLoading(false)
  }

  const handleDuration = (duration: number) => {
    setDuration(duration)
  }

  const handleProgress = (state: { played: number }) => {
    setProgress(state.played)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)

    // Update video volume directly
    const videoElement = videoRef.current?.querySelector("video")
    if (videoElement) {
      videoElement.volume = newVolume
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)

    // Update video mute state directly
    const videoElement = videoRef.current?.querySelector("video")
    if (videoElement) {
      videoElement.muted = !isMuted
    }
  }

  const handleVideoContainerMouseMove = () => {
    setShowControls(true)

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000)
    const hh = date.getUTCHours()
    const mm = date.getUTCMinutes()
    const ss = date.getUTCSeconds().toString().padStart(2, "0")
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`
    }
    return `${mm}:${ss}`
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/75" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-neutral-900 p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" className="text-xl font-bold text-white mb-4 pr-8">
                  {title}
                </DialogTitle>

                <button
                  type="button"
                  className="absolute top-4 right-4 rounded-full bg-neutral-800 p-2 text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div
                  ref={videoRef}
                  className="aspect-video bg-black rounded-lg overflow-hidden relative"
                  onMouseMove={handleVideoContainerMouseMove}
                  onTouchStart={handleVideoContainerMouseMove}
                  onClick={() => {
                    if (!isLoading) togglePlayback()
                  }}
                >
                  {videoUrl ? (
                    <>
                      {/* Loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="flex flex-col items-center">
                            <div className="relative w-16 h-16">
                              <div className="absolute inset-0 w-16 h-16 border-4 border-cyan-500/20 rounded-full"></div>
                              <div className="absolute inset-0 w-16 h-16 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-8 w-8 text-cyan-500"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-white text-sm mt-4 font-medium">Preparing your video...</p>
                          </div>
                        </div>
                      )}

                      {/* Native HTML5 video player with optimizations */}
                      <video
                        ref={(el) => {
                          if (el) {
                            el.addEventListener("loadedmetadata", () => {
                              handleReady()
                              handleDuration(el.duration)
                            })
                            el.addEventListener("timeupdate", () => {
                              handleProgress({ played: el.currentTime / (el.duration || 1) })
                            })
                            el.volume = isMuted ? 0 : volume
                            if (isPlaying) {
                              el.play().catch((e) => console.log("Autoplay prevented:", e))
                            } else {
                              el.pause()
                            }
                          }
                        }}
                        src={videoUrl}
                        poster={image}
                        preload="auto"
                        playsInline
                        className="w-full h-full object-cover"
                        onError={(e) => console.error("Video error:", e)}
                      />

                      {/* Large play button overlay - only shown when video is not playing */}
                      {!isPlaying && !isLoading && (
                        <button
                          onClick={togglePlayback}
                          className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/30 z-20 group focus:outline-none"
                          aria-label="Play video"
                        >
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 transition-all duration-300 group-hover:scale-110 group-hover:bg-black/70 group-focus:scale-110 group-focus:bg-black/70 group-focus:border-cyan-400">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-10 w-10 sm:h-12 sm:w-12 text-white group-hover:text-cyan-400 group-focus:text-cyan-400 transition-colors duration-300"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </button>
                      )}

                      {/* Pause button overlay - only shown when video is playing */}
                      {isPlaying && (
                        <button
                          onClick={togglePlayback}
                          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-black/40 flex items-center justify-center z-20 transition-opacity duration-300 ${
                            showControls ? "opacity-100" : "opacity-0"
                          } hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2`}
                          aria-label="Pause video"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10 text-white"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path fillRule="evenodd" d="M10 18V6h-4v12h4zm8 0V6h-4v12h4z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}

                      {/* Custom controls overlay */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
                          showControls ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        {/* Progress bar */}
                        <div
                          className="w-full h-2 bg-neutral-700 rounded-full mb-3 cursor-pointer"
                          onClick={(e) => {
                            if (videoRef.current) {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const pos = (e.clientX - rect.left) / rect.width
                              const videoElement = videoRef.current.querySelector("video")
                              if (videoElement) {
                                videoElement.currentTime = pos * duration
                              }
                            }
                          }}
                        >
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${progress * 100}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between">
                          {/* Play/Pause button */}
                          <button
                            onClick={togglePlayback}
                            className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400"
                            aria-label={isPlaying ? "Pause" : "Play"}
                          >
                            {isPlaying ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M10 18V6h-4v12h4zm8 0V6h-4v12h4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>

                          {/* Time display */}
                          <div className="text-white text-sm mx-4 hidden sm:block">
                            {formatTime(progress * duration)}
                          </div>

                          {/* Volume controls */}
                          <div className="flex items-center ml-4">
                            <button
                              onClick={toggleMute}
                              className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 mr-2"
                              aria-label={isMuted ? "Unmute" : "Mute"}
                            >
                              {isMuted ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                    clipRule="evenodd"
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
                                  className="h-5 w-5"
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
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={volume}
                              onChange={handleVolumeChange}
                              className="w-20 accent-cyan-500"
                              aria-label="Volume"
                            />
                          </div>

                          {/* Fullscreen button */}
                          <button
                            onClick={() => {
                              if (videoRef.current) {
                                if (document.fullscreenElement) {
                                  document.exitFullscreen()
                                } else {
                                  videoRef.current.requestFullscreen()
                                }
                              }
                            }}
                            className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 ml-4"
                            aria-label="Toggle fullscreen"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Placeholder for videos that aren't available yet (Card 3)
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                      <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-6 border-2 border-yellow-300/30 mb-6">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-16 w-16 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <h4 className="text-2xl font-bold text-cyan-400 mb-2">{comingSoonText || "Coming Soon"}</h4>
                      <p className="text-white/80 max-w-md">
                        {comingSoonDescriptionText ||
                          "This video will be available after the event. Check back later to watch the full session."}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
                  <div className="text-sm text-white/60">
                    {sessionIdText || "Session ID"}: {videoId}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        {visitWebsiteText || "Visit Website"}
                      </a>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      onClick={closeModal}
                    >
                      {closeText || "Close"}
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

// Dynamic Event Carousel with 3D effects and interactive elements
const EventCarousel = () => {
  const [activeSlide, setActiveSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  // Fix 4: Remove unused variable
  // const _isMobile = useMobile()

  // Event images and content
  const slides = [
    {
      id: "slide1",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-28.jpg",
      title: "RGV Startup Week 2025",
      subtitle: "¿Que es SDOH?",
      description: "A successful gathering at the intersection of healthcare and technology.",
      highlight: "Featured Event",
    },
    {
      id: "slide2",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-27.jpg",
      title: "Community Engagement",
      subtitle: "Empowering Local Communities",
      description:
        "The event emphasized the importance of community involvement in addressing social determinants of health.",
      highlight: "Community-driven initiatives",
    },
    {
      id: "slide3",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-15.jpg",
      title: "Innovation Showcase",
      subtitle: "Cutting-edge Healthcare Solutions",
      description: "The event featured innovative approaches to addressing social determinants of health.",
      highlight: "Technology-driven solutions",
    },
    {
      id: "slide4",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-47.jpg",
      title: "Networking Opportunities",
      subtitle: "Connections Made",
      description:
        "Attendees built valuable relationships with entrepreneurs, investors, and healthcare professionals.",
      highlight: "Cross-sector collaboration",
    },
    {
      id: "slide5",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-50.jpg",
      title: "Future of Healthcare",
      subtitle: "A Vision for Tomorrow",
      description:
        "The event inspired attendees to envision a future where healthcare is accessible and equitable for all.",
      highlight: "Visionary insights",
    },
    {
      id: "slide6",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-51.jpg",
      title: "RGV Startup Week 2025",
      subtitle: "¿Que es SDOH?",
      description: "A successful gathering at the intersection of healthcare and technology.",
      highlight: "Featured Event",
    },
  ]

  // Handle slide navigation - simplified to fix navigation issues
  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
      }

      autoPlayRef.current = setInterval(() => {
        nextSlide()
      }, 5000)
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
      }
    }
  }, [isAutoPlaying, nextSlide])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        prevSlide()
      } else if (e.key === "ArrowRight") {
        nextSlide()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [nextSlide, prevSlide])

  // Touch navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) {
      // Swipe left
      nextSlide()
    }

    if (touchStart - touchEnd < -50) {
      // Swipe right
      prevSlide()
    }
  }

  // Pause auto-play on hover
  const handleMouseEnter = () => {
    setIsAutoPlaying(false)
  }

  const handleMouseLeave = () => {
    setIsAutoPlaying(true)
  }

  // Direct navigation to a specific slide
  const goToSlide = (index: number) => {
    setActiveSlide(index)
  }

  return (
    <div
      className="relative max-w-5xl mx-auto overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-neutral-900 to-neutral-800"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={carouselRef}
      aria-roledescription="carousel"
      aria-label="Event highlights carousel"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-yellow-400 z-10"></div>
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"></div>

      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 h-1 bg-yellow-400 z-20 transition-all duration-5000 ease-linear"
        style={{ width: `${(activeSlide / (slides.length - 1)) * 100}%` }}
      ></div>

      {/* Slides container */}
      <div className="relative h-[400px] sm:h-[500px]">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
              index === activeSlide
                ? "opacity-100 translate-x-0 scale-100 z-10"
                : index < activeSlide
                  ? "opacity-0 -translate-x-full scale-95 z-0"
                  : "opacity-0 translate-x-full scale-95 z-0"
            }`}
            aria-hidden={index !== activeSlide}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${slides.length}: ${slide.title}`}
          >
            {/* Background image with parallax effect */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0 scale-110 transition-transform duration-[15000ms] ease-linear"
                style={{
                  backgroundImage: `url(${slide.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transform: index === activeSlide ? "scale(1.05)" : "scale(1)",
                }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/70 to-neutral-900/30"></div>
            </div>

            {/* Content - Only show on first slide */}
            {index === 0 && (
              <div className="relative h-full flex flex-col justify-end p-8 sm:p-12">
                <div
                  className={`transition-all duration-700 delay-100 transform ${
                    index === activeSlide ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                  }`}
                >
                  {/* RGV Startup Week badge */}
                  <div className="inline-block bg-yellow-400 text-neutral-900 px-3 py-1 rounded-full text-xs font-bold tracking-wider mb-4 animate-pulse">
                    RGV STARTUP WEEK 2025
                  </div>

                  <h3 className="text-3xl sm:text-4xl font-bold text-white mb-2">{slide.title}</h3>
                  <p className="text-xl sm:text-2xl text-cyan-400 font-medium mb-4">{slide.subtitle}</p>
                  <p className="text-white/80 text-lg max-w-2xl mb-6">{slide.description}</p>

                  {/* Event highlights */}
                  {slide.highlight && (
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center mr-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-cyan-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <span className="text-white">{slide.highlight}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between items-center px-6 z-30">
        {/* Slide counter */}
        <div className="text-white/70 text-sm font-mono">
          {activeSlide + 1} / {slides.length}
        </div>

        {/* Pagination dots */}
        <div className="flex items-center justify-center space-x-2">
          {slides.map((_, index) => (
            <button
              key={`dot-${index}`}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full ${
                index === activeSlide ? "w-8 h-2 bg-yellow-400" : "w-2 h-2 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeSlide ? "true" : "false"}
            />
          ))}
        </div>

        {/* Auto-play toggle */}
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="text-white/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full p-2"
          aria-label={isAutoPlaying ? "Pause auto-play" : "Start auto-play"}
        >
          {isAutoPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Previous/Next buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center z-20 hover:bg-black/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Previous slide"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Floating particles for visual interest */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-float-slow"></div>
        <div className="absolute top-3/4 left-1/3 w-3 h-3 bg-yellow-400 rounded-full animate-float-medium"></div>
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-float-fast"></div>
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-yellow-400 rounded-full animate-float-slow"></div>
      </div>

      {/* Add these animations to your globals.css or use inline styles */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-15px) translateX(-10px); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-10px) translateX(5px); }
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 6s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// SpeakerCard Component
const SpeakerCard = ({
  name,
  title,
  company,
  imageUrl,
  logoUrl,
  role,
  href,
}: {
  name: string
  title: string
  company: string
  imageUrl: string
  logoUrl?: string
  role?: string
  href?: string
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl shadow-lg overflow-hidden border border-neutral-200 transition-all duration-300 hover:shadow-xl hover:border-cyan-200"
    >
      <div className="relative">
        <Image
          src={imageUrl || "/placeholder.svg"}
          alt={`${name} - ${title}, ${company}`}
          width={512}
          height={512}
          className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {logoUrl && (
          <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md">
            <Image
              src={logoUrl || "/placeholder.svg"}
              alt={`${company} Logo`}
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
          </div>
        )}
      </div>
      <div className="p-4">
        <h4 className="text-lg font-bold text-neutral-800 group-hover:text-cyan-600 transition-colors duration-300">
          {name}
        </h4>
        <p className="text-sm text-neutral-600">
          {title}, {company}
        </p>
        {role && <p className="text-xs font-medium text-cyan-500 mt-1">{role}</p>}
      </div>
    </a>
  )
}

const TechPattern = ({ className }: { className: string }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-5"
    >
      <path d="M0 0H200V200H0V0Z" fill="url(#techPattern)" />
      <defs>
        <pattern id="techPattern" patternContentUnits="userSpaceOnUse" width="20" height="20" viewBox="0 0 20 20">
          <rect width="2" height="2" fill="currentColor" />
          <rect x="8" width="2" height="2" fill="currentColor" />
          <rect x="4" y="4" width="2" height="2" fill="currentColor" />
          <rect x="12" y="4" width="2" height="2" fill="currentColor" />
          <rect x="16" y="4" width="2" height="2" fill="currentColor" />
          <rect y="8" width="2" height="2" fill="currentColor" />
          <rect x="8" y="8" width="2" height="2" fill="currentColor" />
          <rect x="18" y="8" width="2" height="2" fill="currentColor" />
          <rect x="4" y="12" width="2" height="2" fill="currentColor" />
          <rect x="12" y="12" width="2" height="2" fill="currentColor" />
          <rect x="16" y="12" width="2" height="2" fill="currentColor" />
          <rect y="16" width="2" height="2" fill="currentColor" />
          <rect x="8" y="16" width="2" height="2" fill="currentColor" />
        </pattern>
      </defs>
    </svg>
  </div>
)

const FloatingElements = () => (
  <>
    <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-cyan-400 rounded-full animate-float-slow opacity-20"></div>
    <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-yellow-400 rounded-full animate-float-medium opacity-20"></div>
    <div className="absolute top-1/2 right-1/4 w-4 h-4 bg-cyan-400 rounded-full animate-float-fast opacity-20"></div>
    <div className="absolute bottom-1/4 right-1/3 w-5 h-5 bg-yellow-400 rounded-full animate-float-slow opacity-20"></div>
  </>
)

// Update the SDOHHero component for better accessibility, spacing, and UX
export interface SDOHHeroProps {
  locale: Locale
  dict?: Dictionary
}

// Change from export function to export default function
export default function SDOHHero({ locale = "en", dict }: SDOHHeroProps) {
  const controls = useAnimation()
  const heroRef = useRef<HTMLElement>(null)
  // Fix the unused 'detailsRef' variable (around line 1133):
  const _detailsRef = useRef<HTMLElement>(null)
  // Fix 5: Remove unused variables
  // const _isDetailsInView = useInView(detailsRef, { once: true, amount: 0.1 })
  // const _hasScrolled = useState(false)[0]
  // const [_isVideoError, _setIsVideoError] = useState(false)
  const [, setHasScrolled] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const isHeroInView = useInView(heroRef, { once: true })

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

  // Placeholder company logos - replace with actual logos
  const companyLogos = {
    "434 MEDIA": "https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png",
    "Emerge and Rise": "https://ampd-asset.s3.us-east-2.amazonaws.com/WY%2Blogo.png",
    "The SAVE Clinic": "https://ampd-asset.s3.us-east-2.amazonaws.com/save-nobg.png",
    "Tabiat Research": "https://ampd-asset.s3.us-east-2.amazonaws.com/tabiat.svg",
  }

  // Create a default dictionary for fallbacks
  const defaultDict = {
    sdoh: {
      mission: {
        codeComment: "// Join us for this innovative panel",
        description1:
          "This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how we can address SDOH in the Rio Grande Valley.",
        description2:
          "We'll explore how technology, community engagement, and cross-sector collaboration can create sustainable solutions to improve health outcomes for all residents.",
        hashtags: "#innovation #healthcare #community",
      },
      sessions: {
        viewSession: "View Session",
        comingSoon: "Coming Soon",
        comingSoonDescription:
          "This video will be available after the event. Check back later to watch the full session.",
        visitWebsite: "Visit Website",
        downloadSlides: "Download Slides",
        close: "Close",
        sessionId: "Session ID",
        card1: {
          title: "Market Analysis and Value Delivery",
          description:
            "Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024 MHM Accelerator Cohort Champion",
        },
        card2: {
          title: "Legal Considerations for Raising Capital",
          description:
            "Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI",
        },
        card3: {
          title: "The Perfect Pitch",
          description:
            "Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc., Capital Factory",
        },
      },
    },
  }

  // Merge the provided dictionary with defaults
  const mergedDict = {
    ...defaultDict,
    sdoh: {
      ...defaultDict.sdoh,
      ...(dict?.sdoh || {}),
    },
  }

  // Optimize video loading
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Get the video element
      const videoElement = document.querySelector("video")

      if (videoElement) {
        // Add loading event listeners
        const handleLoadStart = () => console.log("Video loading started")
        const handleLoadedData = () => console.log("Video data loaded")
        const handleCanPlay = () => {
          console.log("Video can play")
          // Force play when ready if autoplay fails
          videoElement.play().catch((e) => console.log("Autoplay prevented:", e))
        }

        videoElement.addEventListener("loadstart", handleLoadStart)
        videoElement.addEventListener("loadeddata", handleLoadedData)
        videoElement.addEventListener("canplay", handleCanPlay)

        // Use Intersection Observer to load video only when in viewport
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                // When video is in viewport, set source and load
                if (videoElement.preload === "none") {
                  videoElement.preload = "auto"
                }
                observer.unobserve(videoElement)
              }
            })
          },
          { threshold: 0.1 },
        )

        observer.observe(videoElement)

        return () => {
          videoElement.removeEventListener("loadstart", handleLoadStart)
          videoElement.removeEventListener("loadeddata", handleLoadedData)
          videoElement.removeEventListener("canplay", handleCanPlay)
          observer.disconnect()
        }
      }
    }
  }, [])

  // Optimize video loading with Intersection Observer
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Get the video element
      const videoElement = document.querySelector("video")

      if (videoElement) {
        // Add loading event listeners
        const handleLoadStart = () => console.log("Video loading started")
        const handleLoadedData = () => console.log("Video data loaded")
        const handleCanPlay = () => {
          console.log("Video can play")
          // Force play when ready if autoplay fails
          if (!prefersReducedMotion) {
            videoElement.play().catch((e) => console.log("Autoplay prevented:", e))
          }
        }
        // Fix 7: Use proper type for error event
        const handleError = (e: Event) => {
          console.error("Video error:", e)
          // Could add fallback behavior here
        }

        videoElement.addEventListener("loadstart", handleLoadStart)
        videoElement.addEventListener("loadeddata", handleLoadedData)
        videoElement.addEventListener("canplay", handleCanPlay)
        videoElement.addEventListener("error", handleError)

        // Use Intersection Observer to load video only when in viewport
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                // When video is in viewport, set source and load
                if (videoElement.preload === "none") {
                  videoElement.preload = "auto"
                }
                observer.unobserve(videoElement)
              }
            })
          },
          { threshold: 0.1 },
        )

        observer.observe(videoElement)

        return () => {
          videoElement.removeEventListener("loadstart", handleLoadStart)
          videoElement.removeEventListener("loadeddata", handleLoadedData)
          videoElement.removeEventListener("canplay", handleCanPlay)
          videoElement.removeEventListener("error", handleError)
          observer.disconnect()
        }
      }
    }
  }, [prefersReducedMotion])

  return (
    <>
      {/* Hero section with video - simplified without text overlay */}
      <section
        className="relative w-full h-screen overflow-hidden"
        ref={heroRef}
        aria-label="SDOH Conference Hero Video"
      >
        {/* We don't need to add the language toggle here as it's already handled in the parent component */}

        <div className="absolute inset-0 bg-black">
          {/* Video background with poster image for faster perceived loading */}
          <div className="relative w-full h-full">
            {/* Fallback poster image while video loads */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a2a3a] via-[#2d4356] to-[#1a2a3a] z-0">
              {/* Subtle patterns for visual interest while video loads */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,95,43,0.15)_0%,rgba(0,0,0,0)_70%)]"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30"></div>
            </div>

            {/* Video player with optimizations */}
            <div className="absolute inset-0 z-10">
              {/* Resource hints for faster video loading */}
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

              {/* Optimized video element with priority attributes */}
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
            </div>

            {/* Video controls - mute/unmute button */}
            <div className="absolute bottom-6 right-6 z-40">
              <button
                onClick={(e) => {
                  e.stopPropagation() // Prevent event bubbling
                  const video = document.querySelector("video")
                  if (video) {
                    video.muted = !video.muted
                    // Force a re-render by updating state
                    setHasScrolled((prev) => !prev)
                    setTimeout(() => setHasScrolled((prev) => !prev), 10)
                  }
                }}
                className="p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                aria-label="Toggle video sound"
              >
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
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Remove the line below if it exists */}

      {/* Mission Statement Section */}
      <SDOHMission locale={locale} dict={mergedDict} />

      {/* Event Details Section - Enhanced with Startup Week vibe */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        {/* Tech pattern background */}
        <FloatingElements />

        {/* RGV Startup Week Badge */}
        <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 md:translate-x-1/3">
          <div className="relative w-40 h-40 md:w-48 md:h-48">
            <div className="absolute inset-0 bg-yellow-400 rounded-full animate-pulse opacity-20"></div>
            <div className="absolute inset-2 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
              <div className="text-center p-2">
                <p className="text-xs font-bold text-yellow-900 uppercase tracking-wider">Part of</p>
                <p className="text-sm md:text-base font-black text-neutral-900 leading-tight">RGV STARTUP WEEK</p>
                <p className="text-xs font-medium text-yellow-900">2025</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container px-4 sm:px-6 max-w-5xl mx-auto text-center relative z-10">
          <FadeIn>
            {/* Enhanced section header with startup week styling */}
            <div className="inline-block relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-yellow-500/20 blur-xl rounded-full"></div>
              <h2 className={`${sectionHeadingClass} relative`}>
                <span className="inline-block px-2 py-1">¿Que es SDOH?</span>{" "}
                <span className="text-neutral-800">And What It Means to Y-O-U!</span>
              </h2>
            </div>

            {/* Startup-style description with code-like elements */}
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-cyan-200 shadow-lg mb-12">
              <div className="flex items-start mb-4">
                <div className="flex space-x-2 mr-3">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <p className="text-neutral-500 text-sm font-mono">
                  {mergedDict.sdoh?.mission?.codeComment || "// Join us for this innovative panel"}
                </p>
              </div>
              <p className="text-lg sm:text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-2xl mx-auto mb-4 font-medium">
                {mergedDict.sdoh?.mission?.description1 ||
                  "This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how we can address SDOH in the Rio Grande Valley."}
              </p>
              <p className="text-lg sm:text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-2xl mx-auto font-medium">
                {mergedDict.sdoh?.mission?.description2 ||
                  "We'll explore how technology, community engagement, and cross-sector collaboration can create sustainable solutions to improve health outcomes for all residents."}
              </p>
              <div className="mt-4 text-right">
                <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-800 rounded-md text-sm font-mono">
                  {mergedDict.sdoh?.mission?.hashtags || "#innovation #healthcare #community"}
                </span>
              </div>
            </div>
          </FadeIn>
        </div>

        <div className="container px-4 sm:px-6 max-w-5xl mx-auto relative z-10">
          <FadeIn>
            {/* Panel Speakers Section - Enhanced with startup styling */}
            <div className="mt-16 sm:mt-24 relative">
              {/* Decorative elements */}
              <div className="absolute -top-10 -left-10 w-20 h-20 border-t-2 border-l-2 border-yellow-400/30"></div>
              <div className="absolute -bottom-10 -right-10 w-20 h-20 border-b-2 border-r-2 border-cyan-400/30"></div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-cyan-100">
                <div className="flex items-center justify-between mb-8">
                  <h2 className={`${subHeadingClass} mb-0 flex items-center`}>
                    <span className="inline-block w-3 h-8 bg-yellow-400 mr-3 rounded-sm"></span>
                    Panel Speakers
                  </h2>
                  <div className="px-4 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm font-medium">
                    Featured Session
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 max-w-5xl mx-auto">
                  {/* Moderator */}
                  <SpeakerCard
                    name="Marcos Resendez"
                    title="Founder"
                    company="434 MEDIA"
                    imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/49d10ec854acc0af8a20810dd891eafb.jpeg"
                    logoUrl={companyLogos["434 MEDIA"]}
                    role="Moderator"
                    href="https://434media.com"
                  />

                  {/* Speaker 1 */}
                  <SpeakerCard
                    name="Dr. Lyssa Ochoa"
                    title="Founder"
                    company="SAVE Clinic"
                    imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Lyssa_Ochoa_LinkedIn_Headshot.jpeg"
                    logoUrl={companyLogos["The SAVE Clinic"]}
                    href="https://thesaveclinic.com"
                  />

                  {/* Speaker 2 */}
                  <SpeakerCard
                    name="Daniyal Liaqat"
                    title="Founder, 2024 MHM Accelerator Cohort"
                    company="Tabiat"
                    imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/daniyal-liaqat.jpeg"
                    logoUrl={companyLogos["Tabiat Research"]}
                    href="https://tabiat.care"
                  />

                  {/* Speaker 3 */}
                  <SpeakerCard
                    name="Lina Rugova"
                    title="Founder"
                    company="Emerge & Rise"
                    imageUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/lina-rugova.jpeg"
                    logoUrl={companyLogos["Emerge and Rise"]}
                    href="https://emergeandrise.org"
                  />
                </div>
              </div>
            </div>

            {/* Event Highlights Image Carousel - Replacing the static event card */}
            <div className="mt-16 sm:mt-24 relative">
              {/* Decorative elements */}
              <div className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 z-0">
                <div className="w-16 h-16 rounded-full bg-yellow-400/10 animate-pulse"></div>
              </div>
              <div className="absolute top-1/4 right-0 transform translate-x-1/2 -translate-y-1/2 z-0">
                <div className="w-24 h-24 rounded-full bg-cyan-500/10 animate-pulse"></div>
              </div>

              {/* Event Carousel Component */}
              <EventCarousel />
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <FadeIn>
            {/* Replace the grid of 3 cards with this updated implementation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Card 1 - With video implementation */}
              <SessionCard
                title={mergedDict.sdoh?.sessions?.card1?.title || "Market Analysis and Value Delivery"}
                description={
                  mergedDict.sdoh?.sessions?.card1?.description ||
                  "Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024 MHM Accelerator Cohort Champion"
                }
                image="https://ampd-asset.s3.us-east-2.amazonaws.com/card1.jpg"
                videoId="session1"
                videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Shireen+Abdullah.mp4"
                href="https://yumlish.com"
                viewSessionText={mergedDict.sdoh?.sessions?.viewSession || "View Session"}
                comingSoonText={mergedDict.sdoh?.sessions?.comingSoon || "Coming Soon"}
                comingSoonDescriptionText={
                  mergedDict.sdoh?.sessions?.comingSoonDescription ||
                  "This video will be available after the event. Check back later to watch the full session."
                }
                visitWebsiteText={mergedDict.sdoh?.sessions?.visitWebsite || "Visit Website"}
                closeText={mergedDict.sdoh?.sessions?.close || "Close"}
                sessionIdText={mergedDict.sdoh?.sessions?.sessionId || "Session ID"}
              />

              {/* Card 2 - With video implementation */}
              <SessionCard
                title={mergedDict.sdoh?.sessions?.card2?.title || "Legal Considerations for Raising Capital"}
                description={
                  mergedDict.sdoh?.sessions?.card2?.description ||
                  "Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI"
                }
                image="https://ampd-asset.s3.us-east-2.amazonaws.com/card2.jpeg"
                videoId="session2"
                videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Jose+Padilla.mp4"
                href="https://padillalawllc.com"
                viewSessionText={mergedDict.sdoh?.sessions?.viewSession || "View Session"}
                comingSoonText={mergedDict.sdoh?.sessions?.comingSoon || "Coming Soon"}
                comingSoonDescriptionText={
                  mergedDict.sdoh?.sessions?.comingSoonDescription ||
                  "This video will be available after the event. Check back later to watch the full session."
                }
                visitWebsiteText={mergedDict.sdoh?.sessions?.visitWebsite || "Visit Website"}
                closeText={mergedDict.sdoh?.sessions?.close || "Close"}
                sessionIdText={mergedDict.sdoh?.sessions?.sessionId || "Session ID"}
              />

              {/* Card 3 - With placeholder */}
              <SessionCard
                title={mergedDict.sdoh?.sessions?.card3?.title || "The Perfect Pitch"}
                description={
                  mergedDict.sdoh?.sessions?.card3?.description ||
                  "Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc., Capital Factory"
                }
                image="https://ampd-asset.s3.us-east-2.amazonaws.com/card3.jpeg"
                videoId="session3"
                href="https://capitalfactory.com"
                viewSessionText={mergedDict.sdoh?.sessions?.viewSession || "View Session"}
                comingSoonText={mergedDict.sdoh?.sessions?.comingSoon || "Coming Soon"}
                comingSoonDescriptionText={
                  mergedDict.sdoh?.sessions?.comingSoonDescription ||
                  "This video will be available after the event. Check back later to watch the full session."
                }
                visitWebsiteText={mergedDict.sdoh?.sessions?.visitWebsite || "Visit Website"}
                closeText={mergedDict.sdoh?.sessions?.close || "Close"}
                sessionIdText={mergedDict.sdoh?.sessions?.sessionId || "Session ID"}
              />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
