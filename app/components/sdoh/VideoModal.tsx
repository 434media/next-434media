"use client"
import { useEffect, useRef, useState } from "react"
import type React from "react"

import { motion, AnimatePresence } from "motion/react"

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
  videoSrc: string
  title: string
  description: string
}

export function VideoModal({ isOpen, onClose, videoSrc, title, description }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")

  // Auto-hide controls after 3 seconds of inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isPlaying && showControls) {
      timeout = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [isPlaying, showControls])

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setHasError(false)
      setErrorMessage("")
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setShowControls(true)

      // Set loading timeout
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.log("Modal video loading timeout")
          setIsLoading(false)
          setHasError(true)
          setErrorMessage("Video loading timed out. Please check your connection and try again.")
        }
      }, 10000) // 10 second timeout

      setLoadingTimeout(timeout)

      return () => {
        if (timeout) clearTimeout(timeout)
      }
    } else {
      // Reset when modal closes
      setIsLoading(true)
      setHasError(false)
      setErrorMessage("")
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
    }
  }, [isOpen])

  // Handle keyboard events
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    const handleSpacebar = (e: KeyboardEvent) => {
      if (e.code === "Space" && isOpen) {
        e.preventDefault()
        togglePlayPause()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("keydown", handleSpacebar)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("keydown", handleSpacebar)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  const handleVideoLoad = () => {
    console.log("Modal video loaded successfully")
    setIsLoading(false)
    setHasError(false)
    setErrorMessage("")
    if (loadingTimeout) {
      clearTimeout(loadingTimeout)
    }
  }

  const handleVideoError = (e: any) => {
    console.error("Modal video loading error:", e)
    setIsLoading(false)
    setHasError(true)

    // Determine error message based on error type
    const video = e.target as HTMLVideoElement
    const error = video.error

    let message = "Unable to load video. Please try again later."

    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          message = "Video loading was aborted. Please try again."
          break
        case MediaError.MEDIA_ERR_NETWORK:
          message = "Network error occurred while loading video. Please check your connection."
          break
        case MediaError.MEDIA_ERR_DECODE:
          message = "Video format is not supported or corrupted."
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = "Video format is not supported by your browser."
          break
        default:
          message = "An unknown error occurred while loading the video."
      }
    }

    setErrorMessage(message)

    if (loadingTimeout) {
      clearTimeout(loadingTimeout)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const togglePlayPause = () => {
    if (videoRef.current && !hasError) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true)
            })
            .catch((error) => {
              console.error("Video play failed:", error)
              // Don't set error state for play failures, just keep paused
            })
        }
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current && !hasError) {
      const time = (Number.parseFloat(e.target.value) / 100) * duration
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value) / 100
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const handleMouseMove = () => {
    setShowControls(true)
  }

  const retryLoad = () => {
    setHasError(false)
    setErrorMessage("")
    setIsLoading(true)
    if (videoRef.current) {
      // Reset video element
      videoRef.current.load()
    }
  }

  // Check if video source is valid
  const isValidVideoSrc = videoSrc && videoSrc.trim() !== ""

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={onClose}
          onMouseMove={handleMouseMove}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: showControls ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors duration-200 flex items-center justify-center"
              aria-label="Close video"
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
            </motion.button>

            {/* Video container */}
            <div className="relative" style={{ aspectRatio: "16/9" }}>
              {/* Loading state */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-10"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                      className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full mb-4"
                    />
                    <p className="text-white/80 text-sm">Loading video...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error state */}
              <AnimatePresence>
                {hasError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-white p-8 z-10"
                  >
                    <div className="text-center max-w-md">
                      <div className="w-16 h-16 mx-auto mb-4 text-red-400">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Video Unavailable</h3>
                      <p className="text-neutral-400 mb-4 text-sm leading-relaxed">
                        {errorMessage || "Sorry, this video could not be loaded."}
                      </p>
                      {isValidVideoSrc && (
                        <button
                          onClick={retryLoad}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                        >
                          Try Again
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Video element */}
              {isValidVideoSrc && (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  src={videoSrc}
                  controls={false}
                  playsInline
                  webkit-playsinline="true"
                  x5-playsinline="true"
                  crossOrigin="anonymous"
                  preload="metadata"
                  onLoadedData={handleVideoLoad}
                  onLoadedMetadata={handleVideoLoad}
                  onCanPlay={handleVideoLoad}
                  onError={handleVideoError}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onClick={togglePlayPause}
                />
              )}

              {/* Fallback for invalid video source */}
              {!isValidVideoSrc && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-white p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 text-neutral-400">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No Video Source</h3>
                    <p className="text-neutral-400">No video source provided.</p>
                  </div>
                </div>
              )}

              {/* Play/Pause overlay when paused */}
              <AnimatePresence>
                {!isPlaying && !isLoading && !hasError && isValidVideoSrc && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-10"
                    onClick={togglePlayPause}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                    >
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Custom controls */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: showControls && !isLoading && !hasError && isValidVideoSrc ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10"
              >
                {/* Progress bar */}
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={duration ? (currentTime / duration) * 100 : 0}
                    onChange={handleSeek}
                    className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${
                        duration ? (currentTime / duration) * 100 : 0
                      }%, rgba(255,255,255,0.3) ${duration ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.3) 100%)`,
                    }}
                  />
                </div>

                {/* Control buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={togglePlayPause}
                      className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors duration-200"
                      aria-label={isPlaying ? "Pause video" : "Play video"}
                    >
                      {isPlaying ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={toggleMute}
                      className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors duration-200"
                      aria-label={isMuted ? "Unmute video" : "Mute video"}
                    >
                      {isMuted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      )}
                    </button>

                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume * 100}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="text-white text-sm">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                  </div>

                  <div className="text-white text-right">
                    <h3 className="font-semibold text-lg">{title}</h3>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Video info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showControls && !hasError ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="p-6 bg-gradient-to-t from-black to-transparent"
            >
              <p className="text-neutral-300 leading-relaxed text-center">{description}</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
