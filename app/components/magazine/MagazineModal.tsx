"use client"

import { motion } from "motion/react"
import { X, ExternalLink, Calendar, MapPin } from "lucide-react"
import { useEffect } from "react"
import type { MagazineSection } from "./MagazineData"

interface MagazineModalProps {
  section: MagazineSection
  onClose: () => void
  isModalOpen?: boolean
}

export function MagazineModal({ section, onClose, isModalOpen = false }: MagazineModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    // Store original body overflow
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position

    // Prevent scrolling on mount
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.width = "100%"
    document.body.style.height = "100%"

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.width = ""
      document.body.style.height = ""
    }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 bg-black/95 flex items-center justify-center p-4"
      style={{
        zIndex: 999999, // Increased z-index
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        touchAction: "none", // Prevent touch scrolling on the backdrop
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white border-4 border-black shadow-2xl w-full max-w-4xl relative"
        style={{
          maxHeight: "95vh",
          height: "95vh",
          position: "relative",
          zIndex: 1000000,
          touchAction: "auto", // Allow touch scrolling within the modal
        }}
        initial={{ scale: 0.8, rotate: -2 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.8, rotate: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top with logo background */}
        <div
          className={`${section.color} pt-6 p-6 border-b-4 border-black relative flex-shrink-0`}
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "80px 80px",
            backgroundRepeat: "repeat",
            backgroundPosition: "0 0",
            animation: "float 25s ease-in-out infinite",
            filter: "brightness(1.2) contrast(1.1)",
          }}
        >
          {/* Semi-transparent overlay to blend logo with section color */}
          <div className={`absolute inset-0 ${section.color} opacity-75`} style={{ mixBlendMode: "multiply" }} />

          <div className="relative z-10 mt-20 -mb-6 md:mt-8 -md:mb-2">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 bg-black text-white p-2 hover:bg-white hover:text-black transition-colors duration-300 border-2 border-black z-10 touch-manipulation"
              style={{ touchAction: "manipulation" }}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-4 mb-4">
              <div>
                <h2
                  className="text-3xl md:text-4xl font-black text-white uppercase tracking-wide leading-tight"
                  style={{
                    fontFamily: "Impact, Arial Black, sans-serif",
                    textShadow: "2px 2px 0px black, 4px 4px 0px rgba(0,0,0,0.3)",
                  }}
                >
                  {section.title}
                </h2>
                <h3 className="text-xl font-bold text-white/90 uppercase tracking-wide">{section.subtitle}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          className="overflow-y-auto p-6 flex-1"
          style={{
            height: "calc(95vh - 200px)", // Subtract header and footer height
            maxHeight: "calc(95vh - 200px)",
            overscrollBehavior: "contain", // Prevent scroll chaining
            WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
            touchAction: "pan-y", // Only allow vertical scrolling
          }}
        >
          {/* Main Content */}
          <div className="prose prose-lg max-w-none mb-8">
            <div className="whitespace-pre-line text-gray-800 leading-relaxed">
              {section.content?.fullText || section.preview}
            </div>
          </div>

          {/* Images */}
          {section.content?.images && section.content.images.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">Images</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.content.images.map((image, index) => (
                  <div key={index} className="border-4 border-black shadow-lg">
                    <img
                      src={image || "/placeholder.svg"}
                      alt={`${section.title} image ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {section.content?.videos && section.content.videos.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">Videos</h4>
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
              <h4 className="text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">Gallery</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {section.content.gallery.map((item, index) => (
                  <div key={index} className="border-4 border-black shadow-lg">
                    <img src={item.src || "/placeholder.svg"} alt={item.alt} className="w-full h-32 object-cover" />
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
              <h4 className="text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">Events</h4>
              <div className="space-y-4">
                {section.content.events.map((event, index) => (
                  <div key={index} className="border-4 border-black p-4 bg-gray-50">
                    <h5 className="text-lg font-black uppercase tracking-wide mb-2">{event.title}</h5>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    </div>
                    <p className="text-gray-800">{event.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {section.content?.links && section.content.links.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xl font-black uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Related Links
              </h4>
              <div className="space-y-2">
                {section.content.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-bold touch-manipulation"
                    style={{ touchAction: "manipulation" }}
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
            <div className="text-sm text-gray-600">
              Digital Canvas • Volume #{section.id.includes("v1") ? "001" : section.id.includes("v2") ? "002" : "003"}
            </div>
            <button
              onClick={onClose}
              className="bg-black text-white px-6 py-2 font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors duration-300 border-2 border-black touch-manipulation"
              style={{ touchAction: "manipulation" }}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
