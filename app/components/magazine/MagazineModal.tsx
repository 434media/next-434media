"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Calendar, User, ExternalLink, MapPin } from "lucide-react"
import { useMobile } from "../../hooks/use-mobile"
import type { MagazineSection } from "./MagazineData"

interface MagazineModalProps {
  section: MagazineSection | null
  isOpen: boolean
  onClose: () => void
}

export function MagazineModal({ section, isOpen, onClose }: MagazineModalProps) {
  const [activeTab, setActiveTab] = useState<"content" | "gallery" | "events">("content")
  const isMobile = useMobile()

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("content")
    }
  }, [isOpen])

  if (!section) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm ${
            !isMobile ? "pl-64 pt-16" : "pt-20"
          }`}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`relative w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden ${
              isMobile ? "max-w-lg" : "max-w-4xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="relative p-6 text-white"
              style={{
                background: `linear-gradient(135deg, ${section.bgColor} 0%, ${section.bgColor}dd 100%)`,
              }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                  {section.icon}
                  <span className="text-sm font-medium">{section.category}</span>
                </div>
              </div>

              <h1 className={`font-bold mt-4 mb-2 ${isMobile ? "text-2xl" : "text-3xl"}`}>{section.title}</h1>
              <p className={`opacity-90 mb-4 ${isMobile ? "text-base" : "text-lg"}`}>{section.subtitle}</p>

              {/* Meta Information */}
              <div className="flex flex-wrap gap-4 text-sm opacity-80">
                {section.author && (
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{section.author}</span>
                  </div>
                )}
                {section.date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{section.date}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("content")}
                  className={`px-6 py-3 font-medium transition-colors ${
                    activeTab === "content"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Article
                </button>
                {section.gallery && section.gallery.length > 0 && (
                  <button
                    onClick={() => setActiveTab("gallery")}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === "gallery"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Gallery
                  </button>
                )}
                {section.events && section.events.length > 0 && (
                  <button
                    onClick={() => setActiveTab("events")}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === "events"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Events
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto ${isMobile ? "max-h-[50vh]" : "max-h-[60vh]"}`}>
              {activeTab === "content" && (
                <div className="p-6">
                  {/* Featured Image with responsive 4:5 aspect ratio */}
                  <div className="mb-6 rounded-lg overflow-hidden">
                    <div className={`w-full bg-gray-100 ${isMobile ? "aspect-[4/5]" : "aspect-[4/5] max-h-80"}`}>
                      <img
                        src={section.image || "/placeholder.svg?height=1350&width=1080"}
                        alt={section.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <p className={`text-gray-700 mb-6 leading-relaxed ${isMobile ? "text-base" : "text-lg"}`}>
                    {section.description}
                  </p>

                  {/* Main Content */}
                  <div className="prose prose-lg max-w-none">
                    {section.content.split("\n").map((paragraph, index) => (
                      <p key={index} className="mb-4 text-gray-700 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "gallery" && section.gallery && (
                <div className="p-6">
                  <div
                    className={`grid gap-4 ${isMobile ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}
                  >
                    {section.gallery.map((image, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:shadow-lg transition-shadow cursor-pointer"
                      >
                        <img
                          src={image || "/placeholder.svg"}
                          alt={`Gallery image ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "events" && section.events && (
                <div className="p-6">
                  <div className="space-y-6">
                    {section.events.map((event, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className={`flex gap-4 ${isMobile ? "flex-col" : ""}`}>
                          <img
                            src={event.image || "/placeholder.svg"}
                            alt={event.title}
                            className={`object-cover rounded-lg flex-shrink-0 ${
                              isMobile ? "w-full h-32" : "w-24 h-24"
                            }`}
                          />
                          <div className="flex-1">
                            <h3 className={`font-bold text-gray-900 mb-2 ${isMobile ? "text-lg" : "text-xl"}`}>
                              {event.title}
                            </h3>
                            <div
                              className={`flex gap-4 text-sm text-gray-600 mb-3 ${
                                isMobile ? "flex-col gap-2" : "items-center"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{event.date}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{event.location}</span>
                              </div>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{event.description}</p>
                            <button className="mt-3 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                              <span>Learn More</span>
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
