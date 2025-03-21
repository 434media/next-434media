"use client"

import { motion, AnimatePresence } from "motion/react"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"

interface PortfolioItem {
  showVideo: boolean
  video?: string
  poster?: string
  photo: string
  company: string
  title: string
  description: string
  linkedin?: string
  instagram?: string
  website?: string
  showLinkedin?: boolean
  showInstagram?: boolean
  showWebsite?: boolean
}

interface PortfolioModalProps {
  item: PortfolioItem
  onClose: () => void
}

export function PortfolioModal({ item, onClose }: PortfolioModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    document.addEventListener("mousedown", handleClickOutside)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("mousedown", handleClickOutside)
      document.body.style.overflow = "unset"
    }
  }, [onClose])

  useEffect(() => {
    // Store the previously focused element to restore focus when modal closes
    const previouslyFocusedElement = document.activeElement as HTMLElement

    if (modalRef.current) {
      modalRef.current.focus()
    }

    return () => {
      // Restore focus to the previously focused element when modal closes
      if (previouslyFocusedElement) {
        previouslyFocusedElement.focus()
      }
    }
  }, [])

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error)
      })
      setIsPlaying(true)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-50 overflow-y-auto"
        aria-modal="true"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="w-full max-w-4xl bg-neutral-900 rounded-xl overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-2 text-white/60 hover:text-white rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
              aria-label="Close modal"
            >
              <i className="ri-close-line text-2xl" />
            </button>

            <div className="max-h-[80vh] overflow-y-auto">
              <motion.div
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4 }}
                className="relative aspect-video"
              >
                {item.showVideo ? (
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      src={item.video}
                      poster={item.poster || item.photo}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain"
                      aria-label={`Video for ${item.company}`}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onError={(e) => {
                        console.error("Error loading video:", e)
                        setIsPlaying(false)
                      }}
                    />
                    {!isPlaying && (
                      <button
                        onClick={handlePlayClick}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 group"
                        aria-label="Play video"
                      >
                        <div className="bg-white/20 rounded-full p-4 group-hover:bg-white/30 transition-colors">
                          <i className="ri-play-fill text-4xl text-white" />
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  <Image
                    src={item.photo || "/placeholder.svg"}
                    alt={item.company}
                    className="w-full h-full object-contain"
                    width={1600}
                    height={900}
                    priority
                  />
                )}
              </motion.div>

              <motion.div
                className="p-6 sm:p-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2
                    id="modal-title"
                    className="text-3xl sm:text-4xl text-white font-geist-sans font-bold tracking-tight"
                  >
                    {item.company}
                  </h2>
                  <div className="flex space-x-4">
                    {item.showLinkedin && item.linkedin && (
                      <a
                        href={item.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-neutral-900 p-1 rounded-full"
                        aria-label={`Visit ${item.company}'s LinkedIn profile`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                      </a>
                    )}
                    {item.showInstagram && item.instagram && (
                      <a
                        href={item.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 focus:ring-offset-neutral-900 p-1 rounded-full"
                        aria-label={`Visit ${item.company}'s Instagram profile`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                      </a>
                    )}
                    {item.showWebsite && item.website && (
                      <a
                        href={item.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-900 p-1 rounded-full"
                        aria-label={`Visit ${item.company}'s website`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="2" y1="12" x2="22" y2="12"></line>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl text-emerald-400 mb-4 tracking-tight">{item.title}</h3>
                <p className="text-neutral-300 text-base sm:text-lg leading-relaxed">{item.description}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

