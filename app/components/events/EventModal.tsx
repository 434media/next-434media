"use client"

import type React from "react"

import { X, Calendar, MapPin, Users, ExternalLink, User, Share2, Heart, Bookmark } from "lucide-react"
import type { Event } from "../../types/event-types"
import { formatEventDate } from "../../lib/event-utils"
import { cn } from "../../lib/utils"
import { useState, useEffect } from "react"

interface EventModalProps {
  event: Event | null
  isOpen: boolean
  onClose: () => void
}

export function EventModal({ event, isOpen, onClose }: EventModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !event) return null

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "conference":
        return {
          bg: "bg-gradient-to-r from-orange-500 to-red-500",
          text: "text-white",
          lightBg: "bg-orange-50",
          lightText: "text-orange-800",
        }
      case "workshop":
        return {
          bg: "bg-gradient-to-r from-amber-500 to-yellow-500",
          text: "text-white",
          lightBg: "bg-amber-50",
          lightText: "text-amber-800",
        }
      case "meetup":
        return {
          bg: "bg-gradient-to-r from-yellow-500 to-orange-500",
          text: "text-white",
          lightBg: "bg-yellow-50",
          lightText: "text-yellow-800",
        }
      case "networking":
        return {
          bg: "bg-gradient-to-r from-blue-500 to-indigo-500",
          text: "text-white",
          lightBg: "bg-blue-50",
          lightText: "text-blue-800",
        }
      default:
        return {
          bg: "bg-gradient-to-r from-gray-500 to-slate-500",
          text: "text-white",
          lightBg: "bg-gray-50",
          lightText: "text-gray-800",
        }
    }
  }

  const categoryColors = getCategoryColor(event.category)

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleShare = async () => {
    if (navigator.share && event.url) {
      try {
        await navigator.share({
          title: event.title,
          text: event.description,
          url: event.url,
        })
      } catch (err) {
        // Fallback to clipboard
        navigator.clipboard.writeText(event.url)
      }
    } else if (event.url) {
      navigator.clipboard.writeText(event.url)
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500",
        isAnimating ? "bg-black/60 backdrop-blur-sm" : "bg-black/0",
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden transition-all duration-700 ease-out",
          isAnimating ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-8",
        )}
      >
        {/* Enhanced Header with Parallax Effect */}
        <div className="relative h-64 overflow-hidden">
          {event.image ? (
            <>
              <img
                src={event.image || "/placeholder.svg"}
                alt={event.title}
                className={cn(
                  "w-full h-full object-cover transition-all duration-1000",
                  imageLoaded ? "scale-100 opacity-100" : "scale-110 opacity-0",
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 animate-pulse" />
              )}
            </>
          ) : (
            <div className={cn("w-full h-full", categoryColors.bg)} />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Action Buttons */}
          <div className="absolute top-6 right-6 flex gap-3">
            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={cn(
                "p-3 rounded-full backdrop-blur-md transition-all duration-300 hover:scale-110",
                isBookmarked ? "bg-amber-500 text-white" : "bg-white/20 text-white hover:bg-white/30",
              )}
            >
              <Bookmark className={cn("h-5 w-5", isBookmarked && "fill-current")} />
            </button>

            <button
              onClick={() => setIsLiked(!isLiked)}
              className={cn(
                "p-3 rounded-full backdrop-blur-md transition-all duration-300 hover:scale-110",
                isLiked ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30",
              )}
            >
              <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
            </button>

            <button
              onClick={handleShare}
              className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all duration-300 hover:scale-110"
            >
              <Share2 className="h-5 w-5" />
            </button>

            <button
              onClick={onClose}
              className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all duration-300 hover:scale-110"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Category Badge */}
          {event.category && (
            <div className="absolute bottom-6 left-6">
              <div
                className={cn(
                  "inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-md",
                  categoryColors.bg,
                  categoryColors.text,
                  "shadow-lg",
                )}
              >
                <div className="w-2 h-2 rounded-full bg-white/80 mr-2" />
                {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-16rem)]">
          <div className="p-8">
            {/* Title Section */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">{event.title}</h1>

              {event.description && <p className="text-lg text-gray-600 leading-relaxed">{event.description}</p>}
            </div>

            {/* Enhanced Event Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-6">
                <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                  <div className="p-3 rounded-xl bg-amber-500 text-white">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Date & Time</div>
                    <div className="text-gray-600">{formatEventDate(event.date, event.time)}</div>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                    <div className="p-3 rounded-xl bg-blue-500 text-white">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Location</div>
                      <div className="text-gray-600">{event.location}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {event.organizer && (
                  <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
                    <div className="p-3 rounded-xl bg-purple-500 text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Organizer</div>
                      <div className="text-gray-600">{event.organizer}</div>
                    </div>
                  </div>
                )}

                {event.attendees && (
                  <div className="flex items-start space-x-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                    <div className="p-3 rounded-xl bg-green-500 text-white">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">Attendees</div>
                      <div className="text-gray-600">{event.attendees} people attending</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Price Section */}
            {event.price && (
              <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border border-yellow-200">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-2">Event Price</div>
                    <div className="text-3xl font-bold text-amber-600">{event.price}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {event.url && (
                <button
                  onClick={() => window.open(event.url, "_blank")}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-6 py-4 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg font-semibold text-lg"
                >
                  <ExternalLink className="h-5 w-5 mr-3" />
                  View Original Event
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-4 rounded-2xl transition-all duration-300 hover:scale-105 font-semibold text-lg"
              >
                Close
              </button>
            </div>

            {/* Source Info */}
            {event.source && (
              <div className="text-center pt-6 border-t border-gray-100">
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
                  Imported from {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
