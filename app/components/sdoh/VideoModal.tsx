"use client"
import { useEffect, useRef, useState } from "react"
import type React from "react"

interface VideoModalProps {
  isOpen: boolean
  onClose: () => void
  videoSrc: string
  title: string
  description: string
}

export function VideoModal({ isOpen, onClose, videoSrc, title, description }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Check if we have a valid video source
  const hasValidVideoSrc = videoSrc && videoSrc.trim() !== ""

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    const handleSpacebar = (e: KeyboardEvent) => {
      if (e.code === "Space" && hasValidVideoSrc) {
        e.preventDefault()
        togglePlayPause()
      }
    }

    document.addEventListener("keydown", handleEscape)
    document.addEventListener("keydown", handleSpacebar)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("keydown", handleSpacebar)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, hasValidVideoSrc])

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      if (hasValidVideoSrc) {
        setIsLoading(true)
        setHasError(false)
      } else {
        setIsLoading(false)
        setHasError(false)
      }
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setShowControls(true)
    } else {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      setIsPlaying(false)
    }
  }, [isOpen, hasValidVideoSrc])

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying || !showControls || !hasValidVideoSrc) return

    const timeout = setTimeout(() => {
      setShowControls(false)
    }, 3000)

    return () => clearTimeout(timeout)
  }, [isPlaying, showControls, hasValidVideoSrc])

  const handleVideoCanPlay = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleVideoError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const handleVideoPlay = () => {
    setIsPlaying(true)
  }

  const handleVideoPause = () => {
    setIsPlaying(false)
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
    if (!videoRef.current || hasError || !hasValidVideoSrc) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {
        setHasError(true)
      })
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || hasError || !hasValidVideoSrc) return

    const time = (Number.parseFloat(e.target.value) / 100) * duration
    videoRef.current.currentTime = time
    setCurrentTime(time)
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
    if (!videoRef.current) return

    if (isMuted) {
      videoRef.current.volume = volume
      setIsMuted(false)
    } else {
      videoRef.current.volume = 0
      setIsMuted(true)
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
    if (videoRef.current && hasValidVideoSrc) {
      setHasError(false)
      setIsLoading(true)
      videoRef.current.load()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95"
      onClick={onClose}
      onMouseMove={handleMouseMove}
    >
      <div
        className="relative w-full max-w-4xl bg-neutral-900 overflow-hidden border border-neutral-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#A31545] z-20"></div>

        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-20 w-10 h-10 bg-white text-neutral-900 hover:bg-neutral-100 transition-colors duration-200 flex items-center justify-center ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
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
        </button>

        {/* Video container */}
        <div className="relative" style={{ aspectRatio: "16/9" }}>
          {/* No video source - Coming Soon state */}
          {!hasValidVideoSrc && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
              <div className="text-center max-w-md px-6">
                <div className="w-20 h-20 mx-auto mb-6 text-[#FF6B35]">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <h3 className="text-white text-2xl font-bold mb-4">Coming Soon</h3>
                <p className="text-neutral-400 text-lg leading-relaxed mb-6">
                  This video will be available after the event. Check back later to watch the full session.
                </p>
                <div className="inline-flex items-center px-4 py-2 bg-neutral-800 text-[#FF6B35] text-sm font-medium border border-neutral-700">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                  Session Available Soon
                </div>
              </div>
            </div>
          )}

          {/* Loading state - only for valid video sources */}
          {hasValidVideoSrc && isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-[#A31545] border-t-transparent mx-auto mb-4 animate-spin"></div>
                <p className="text-neutral-400 text-sm">Loading video...</p>
              </div>
            </div>
          )}

          {/* Error state - only for valid video sources that failed */}
          {hasValidVideoSrc && hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
              <div className="text-center max-w-md px-6">
                <svg className="w-16 h-16 text-[#FF6B35] mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <h3 className="text-white text-lg font-semibold mb-2">Video Unavailable</h3>
                <p className="text-neutral-400 text-sm mb-4">
                  Unable to load the video. This might be due to network issues or the video file being temporarily
                  unavailable.
                </p>
                <button
                  onClick={retryLoad}
                  className="px-4 py-2 bg-[#A31545] hover:bg-[#8B1E3F] text-white transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Video element - only render if we have a valid source */}
          {hasValidVideoSrc && (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              src={videoSrc}
              controls={false}
              playsInline
              preload="metadata"
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              onClick={togglePlayPause}
            />
          )}

          {/* Play/Pause overlay when paused - only for valid videos */}
          {hasValidVideoSrc && !isPlaying && !isLoading && !hasError && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-10"
              onClick={togglePlayPause}
            >
              <div className="w-20 h-20 bg-white flex items-center justify-center border border-neutral-900 hover:bg-neutral-100 transition-colors duration-200">
                <svg className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          {/* Custom controls - only for valid videos */}
          {hasValidVideoSrc && showControls && !isLoading && !hasError && (
            <div className="absolute bottom-0 left-0 right-0 bg-neutral-900 p-4 z-10">
              {/* Progress bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={duration ? (currentTime / duration) * 100 : 0}
                  onChange={handleSeek}
                  className="w-full h-1 bg-neutral-700 appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #A31545 0%, #A31545 ${
                      duration ? (currentTime / duration) * 100 : 0
                    }%, #404040 ${duration ? (currentTime / duration) * 100 : 0}%, #404040 100%)`,
                  }}
                />
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={togglePlayPause}
                    className="p-2 bg-white text-neutral-900 hover:bg-neutral-100 transition-colors duration-200"
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
                    className="p-2 bg-white text-neutral-900 hover:bg-neutral-100 transition-colors duration-200"
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
                      className="w-20 h-1 bg-neutral-700 appearance-none cursor-pointer"
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
            </div>
          )}
        </div>

        {/* Video info - show for all cases */}
        <div className={`p-6 bg-neutral-900 border-t border-neutral-700 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}>
          <p className="text-neutral-300 leading-relaxed text-center">{description}</p>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B35] z-20"></div>
      </div>
    </div>
  )
}
