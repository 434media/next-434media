"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"
import { motion, AnimatePresence } from "motion/react"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "../../types/dictionary"

interface SDOHDemoDayProps {
  locale: Locale
  dict: Partial<Dictionary>
}

// Helper function to safely get string values from dictionary
const getStringValue = (value: any): string => {
  if (typeof value === "string") return value
  return ""
}

export default function SDOHDemoDay({ dict }: SDOHDemoDayProps) {
  const modalVideoRef = useRef<HTMLVideoElement>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalIsPlaying, setModalIsPlaying] = useState(false)
  const [modalCurrentTime, setModalCurrentTime] = useState(0)
  const [modalDuration, setModalDuration] = useState(0)
  const [modalVolume, setModalVolume] = useState(1)
  const [modalIsMuted, setModalIsMuted] = useState(false)
  const [showModalControls, setShowModalControls] = useState(true)

  // Modal keyboard controls
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false)
      }
    }

    const handleSpacebar = (e: KeyboardEvent) => {
      if (e.code === "Space" && isModalOpen) {
        e.preventDefault()
        toggleModalPlayPause()
      }
    }

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape)
      document.addEventListener("keydown", handleSpacebar)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("keydown", handleSpacebar)
      document.body.style.overflow = "unset"
    }
  }, [isModalOpen])

  // Auto-hide modal controls
  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (modalIsPlaying && showModalControls) {
      timeout = setTimeout(() => {
        setShowModalControls(false)
      }, 3000)
    }
    return () => clearTimeout(timeout)
  }, [modalIsPlaying, showModalControls])

  // Get localized text from dictionary
  const sdohDict = dict?.sdoh
  const demoDayDict = sdohDict?.demoDay
  const title = getStringValue(demoDayDict?.title) || "Demo Day Recap"
  const description =
    getStringValue(demoDayDict?.description) || "Cohort companies will participate in a public Demo Day pitch event"

  const handlePlayClick = () => {
    setIsModalOpen(true)
  }

  // Modal video handlers
  const toggleModalPlayPause = () => {
    if (modalVideoRef.current) {
      if (modalIsPlaying) {
        modalVideoRef.current.pause()
        setModalIsPlaying(false)
      } else {
        modalVideoRef.current.play()
        setModalIsPlaying(true)
      }
    }
  }

  const handleModalTimeUpdate = () => {
    if (modalVideoRef.current) {
      setModalCurrentTime(modalVideoRef.current.currentTime)
    }
  }

  const handleModalDurationChange = () => {
    if (modalVideoRef.current) {
      setModalDuration(modalVideoRef.current.duration)
    }
  }

  const handleModalSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (modalVideoRef.current) {
      const time = (Number.parseFloat(e.target.value) / 100) * modalDuration
      modalVideoRef.current.currentTime = time
      setModalCurrentTime(time)
    }
  }

  const handleModalVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value) / 100
    setModalVolume(newVolume)
    if (modalVideoRef.current) {
      modalVideoRef.current.volume = newVolume
    }
    setModalIsMuted(newVolume === 0)
  }

  const toggleModalMute = () => {
    if (modalVideoRef.current) {
      if (modalIsMuted) {
        modalVideoRef.current.volume = modalVolume
        setModalIsMuted(false)
      } else {
        modalVideoRef.current.volume = 0
        setModalIsMuted(true)
      }
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const handleModalMouseMove = () => {
    setShowModalControls(true)
  }

  const videoSrc = "https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
  const posterImage = "https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"

  return (
    <>
      <div className="w-full h-full">
        {/* Simple image with play button overlay */}
        <div
          className="relative w-full h-full aspect-[4/5] rounded-2xl overflow-hidden group cursor-pointer"
          onClick={handlePlayClick}
        >
          {/* Background image */}
          <img
            src={posterImage || "/placeholder.svg"}
            alt={title}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-75"
          />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 hover:scale-110 transition-transform duration-200">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
            <h3 className="text-2xl font-bold text-white mb-2">DEMO DAY RECAP</h3>
            <p className="text-white/90 text-sm leading-relaxed">
              Cohort companies will participate in a public Demo Day pitch event at the conclusion of the accelerator and receive the opportunity to run a pilot program of their technology in the Methodist system.
            </p>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
            onMouseMove={handleModalMouseMove}
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
                animate={{ opacity: showModalControls ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setIsModalOpen(false)}
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
                <video
                  ref={modalVideoRef}
                  className="w-full h-full object-cover"
                  src={videoSrc}
                  controls={false}
                  playsInline
                  webkit-playsinline="true"
                  x5-playsinline="true"
                  autoPlay
                  onTimeUpdate={handleModalTimeUpdate}
                  onDurationChange={handleModalDurationChange}
                  onPlay={() => setModalIsPlaying(true)}
                  onPause={() => setModalIsPlaying(false)}
                  onClick={toggleModalPlayPause}
                >
                  <source src={videoSrc} type="video/quicktime" />
                  <source src="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>

                {/* Play/Pause overlay when paused */}
                <AnimatePresence>
                  {!modalIsPlaying && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-10"
                      onClick={toggleModalPlayPause}
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
                  animate={{ opacity: showModalControls ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10"
                >
                  {/* Progress bar */}
                  <div className="mb-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={modalDuration ? (modalCurrentTime / modalDuration) * 100 : 0}
                      onChange={handleModalSeek}
                      className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${
                          modalDuration ? (modalCurrentTime / modalDuration) * 100 : 0
                        }%, rgba(255,255,255,0.3) ${modalDuration ? (modalCurrentTime / modalDuration) * 100 : 0}%, rgba(255,255,255,0.3) 100%)`,
                      }}
                    />
                  </div>

                  {/* Control buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={toggleModalPlayPause}
                        className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors duration-200"
                        aria-label={modalIsPlaying ? "Pause video" : "Play video"}
                      >
                        {modalIsPlaying ? (
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
                        onClick={toggleModalMute}
                        className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors duration-200"
                        aria-label={modalIsMuted ? "Unmute video" : "Mute video"}
                      >
                        {modalIsMuted ? (
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
                          value={modalIsMuted ? 0 : modalVolume * 100}
                          onChange={handleModalVolumeChange}
                          className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="text-white text-sm">
                        {formatTime(modalCurrentTime)} / {formatTime(modalDuration)}
                      </div>
                    </div>

                    <div className="text-white text-right">
                      <h3 className="font-semibold text-lg">DEMO DAY RECAP</h3>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Video info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: showModalControls ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="p-6 bg-gradient-to-t from-black to-transparent"
              >
                <p className="text-neutral-300 leading-relaxed text-center">{description}</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
