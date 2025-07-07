"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect, Fragment } from "react"
import { Dialog, DialogPanel, Transition, TransitionChild, DialogTitle } from "@headlessui/react"

interface VideoModalProps {
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
}

export function VideoModal({
  isOpen,
  closeModal,
  title,
  videoId,
  videoUrl,
  href,
  image,
  comingSoonText = "Coming Soon",
  comingSoonDescriptionText = "This video will be available after the event. Check back later to watch the full session.",
  visitWebsiteText = "Visit Website",
  closeText = "Close",
  sessionIdText = "Session ID",
}: VideoModalProps) {
  const videoRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [duration, setDuration] = useState(0)

  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying)
    setShowControls(true)

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
  }, [isOpen, closeModal, togglePlayback])

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

  const handleReady = () => setIsLoading(false)
  const handleDuration = (duration: number) => setDuration(duration)
  const handleProgress = (state: { played: number }) => setProgress(state.played)

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)

    const videoElement = videoRef.current?.querySelector("video")
    if (videoElement) {
      videoElement.volume = newVolume
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
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
              <DialogPanel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-neutral-900 p-6 text-left align-middle shadow-2xl transition-all border border-cyan-500/20">
                <DialogTitle as="h3" className="text-xl font-bold text-white mb-4 pr-8">
                  {title}
                </DialogTitle>

                <button
                  type="button"
                  className="absolute top-4 right-4 rounded-full bg-neutral-800 p-2 text-white hover:bg-neutral-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 hover:scale-110"
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
                      {/* Enhanced loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-900/50 to-neutral-900/50 z-10">
                          <div className="flex flex-col items-center">
                            <div className="relative w-20 h-20">
                              <div className="absolute inset-0 w-20 h-20 border-4 border-cyan-500/30 rounded-full"></div>
                              <div className="absolute inset-0 w-20 h-20 border-4 border-t-cyan-400 border-r-yellow-400 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-10 w-10 text-cyan-400 animate-pulse"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-white text-sm mt-4 font-medium animate-pulse">Preparing your video...</p>
                          </div>
                        </div>
                      )}

                      {/* Enhanced video player */}
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

                      {/* Enhanced play/pause buttons with better animations */}
                      {!isPlaying && !isLoading && (
                        <button
                          onClick={togglePlayback}
                          className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/30 z-20 group focus:outline-none"
                          aria-label="Play video"
                        >
                          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/80 to-yellow-500/80 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 transition-all duration-500 group-hover:scale-125 group-hover:from-cyan-400 group-hover:to-yellow-400 group-focus:scale-125 group-focus:from-cyan-400 group-focus:to-yellow-400 shadow-2xl">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-12 w-12 text-white transition-all duration-300 group-hover:scale-110"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </button>
                      )}

                      {/* Enhanced custom controls */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-all duration-500 ${
                          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                        }`}
                      >
                        {/* Enhanced progress bar */}
                        <div
                          className="w-full h-3 bg-neutral-700 rounded-full mb-4 cursor-pointer group"
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
                          <div className="relative h-full">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-yellow-500 rounded-full transition-all duration-300 group-hover:h-4"
                              style={{ width: `${progress * 100}%` }}
                            ></div>
                            <div
                              className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg transform -translate-y-1/2 transition-all duration-300 group-hover:scale-125"
                              style={{ left: `${progress * 100}%`, marginLeft: "-8px" }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {/* Enhanced play/pause button */}
                            <button
                              onClick={togglePlayback}
                              className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 transition-all duration-300 hover:scale-110"
                              aria-label={isPlaying ? "Pause" : "Play"}
                            >
                              {isPlaying ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-8 w-8"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path fillRule="evenodd" d="M10 18V6h-4v12h4zm8 0V6h-4v12h4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-8 w-8"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>

                            {/* Enhanced time display */}
                            <div className="text-white text-sm font-mono bg-black/30 px-2 py-1 rounded">
                              {formatTime(progress * duration)} / {formatTime(duration)}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            {/* Enhanced volume controls */}
                            <div className="flex items-center">
                              <button
                                onClick={toggleMute}
                                className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 mr-2 transition-all duration-300 hover:scale-110"
                                aria-label={isMuted ? "Unmute" : "Mute"}
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
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="w-24 accent-cyan-500 hover:accent-yellow-500 transition-colors duration-300"
                                aria-label="Volume"
                              />
                            </div>

                            {/* Enhanced fullscreen button */}
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
                              className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 transition-all duration-300 hover:scale-110"
                              aria-label="Toggle fullscreen"
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
                                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Enhanced coming soon placeholder
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-cyan-900/30 to-neutral-900/30">
                      <div className="bg-gradient-to-br from-cyan-500/30 to-yellow-500/30 backdrop-blur-sm rounded-full p-8 border-2 border-yellow-300/50 mb-6 animate-pulse">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-20 w-20 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <h4 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400 mb-4">
                        {comingSoonText}
                      </h4>
                      <p className="text-white/90 max-w-md text-lg leading-relaxed">{comingSoonDescriptionText}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
                  <div className="text-sm text-white/60 font-mono bg-neutral-800/50 px-3 py-1 rounded">
                    {sessionIdText}: {videoId}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md bg-gradient-to-r from-neutral-800 to-neutral-700 px-4 py-2 text-sm font-medium text-white hover:from-neutral-700 hover:to-neutral-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300 hover:scale-105"
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
                        {visitWebsiteText}
                      </a>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md bg-gradient-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-medium text-white hover:from-cyan-500 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all duration-300 hover:scale-105"
                      onClick={closeModal}
                    >
                      {closeText}
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
