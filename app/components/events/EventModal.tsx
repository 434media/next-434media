"use client"

import { X, Calendar, MapPin, Users, ExternalLink, User } from "lucide-react"
import type { Event } from "../../types/event-types"
import { formatEventDate } from "../../lib/event-utils"
import { cn } from "../../lib/utils"

interface EventModalProps {
  event: Event | null
  isOpen: boolean
  onClose: () => void
}

export function EventModal({ event, isOpen, onClose }: EventModalProps) {
  if (!isOpen || !event) return null

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "conference":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "workshop":
        return "bg-green-100 text-green-800 border-green-200"
      case "meetup":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "networking":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative">
          {event.image && (
            <div className="h-48 rounded-t-2xl overflow-hidden">
              <img src={event.image || "/placeholder.svg"} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 p-0 bg-white/80 hover:bg-white rounded-md flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Category Badge */}
          {event.category && (
            <div
              className={cn(
                "inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 border",
                getCategoryColor(event.category),
              )}
            >
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>

          {/* Description */}
          {event.description && <p className="text-gray-600 mb-6 leading-relaxed">{event.description}</p>}

          {/* Event Details */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">{formatEventDate(event.date, event.time)}</div>
              </div>
            </div>

            {event.location && (
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900">Location</div>
                  <div className="text-gray-600">{event.location}</div>
                </div>
              </div>
            )}

            {event.organizer && (
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900">Organizer</div>
                  <div className="text-gray-600">{event.organizer}</div>
                </div>
              </div>
            )}

            {event.attendees && (
              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <div className="font-medium text-gray-900">Attendees</div>
                  <div className="text-gray-600">{event.attendees} people attending</div>
                </div>
              </div>
            )}

            {event.price && (
              <div className="flex items-start space-x-3">
                <div className="h-5 w-5 text-purple-500 mt-0.5 flex items-center justify-center">
                  <span className="text-sm font-bold">$</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Price</div>
                  <div className="text-gray-600">{event.price}</div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            {event.url && (
              <button
                onClick={() => window.open(event.url, "_blank")}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-all duration-200"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Original Event
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>

          {/* Source Info */}
          {event.source && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <span className="text-sm text-gray-500">
                Imported from {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
