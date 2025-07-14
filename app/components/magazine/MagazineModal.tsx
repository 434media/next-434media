"use client"
import { motion, AnimatePresence } from "motion/react"
import { X, Calendar, Users, MapPin, Clock } from "lucide-react"
import { Button } from "../analytics/Button"

interface MagazineSection {
  id: string
  title: string
  subtitle: string
  description: string
  content: string
  image: string
  bgColor: string
  textColor: string
  category: string
  date?: string
  author?: string
  readTime?: string
  tags?: string[]
  gallery?: string[]
  events?: Array<{
    title: string
    date: string
    location: string
    description: string
    image: string
  }>
}

interface MagazineModalProps {
  section: MagazineSection | null
  isOpen: boolean
  onClose: () => void
}

export function MagazineModal({ section, isOpen, onClose }: MagazineModalProps) {
  if (!section) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-8 text-white" style={{ backgroundColor: section.bgColor }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>

              <div className="flex items-start gap-6">
                <img
                  src={section.image || "/placeholder.svg"}
                  alt={section.title}
                  className="w-24 h-24 rounded-xl object-cover shadow-lg"
                />
                <div className="flex-1">
                  <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-3">
                    {section.category}
                  </div>
                  <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
                  <p className="text-lg opacity-90">{section.subtitle}</p>

                  {/* Meta information */}
                  <div className="flex items-center gap-4 mt-4 text-sm opacity-80">
                    {section.author && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {section.author}
                      </div>
                    )}
                    {section.date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {section.date}
                      </div>
                    )}
                    {section.readTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {section.readTime}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {/* Description */}
              <div className="prose prose-lg max-w-none mb-8">
                <p className="text-gray-600 text-lg leading-relaxed">{section.description}</p>
              </div>

              {/* Main Content */}
              <div className="space-y-6">
                <div className="prose prose-lg max-w-none">
                  {section.content.split("\n\n").map((paragraph, index) => (
                    <p key={index} className="text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Tags */}
                {section.tags && section.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {section.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Gallery */}
                {section.gallery && section.gallery.length > 0 && (
                  <div className="pt-6 border-t">
                    <h3 className="text-xl font-bold mb-4">Gallery</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {section.gallery.map((image, index) => (
                        <img
                          key={index}
                          src={image || "/placeholder.svg"}
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Events */}
                {section.events && section.events.length > 0 && (
                  <div className="pt-6 border-t">
                    <h3 className="text-xl font-bold mb-4">Featured Events</h3>
                    <div className="space-y-4">
                      {section.events.map((event, index) => (
                        <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                          <img
                            src={event.image || "/placeholder.svg"}
                            alt={event.title}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{event.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {event.date}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
