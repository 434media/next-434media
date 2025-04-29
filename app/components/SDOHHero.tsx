"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion, useAnimation, useInView } from "motion/react"
import { useMobile } from "../hooks/use-mobile"
import { FadeIn } from "./FadeIn"
import Link from "next/link"
import SDOHMission from "./SDOHMission"
import { Dialog, DialogPanel, Transition, TransitionChild, DialogTitle } from "@headlessui/react"
import { Fragment } from "react"
import dynamic from "next/dynamic"
import type { Locale } from "../../i18n-config"

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false })

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
  downloadSlidesText,
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
  downloadSlidesText?: string
  closeText?: string
  sessionIdText?: string
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
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
        comingSoonText={comingSoonText}
        comingSoonDescriptionText={comingSoonDescriptionText}
        visitWebsiteText={visitWebsiteText}
        downloadSlidesText={downloadSlidesText}
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
  comingSoonText,
  comingSoonDescriptionText,
  visitWebsiteText,
  downloadSlidesText,
  closeText,
  sessionIdText,
}: {
  isOpen: boolean
  closeModal: () => void
  title: string
  videoId: string
  videoUrl?: string
  href?: string
  comingSoonText?: string
  comingSoonDescriptionText?: string
  visitWebsiteText?: string
  downloadSlidesText?: string
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
  const [isVideoError, setIsVideoError] = useState(false)

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
  }, [isOpen, closeModal, isPlaying])

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
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const togglePlayback = () => {
    setIsPlaying(!isPlaying)
    setShowControls(true)
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
              <DialogPanel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-neutral-900 p-6 text-left align-middle shadow-xl transition-all">
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
                >
                  {videoUrl ? (
                    <>
                      {/* Loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-white text-sm">Loading video...</p>
                          </div>
                        </div>
                      )}

                      {/* Video player */}
                      {/* Video player with optimizations */}
                      {/* Video player with optimizations */}
                      <ReactPlayer
                        url={videoUrl}
                        playing={isPlaying}
                        controls={false}
                        width="100%"
                        height="100%"
                        onReady={handleReady}
                        onDuration={handleDuration}
                        onProgress={handleProgress}
                        volume={isMuted ? 0 : volume}
                        playsinline
                        config={{
                          file: {
                            attributes: {
                              preload: "auto",
                              poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-poster.png",
                            },
                            forceVideo: true,
                          },
                        }}
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
                              // This would ideally seek the video, but ReactPlayer doesn't expose this directly
                              // We'd need to use a ref to the player instance
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
                    {videoUrl && (
                      <button
                        type="button"
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
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                          <polyline points="16 6 12 2 8 6"></polyline>
                          <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                        {downloadSlidesText || "Download Slides"}
                      </button>
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

// Update the SpeakerCard component to ensure consistent alignment and height
// Replace the entire SpeakerCard component with this improved version:

const SpeakerCard = ({
  name,
  title,
  company,
  imageUrl,
  logoUrl,
  role = "Speaker", // Default role is Speaker, can be overridden for Moderator
  href,
}: {
  name: string
  title: string
  company: string
  imageUrl: string
  logoUrl: string
  role?: "Moderator" | "Speaker"
  href?: string
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

      // If href is provided, navigate to it on Enter/Space
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer")
      }
    }
  }

  return (
    <motion.div
      ref={cardRef}
      className="bg-white rounded-xl shadow-md overflow-hidden relative h-[280px] sm:h-[320px]"
      whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => {
        handleTouch()
        if (href && isActive) {
          window.open(href, "_blank", "noopener,noreferrer")
        }
      }}
      onTouchEnd={handleTouch}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`${name}, ${title} at ${company}, ${role}${href ? ". Click to visit website" : ""}`}
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

      <div className="flex flex-col items-center justify-between h-full w-full p-4 sm:p-6">
        {/* Speaker info with image - using a fixed layout structure */}
        <motion.div
          className="flex flex-col items-center justify-start text-center w-full h-full"
          animate={{ opacity: isActive ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Fixed height container for image to ensure consistent alignment */}
          <div className="w-full flex justify-center items-center h-[100px] mb-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-yellow-300/30 flex-shrink-0">
              <Image
                src={imageUrl || "/placeholder.svg?height=96&width=96&query=person"}
                alt={`Photo of ${name}`}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Fixed height container for text to ensure consistent card heights */}
          <div className="flex flex-col items-center justify-start h-[80px]">
            <h3 className="font-bold text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600 line-clamp-1 w-full">
              {name}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1 line-clamp-2 w-full">
              {title}, {company}
            </p>
          </div>

          {/* Website link at the bottom of the card */}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 border border-cyan-200 hover:border-cyan-300 rounded-lg transition-colors duration-200 w-full"
              aria-label={`Visit ${company} website`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              Visit Website
            </a>
          )}
        </motion.div>

        {/* Company logo on hover/touch */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col items-center justify-center w-full h-full">
            <motion.div
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center w-full h-[120px]"
            >
              <Image
                src={logoUrl || "/placeholder.svg?height=150&width=150&query=company logo"}
                alt={`${company} logo`}
                width={150}
                height={75}
                className="h-auto max-h-20 sm:max-h-28 w-auto object-contain"
              />
            </motion.div>
            <p className="text-sm sm:text-base font-medium text-cyan-400 border-t border-yellow-300/30 pt-2 sm:pt-3 mt-1 sm:mt-2 text-center line-clamp-1 w-full">
              {company}
            </p>

            {href && (
              <button className="mt-4 px-4 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-full text-yellow-300 text-sm transition-colors duration-300">
                Visit Website
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Create a decorative tech pattern component for the startup week vibe
const TechPattern = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`absolute pointer-events-none ${className}`} aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="tech-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M0 0 L40 0 L40 40 L0 40 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeOpacity="0.1"
            />
          </pattern>
          <pattern id="tech-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill="currentColor" fillOpacity="0.2" />
          </pattern>
          <linearGradient id="tech-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#tech-grid)" />
        <rect width="100%" height="100%" fill="url(#tech-dots)" />
        <rect width="100%" height="100%" fill="url(#tech-gradient)" />
      </svg>
    </div>
  )
}

// Create a floating tech elements component
const FloatingElements = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Floating circles */}
      <motion.div
        className="absolute w-20 h-20 rounded-full bg-yellow-300/10 border border-yellow-300/20"
        initial={{ x: "10%", y: "20%" }}
        animate={{ x: "15%", y: "15%" }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-32 h-32 rounded-full bg-cyan-500/10 border border-cyan-500/20"
        initial={{ x: "80%", y: "60%" }}
        animate={{ x: "75%", y: "65%" }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", ease: "easeInOut" }}
      />

      {/* Code brackets */}
      <motion.div
        className="absolute text-4xl font-mono text-cyan-500/20"
        initial={{ x: "85%", y: "15%", rotate: 15 }}
        animate={{ x: "85%", y: "15%", rotate: -5 }}
        transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", ease: "easeInOut" }}
      >
        {"{ }"}
      </motion.div>
      <motion.div
        className="absolute text-4xl font-mono text-yellow-500/20"
        initial={{ x: "15%", y: "75%", rotate: -15 }}
        animate={{ x: "15%", y: "75%", rotate: 5 }}
        transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse", ease: "easeInOut" }}
      />
    </div>
  )
}

// Update the SDOHHero component for better accessibility, spacing, and UX
export interface SDOHHeroProps {
  locale: Locale
  dict?: any
}

// Change from export function to export default function
export default function SDOHHero({ locale = "en", dict }: SDOHHeroProps) {
  const controls = useAnimation()
  const heroRef = useRef<HTMLElement>(null)
  const detailsRef = useRef<HTMLElement>(null)
  const isHeroInView = useInView(heroRef, { once: true })
  const isDetailsInView = useInView(detailsRef, { once: true, amount: 0.1 })
  const isMobile = useMobile()
  const [hasScrolled, setHasScrolled] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isVideoError, setIsVideoError] = useState(false)

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

  // Use the dictionary if provided, otherwise use default English text
  const d = dict?.sdoh || {
    // Default English text
    heroAlt: "SDOH Conference - Awareness Drives Innovation",
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
    },
    // Add other text that needs translation
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
        const handleError = (e: any) => {
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
                href="https://ampd-asset.s3.us-east-2.amazonaws.com/Start+Up+Week+Video+V3.mp4"
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
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/Start+Up+Week+Video+V3.mp4"
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
      <SDOHMission locale={locale} dict={dict} />

      {/* Event Details Section - Enhanced with Startup Week vibe */}
      <section className="py-16 sm:py-24 relative overflow-hidden">
        {/* Tech pattern background */}
        <TechPattern className="text-cyan-500 inset-0" />
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

        <div className="container px-4 sm:px-6 max-w-4xl mx-auto text-center relative z-10">
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
                  {dict?.sdoh?.mission?.codeComment || "// Join us for this innovative panel"}
                </p>
              </div>
              <p className="text-lg sm:text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-2xl mx-auto mb-4 font-medium">
                {dict?.sdoh?.mission?.description1 ||
                  "This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how we can address SDOH in the Rio Grande Valley."}
              </p>
              <p className="text-lg sm:text-xl md:text-2xl text-neutral-700 leading-relaxed max-w-2xl mx-auto font-medium">
                {dict?.sdoh?.mission?.description2 ||
                  "We'll explore how technology, community engagement, and cross-sector collaboration can create sustainable solutions to improve health outcomes for all residents."}
              </p>
              <div className="mt-4 text-right">
                <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-800 rounded-md text-sm font-mono">
                  {dict?.sdoh?.mission?.hashtags || "#innovation #healthcare #community"}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 max-w-6xl mx-auto">
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

            {/* Event Card Design - Enhanced with startup styling */}
            <div className="mt-16 sm:mt-24 relative">
              {/* Decorative elements */}
              <div className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-16 h-16 rounded-full bg-yellow-400/10 animate-pulse"></div>
              </div>
              <div className="absolute top-1/4 right-0 transform translate-x-1/2 -translate-y-1/2">
                <div className="w-24 h-24 rounded-full bg-cyan-500/10 animate-pulse"></div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-3xl mx-auto border-2 border-cyan-100 relative z-10">
                {/* RGV Startup Week Banner */}
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-neutral-900 py-2 px-4 text-center font-bold text-sm">
                  <span className="animate-pulse inline-block w-2 h-2 bg-white rounded-full mr-2"></span>
                  RGV STARTUP WEEK 2025 FEATURED EVENT
                  <span className="animate-pulse inline-block w-2 h-2 bg-white rounded-full ml-2"></span>
                </div>

                <div className="grid md:grid-cols-2">
                  {/* Left side - Date and Time */}
                  <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white p-8 sm:p-10 flex flex-col justify-center relative overflow-hidden">
                    {/* Tech pattern overlay */}
                    <div className="absolute inset-0 opacity-10">
                      <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-white relative">
                      <span className="inline-block w-2 h-6 bg-yellow-400 mr-2"></span>
                      When
                    </h3>
                    <div className="space-y-6 relative">
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
                  <div className="p-8 sm:p-10 flex flex-col justify-center bg-white relative">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-16 h-16">
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0L100 0L100 20L20 20L20 100L0 100L0 0Z" fill="rgba(6, 182, 212, 0.1)" />
                      </svg>
                    </div>

                    <h3 className={`${subHeadingClass} relative`}>
                      <span className="inline-block w-2 h-6 bg-yellow-400 mr-2"></span>
                      Where
                    </h3>
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
                          aria-label="View eBridge Center on Google Maps"
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

                {/* Bottom CTA - Enhanced with startup styling */}
                <div className="bg-neutral-50 p-6 flex justify-center border-t border-neutral-100 relative overflow-hidden">
                  {/* Tech pattern background */}
                  <div className="absolute inset-0 opacity-5">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      <pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
                        <circle cx="5" cy="5" r="1" fill="black" />
                      </pattern>
                      <rect width="100%" height="100%" fill="url(#dots)" />
                    </svg>
                  </div>

                  <Link
                    href="https://rgvsw25.events.whova.com/registration"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-500 text-neutral-900 font-bold py-3 px-8 rounded-full text-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 relative z-10"
                    aria-label="Register for RGV Startup Week"
                  >
                    Register for RGV Startup Week
                    <span className="ml-2 inline-block" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <FadeIn>
            {/* Replace the grid of 3 cards with this updated implementation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
              {/* Card 1 - With video implementation */}
              <SessionCard
                title={dict?.sdoh?.sessions?.card1?.title || "Market Analysis and Value Delivery"}
                description={
                  dict?.sdoh?.sessions?.card1?.description ||
                  "Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024 MHM Accelerator Cohort Champion"
                }
                image="https://ampd-asset.s3.us-east-2.amazonaws.com/card1.jpg"
                videoId="session1"
                videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Shireen+Abdullah.mp4"
                href="https://yumlish.com"
                viewSessionText={dict?.sdoh?.sessions?.viewSession || "View Session"}
                comingSoonText={dict?.sdoh?.sessions?.comingSoon || "Coming Soon"}
                comingSoonDescriptionText={
                  dict?.sdoh?.sessions?.comingSoonDescription ||
                  "This video will be available after the event. Check back later to watch the full session."
                }
                visitWebsiteText={dict?.sdoh?.sessions?.visitWebsite || "Visit Website"}
                downloadSlidesText={dict?.sdoh?.sessions?.downloadSlides || "Download Slides"}
                closeText={dict?.sdoh?.sessions?.close || "Close"}
                sessionIdText={dict?.sdoh?.sessions?.sessionId || "Session ID"}
              />

              {/* Card 2 - With video implementation */}
              <SessionCard
                title={dict?.sdoh?.sessions?.card2?.title || "Legal Considerations for Raising Capital"}
                description={
                  dict?.sdoh?.sessions?.card2?.description ||
                  "Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI"
                }
                image="https://ampd-asset.s3.us-east-2.amazonaws.com/card2.jpeg"
                videoId="session2"
                videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Jose+Padilla.mp4"
                href="https://padillalawllc.com"
                viewSessionText={dict?.sdoh?.sessions?.viewSession || "View Session"}
                comingSoonText={dict?.sdoh?.sessions?.comingSoon || "Coming Soon"}
                comingSoonDescriptionText={
                  dict?.sdoh?.sessions?.comingSoonDescription ||
                  "This video will be available after the event. Check back later to watch the full session."
                }
                visitWebsiteText={dict?.sdoh?.sessions?.visitWebsite || "Visit Website"}
                downloadSlidesText={dict?.sdoh?.sessions?.downloadSlides || "Download Slides"}
                closeText={dict?.sdoh?.sessions?.close || "Close"}
                sessionIdText={dict?.sdoh?.sessions?.sessionId || "Session ID"}
              />

              {/* Card 3 - With placeholder */}
              <SessionCard
                title={dict?.sdoh?.sessions?.card3?.title || "The Perfect Pitch"}
                description={
                  dict?.sdoh?.sessions?.card3?.description ||
                  "Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc., Capital Factory"
                }
                image="https://ampd-asset.s3.us-east-2.amazonaws.com/card3.jpeg"
                videoId="session3"
                href="https://capitalfactory.com"
                viewSessionText={dict?.sdoh?.sessions?.viewSession || "View Session"}
                comingSoonText={dict?.sdoh?.sessions?.comingSoon || "Coming Soon"}
                comingSoonDescriptionText={
                  dict?.sdoh?.sessions?.comingSoonDescription ||
                  "This video will be available after the event. Check back later to watch the full session."
                }
                visitWebsiteText={dict?.sdoh?.sessions?.visitWebsite || "Visit Website"}
                downloadSlidesText={dict?.sdoh?.sessions?.downloadSlides || "Download Slides"}
                closeText={dict?.sdoh?.sessions?.close || "Close"}
                sessionIdText={dict?.sdoh?.sessions?.sessionId || "Session ID"}
              />
            </div>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
