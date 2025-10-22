"use client"

import { Fragment, useEffect, useState } from "react"
import { Dialog, Transition, DialogPanel, TransitionChild } from "@headlessui/react"
import { X, Calendar, MapPin, Users, User, ExternalLink, Clock, Edit, Trash2 } from "lucide-react"
import type { Event } from "../../types/event-types"
import { formatEventDate } from "../../lib/event-utils"
import { cn } from "../../lib/utils"

interface EventModalProps {
  event: Event | null
  isOpen: boolean
  onClose: () => void
  onEditRequest?: (event: Event) => void
  onDeleteRequest?: (event: Event) => void
}

export function EventModal({ event, isOpen, onClose, onEditRequest, onDeleteRequest }: EventModalProps) {
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
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
          bg: "bg-gradient-to-r from-neutral-500 to-neutral-500",
          text: "text-white",
          lightBg: "bg-neutral-50",
          lightText: "text-neutral-800",
          border: "border-neutral-200",
        }
      case "workshop":
        return {
          bg: "bg-gradient-to-r from-neutral-400 to-yellow-500",
          text: "text-white",
          lightBg: "bg-neutral-50",
          lightText: "text-neutral-800",
          border: "border-neutral-200",
        }
      case "meetup":
        return {
          bg: "bg-gradient-to-r from-yellow-500 to-neutral-500",
          text: "text-white",
          lightBg: "bg-yellow-50",
          lightText: "text-neutral-800",
          border: "border-yellow-200",
        }
      case "networking":
        return {
          bg: "bg-gradient-to-r from-neutral-500 to-neutral-500",
          text: "text-white",
          lightBg: "bg-neutral-50",
          lightText: "text-neutral-800",
          border: "border-neutral-200",
        }
      default:
        return {
          bg: "bg-gradient-to-r from-neutral-500 to-neutral-500",
          text: "text-white",
          lightBg: "bg-neutral-50",
          lightText: "text-neutral-800",
          border: "border-neutral-200",
        }
    }
  }

  const categoryColors = getCategoryColor(event.category)

  const handleCopyUrl = () => {
    if (event.url) {
      navigator.clipboard.writeText(event.url)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleEditClick = () => {
    if (onEditRequest) {
      onEditRequest(event)
      onClose()
    }
  }

  const handleDeleteClick = () => {
    if (onDeleteRequest) {
      onDeleteRequest(event)
      onClose()
    }
  }

  // Check if this is a manual event (no source or source is 'manual')
  const isManualEvent = !event.source || event.source === "manual"

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <DialogPanel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-0 text-left align-middle shadow-2xl transition-all">
                {/* Header with Image Background */}
                <div className="relative">
                  <div className="h-48 sm:h-64 overflow-hidden">
                    {event.image ? (
                      <div className="w-full h-full relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10" />
                        <img
                          src={event.image || "/placeholder.svg"}
                          alt={event.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg"
                          }}
                        />
                      </div>
                    ) : (
                      <div className={cn("w-full h-full relative", categoryColors.bg)}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                    )}

                    {/* Category Badge */}
                    {event.category && (
                      <div className="absolute top-4 left-4 z-20">
                        <span
                          className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                            categoryColors.bg,
                            categoryColors.text,
                          )}
                        >
                          {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons - Improved positioning */}
                    <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                      {/* Edit Button */}
                      {onEditRequest && (
                        <button
                          type="button"
                          className="rounded-full bg-white/20 backdrop-blur-sm p-2 text-white hover:bg-blue-500/30 transition-all duration-200 hover:scale-110 border border-white/20 hover:border-blue-300/50"
                          onClick={handleEditClick}
                          title="Edit event"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                      )}

                      {/* Delete Button */}
                      {onDeleteRequest && (
                        <button
                          type="button"
                          className="rounded-full bg-white/20 backdrop-blur-sm p-2 text-white hover:bg-red-500/30 transition-all duration-200 hover:scale-110 border border-white/20 hover:border-red-300/50"
                          onClick={handleDeleteClick}
                          title="Delete event"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}

                      {/* Close Button */}
                      <button
                        type="button"
                        className="rounded-full bg-white/20 backdrop-blur-sm p-2 text-white hover:bg-white/30 transition-colors duration-200 border border-white/20"
                        onClick={onClose}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Title on Image */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                      <h3 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-md">{event.title}</h3>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column - Event Details */}
                    <div>
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center">
                          <Calendar className="h-5 w-5 mr-2 text-neutral-500" />
                          Event Details
                        </h4>
                        <div className="space-y-3 pl-7">
                          <div className="flex items-start">
                            <Clock className="h-5 w-5 mr-2 text-neutral-500 flex-shrink-0 mt-0.5" />
                            <span className="text-neutral-700">{formatEventDate(event.date, event.time)}</span>
                          </div>
                          {event.location && (
                            <div className="flex items-start">
                              <MapPin className="h-5 w-5 mr-2 text-neutral-500 flex-shrink-0 mt-0.5" />
                              <span className="text-neutral-700">{event.location}</span>
                            </div>
                          )}
                          {event.organizer && (
                            <div className="flex items-start">
                              <User className="h-5 w-5 mr-2 text-neutral-500 flex-shrink-0 mt-0.5" />
                              <span className="text-neutral-700">
                                <span className="font-medium">Organized by:</span> {event.organizer}
                              </span>
                            </div>
                          )}
                          {event.attendees && (
                            <div className="flex items-start">
                              <Users className="h-5 w-5 mr-2 text-neutral-500 flex-shrink-0 mt-0.5" />
                              <span className="text-neutral-700">
                                <span className="font-medium">Attendees:</span> {event.attendees}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price Info */}
                      {event.price && (
                        <div className="mb-6 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-700 font-medium">Price</span>
                            <span className="text-neutral-600 font-bold">{event.price}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column - Description */}
                    <div>
                      {event.description && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold text-neutral-900 mb-3">Description</h4>
                          <div className="text-neutral-700 leading-relaxed whitespace-pre-wrap">{event.description}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
                    {event.url ? (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-gradient-to-r from-neutral-500 to-neutral-500 hover:from-neutral-600 hover:to-neutral-600 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02]"
                      >
                        <ExternalLink className="h-5 w-5" />
                        View Original Event
                      </a>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <button
                      onClick={onClose}
                      className="flex-1 border-2 border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 px-4 py-3 rounded-xl transition-colors duration-200"
                    >
                      Close
                    </button>
                  </div>

                  {/* Copy URL Feedback */}
                  {isCopied && (
                    <div className="mt-4 text-center">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm animate-fade-in">
                        URL copied to clipboard!
                      </span>
                    </div>
                  )}
                </div>

                {/* Conditional Footer - Only show for imported events */}
                {!isManualEvent && event.source && (
                  <div className="px-6 pb-4">
                    <div className="text-center text-xs text-neutral-400 border-t border-neutral-100 pt-3">
                      Imported from {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
                    </div>
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
