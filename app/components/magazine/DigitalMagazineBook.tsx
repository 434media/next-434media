"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { DraggableCardBody, DraggableCardContainer } from "./DraggableCard"
import { MagazineModal } from "./MagazineModal"
import { ChevronLeft, ChevronRight, Users } from "lucide-react"
import { useMobile } from "../../hooks/use-mobile"
import { magazineSections, type MagazineSection } from "./MagazineData"

export function DigitalMagazineBook() {
  const [selectedSection, setSelectedSection] = useState<MagazineSection | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0)
  const isMobile = useMobile()

  const handleCardClick = (section: MagazineSection) => {
    setSelectedSection(section)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedSection(null)
  }

  const nextMobileCard = () => {
    setCurrentMobileIndex((prev) => (prev + 1) % magazineSections.length)
  }

  const prevMobileCard = () => {
    setCurrentMobileIndex((prev) => (prev - 1 + magazineSections.length) % magazineSections.length)
  }

  const goToMobileCard = (index: number) => {
    setCurrentMobileIndex(index)
  }

  if (isMobile) {
    return (
      <>
        <div className="relative min-h-screen w-full bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{
                rotate: 360,
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 20,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-200/30 to-purple-200/30 rounded-full blur-3xl"
            />
            <motion.div
              animate={{
                rotate: -360,
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 25,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-green-200/30 to-blue-200/30 rounded-full blur-3xl"
            />
          </div>

          {/* Mobile Header */}
          <div className="relative z-10 pt-8 pb-4 text-center">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-gray-800 mb-2"
            >
              DIGITAL CANVAS
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-gray-600"
            >
              Swipe through magazine sections
            </motion.p>
          </div>

          {/* Mobile Card Navigation Dots */}
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2">
            {magazineSections.map((_, index) => (
              <button
                key={index}
                onClick={() => goToMobileCard(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentMobileIndex ? "bg-gray-800 w-6" : "bg-gray-400"
                }`}
              />
            ))}
          </div>

          {/* Mobile Card Container */}
          <div className="relative h-[calc(100vh-200px)] flex items-center justify-center px-4">
            {/* Navigation Arrows */}
            <button
              onClick={prevMobileCard}
              className="absolute left-2 z-20 p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            </button>

            <button
              onClick={nextMobileCard}
              className="absolute right-2 z-20 p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-gray-700" />
            </button>

            {/* Card Carousel */}
            <div className="relative w-full max-w-sm">
              <motion.div
                key={currentMobileIndex}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -100, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full"
              >
                <DraggableCardContainer className="flex items-center justify-center">
                  <DraggableCardBody
                    className="relative w-full max-w-sm"
                    onClick={() => handleCardClick(magazineSections[currentMobileIndex])}
                  >
                    {/* Card Header */}
                    <div
                      className="absolute inset-0 rounded-md"
                      style={{
                        background: `linear-gradient(135deg, ${magazineSections[currentMobileIndex].bgColor} 0%, ${magazineSections[currentMobileIndex].bgColor}dd 100%)`,
                      }}
                    />

                    {/* Card Content */}
                    <div className="relative z-10 h-full flex flex-col">
                      {/* Category Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                          {magazineSections[currentMobileIndex].icon}
                          <span className="text-sm font-medium text-white">
                            {magazineSections[currentMobileIndex].category}
                          </span>
                        </div>
                      </div>

                      {/* Main Image */}
                      <div className="flex-1 mb-4 rounded-lg overflow-hidden">
                        <img
                          src={magazineSections[currentMobileIndex].image || "/placeholder.svg"}
                          alt={magazineSections[currentMobileIndex].title}
                          className="w-full h-48 object-cover"
                        />
                      </div>

                      {/* Text Content */}
                      <div className="space-y-3">
                        <h3 className="text-xl font-bold text-white leading-tight">
                          {magazineSections[currentMobileIndex].title}
                        </h3>
                        <p className="text-sm text-white/80 leading-relaxed">
                          {magazineSections[currentMobileIndex].subtitle}
                        </p>
                        <p className="text-xs text-white/70 line-clamp-3">
                          {magazineSections[currentMobileIndex].description}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <Users className="h-3 w-3" />
                          <span>{magazineSections[currentMobileIndex].author}</span>
                        </div>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium text-white"
                        >
                          Read More
                        </motion.div>
                      </div>
                    </div>
                  </DraggableCardBody>
                </DraggableCardContainer>
              </motion.div>
            </div>
          </div>

          {/* Mobile Instructions */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-gray-500 text-sm px-4">
            <p>Swipe or use arrows • Tap card to read full article</p>
          </div>

          {/* Mobile Card Counter */}
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-center">
            <span className="text-xs text-gray-400">
              {currentMobileIndex + 1} of {magazineSections.length}
            </span>
          </div>
        </div>

        {/* Modal */}
        <MagazineModal section={selectedSection} isOpen={isModalOpen} onClose={handleCloseModal} />
      </>
    )
  }

  // Desktop version
  return (
    <>
      <DraggableCardContainer className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Animated background shapes */}
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-200/30 to-purple-200/30 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              rotate: -360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 25,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-green-200/30 to-blue-200/30 rounded-full blur-3xl"
          />
        </div>

        {/* Central Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none"
        >
          <h1 className="text-4xl md:text-6xl font-black text-gray-800/20 mb-4">DIGITAL CANVAS</h1>
          <p className="text-lg md:text-xl text-gray-600/40 font-medium">
            Drag the cards • Click to explore • Experience the future
          </p>
        </motion.div>

        {/* Magazine Section Cards */}
        {magazineSections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: index * 0.2,
              type: "spring",
              stiffness: 100,
              damping: 15,
            }}
          >
            <DraggableCardBody className={section.className} onClick={() => handleCardClick(section)}>
              {/* Card Header */}
              <div
                className="absolute inset-0 rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${section.bgColor} 0%, ${section.bgColor}dd 100%)`,
                }}
              />

              {/* Card Content */}
              <div className="relative z-10 h-full flex flex-col">
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                    {section.icon}
                    <span className="text-sm font-medium text-white">{section.category}</span>
                  </div>
                </div>

                {/* Main Image */}
                <div className="flex-1 mb-4 rounded-lg overflow-hidden">
                  <img
                    src={section.image || "/placeholder.svg"}
                    alt={section.title}
                    className="w-full h-48 object-cover"
                  />
                </div>

                {/* Text Content */}
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-white leading-tight">{section.title}</h3>
                  <p className="text-sm text-white/80 leading-relaxed">{section.subtitle}</p>
                  <p className="text-xs text-white/70 line-clamp-2">{section.description}</p>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Users className="h-3 w-3" />
                    <span>{section.author}</span>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium text-white"
                  >
                    Read More
                  </motion.div>
                </div>
              </div>
            </DraggableCardBody>
          </motion.div>
        ))}

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-gray-500 text-sm"
        >
          <p>Drag cards around • Click to open detailed view • Explore interactive content</p>
        </motion.div>
      </DraggableCardContainer>

      {/* Modal */}
      <MagazineModal section={selectedSection} isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  )
}
