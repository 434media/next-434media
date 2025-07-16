"use client"

import type React from "react"

import { motion } from "motion/react"
import { X, ExternalLink, Calendar, MapPin } from "lucide-react"
import { useEffect, useCallback, useRef } from "react"
import type { MagazineSection } from "./MagazineData"

interface MagazineModalProps {
  section: MagazineSection
  onClose: () => void
  isModalOpen?: boolean
}

export function MagazineModal({ section, onClose, isModalOpen = false }: MagazineModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Safe body scroll prevention that works in production
  useEffect(() => {
    let originalStyles: { [key: string]: string } = {}

    try {
      // Store original styles safely
      if (typeof window !== "undefined" && document.body) {
        originalStyles = {
          overflow: document.body.style.overflow || "",
          position: document.body.style.position || "",
          width: document.body.style.width || "",
          height: document.body.style.height || "",
          top: document.body.style.top || "",
        }

        // Get current scroll position
        const scrollY = window.scrollY

        // Apply styles to prevent scrolling
        document.body.style.overflow = "hidden"
        document.body.style.position = "fixed"
        document.body.style.top = `-${scrollY}px`
        document.body.style.width = "100%"
        document.body.style.left = "0"
      }
    } catch (error) {
      console.warn("Failed to prevent body scroll:", error)
    }

    // Cleanup function
    return () => {
      try {
        if (typeof window !== "undefined" && document.body) {
          // Get the scroll position from the fixed body
          const scrollY = Number.parseInt(document.body.style.top || "0") * -1

          // Restore original styles
          Object.keys(originalStyles).forEach((key) => {
            if (originalStyles[key]) {
              document.body.style[key as any] = originalStyles[key]
            } else {
              document.body.style.removeProperty(key.replace(/([A-Z])/g, "-$1").toLowerCase())
            }
          })

          // Restore scroll position
          if (scrollY > 0) {
            window.scrollTo(0, scrollY)
          }
        }
      } catch (error) {
        console.warn("Failed to restore body scroll:", error)
      }
    }
  }, [])

  // Handle escape key with proper cleanup
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.addEventListener("keydown", handleEscape, { passive: false })
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [handleEscape])

  // Handle backdrop click with proper event handling
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    },
    [onClose],
  )

  // Handle close button click
  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    },
    [onClose],
  )

  // Prevent modal content click from bubbling
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <motion.div
      ref={modalRef}
      className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[9999]"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <motion.div
        className="bg-white border-4 border-black shadow-2xl w-full max-w-4xl relative flex flex-col md:mt-10"
        style={{
          maxHeight: "90vh",
          height: "90vh",
          position: "relative",
          zIndex: 10000,
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={handleContentClick}
      >
        {/* Header - Fixed at top with logo background */}
        <div
          className={`${section.color} pt-6 p-6 border-b-4 border-black relative flex-shrink-0`}
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "80px 80px",
            backgroundRepeat: "repeat",
            backgroundPosition: "0 0",
            filter: "brightness(1.2) contrast(1.1)",
          }}
        >
          {/* Semi-transparent overlay to blend logo with section color */}
          <div className={`absolute inset-0 ${section.color} opacity-75`} style={{ mixBlendMode: "multiply" }} />

          <div className="relative z-10 pt-20 md:pt-0">
            <button
              onClick={handleCloseClick}
              className="mt-20 md:mt-0 absolute top-2 right-2 md:top-4 md:right-4 bg-black text-white p-2 hover:bg-white hover:text-black transition-colors duration-300 border-2 border-black z-10 touch-manipulation"
              aria-label="Close modal"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-12">
              <h2
                id="modal-title"
                className="text-2xl md:text-4xl font-black text-white uppercase tracking-wide leading-tight mb-2"
                style={{
                  fontFamily: "Impact, Arial Black, sans-serif",
                  textShadow: "2px 2px 0px black, 4px 4px 0px rgba(0,0,0,0.3)",
                }}
              >
                {section.title}
              </h2>
              <h3 className="text-lg md:text-xl font-bold text-white/90 uppercase tracking-wide">{section.subtitle}</h3>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          ref={contentRef}
          className="overflow-y-auto p-6 flex-1"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Main Content */}
          <div className="prose prose-lg max-w-none mb-8">
            <div className="whitespace-pre-line text-gray-800 leading-relaxed text-sm md:text-base">
              {section.content?.fullText || section.preview}
            </div>
          </div>

          {/* Images */}
          {section.content?.images && section.content.images.length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg md:text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Images
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.content.images.map((image, index) => (
                  <div key={index} className="border-4 border-black shadow-lg">
                    <img
                      src={image || "/placeholder.svg?height=200&width=300&text=Image"}
                      alt={`${section.title} image ${index + 1}`}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {section.content?.videos && section.content.videos.length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg md:text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Videos
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.content.videos.map((video, index) => (
                  <div
                    key={index}
                    className="border-4 border-black shadow-lg bg-gray-200 h-48 flex items-center justify-center"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-2">🎬</div>
                      <p className="text-sm font-bold">Video {index + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          {section.content?.gallery && section.content.gallery.length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg md:text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Gallery
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {section.content.gallery.map((item, index) => (
                  <div key={index} className="border-4 border-black shadow-lg">
                    <img
                      src={item.src || "/placeholder.svg?height=128&width=200&text=Gallery"}
                      alt={item.alt}
                      className="w-full h-32 object-cover"
                      loading="lazy"
                    />
                    <div className="p-2 bg-white">
                      <p className="text-xs font-bold">{item.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {section.content?.events && section.content.events.length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg md:text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Events
              </h4>
              <div className="space-y-4">
                {section.content.events.map((event, index) => (
                  <div key={index} className="border-4 border-black p-4 bg-gray-50">
                    <h5 className="text-base md:text-lg font-black uppercase tracking-wide mb-2">{event.title}</h5>
                    <div className="flex flex-col md:flex-row md:items-center md:space-x-4 text-sm text-gray-600 mb-2 space-y-1 md:space-y-0">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    </div>
                    <p className="text-gray-800 text-sm md:text-base">{event.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {section.content?.links && section.content.links.length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg md:text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Related Links
              </h4>
              <div className="space-y-2">
                {section.content.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-bold touch-manipulation text-sm md:text-base"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>{link.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="border-t-4 border-black p-4 bg-gray-100 flex-shrink-0">
          <div className="hidden md:flex md:items-center md:justify-between">
            <div className="text-xs md:text-sm text-gray-600 text-center md:text-left">
              Digital Canvas • Volume #{section.id.includes("v1") ? "001" : section.id.includes("v2") ? "002" : "003"}
            </div>
            <button
              onClick={handleCloseClick}
              className="bg-black text-white px-4 py-2 md:px-6 font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors duration-300 border-2 border-black touch-manipulation text-sm md:text-base"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
