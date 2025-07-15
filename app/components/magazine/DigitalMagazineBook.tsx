"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DraggableCard } from "./DraggableCard"
import { MagazineModal } from "./MagazineModal"
import { getVolumeContent, type MagazineSection } from "./MagazineData"
import { useMobile } from "../../hooks/use-mobile"

interface DigitalMagazineBookProps {
  currentVolume: number
  onModalStateChange?: (isOpen: boolean) => void
}

export function DigitalMagazineBook({ currentVolume, onModalStateChange }: DigitalMagazineBookProps) {
  const [selectedSection, setSelectedSection] = useState<MagazineSection | null>(null)
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset mobile index when volume changes
  useEffect(() => {
    setCurrentMobileIndex(0)
  }, [currentVolume])

  // Notify parent component when modal state changes
  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(!!selectedSection)
    }
  }, [selectedSection, onModalStateChange])

  const magazineData = getVolumeContent(currentVolume)

  // Add some debugging to verify the correct volume is being loaded
  useEffect(() => {
    console.log("Current volume changed to:", currentVolume)
    console.log("Magazine data length:", magazineData.length)
    console.log("First section title:", magazineData[0]?.title)
  }, [currentVolume, magazineData])

  const handleCardClick = (section: MagazineSection) => {
    setSelectedSection(section)
  }

  const handleCloseModal = () => {
    setSelectedSection(null)
  }

  const nextCard = () => {
    setCurrentMobileIndex((prev) => (prev + 1) % magazineData.length)
  }

  const prevCard = () => {
    setCurrentMobileIndex((prev) => (prev - 1 + magazineData.length) % magazineData.length)
  }

  // Pre-defined positions to avoid Math.random() hydration issues
  const actionLinePositions = [
    { top: "10%", left: "20%", rotation: 45 },
    { top: "30%", left: "80%", rotation: 120 },
    { top: "50%", left: "15%", rotation: 200 },
    { top: "70%", left: "70%", rotation: 300 },
    { top: "20%", left: "60%", rotation: 15 },
    { top: "80%", left: "25%", rotation: 180 },
    { top: "40%", left: "85%", rotation: 90 },
    { top: "60%", left: "10%", rotation: 270 },
    { top: "90%", left: "50%", rotation: 135 },
    { top: "25%", left: "40%", rotation: 225 },
    { top: "75%", left: "75%", rotation: 315 },
    { top: "5%", left: "35%", rotation: 60 },
    { top: "85%", left: "85%", rotation: 150 },
    { top: "45%", left: "45%", rotation: 240 },
    { top: "65%", left: "20%", rotation: 330 },
  ]

  const starPositions = [
    { left: "20%", top: "30%" },
    { left: "60%", top: "20%" },
    { left: "80%", top: "60%" },
    { left: "30%", top: "80%" },
    { left: "70%", top: "40%" },
    { left: "40%", top: "70%" },
    { left: "90%", top: "30%" },
    { left: "10%", top: "60%" },
  ]

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-2xl font-black text-black">Loading...</div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 overflow-hidden">
        {/* Comic Book Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Action Lines */}
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            {actionLinePositions.slice(0, 15).map((pos, i: number) => (
              <div
                key={i}
                className="absolute bg-black"
                style={{
                  width: "1px",
                  height: "80px",
                  top: pos.top,
                  left: pos.left,
                  transform: `rotate(${pos.rotation}deg)`,
                }}
              />
            ))}
          </div>

          {/* Comic Dots Pattern */}
          <div className="absolute inset-0 opacity-3">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: "radial-gradient(circle, black 1px, transparent 1px)",
                backgroundSize: "25px 25px",
              }}
            />
          </div>
        </div>

        {/* Mobile Card Display */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
          {/* Card Container */}
          <div className="relative w-full max-w-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentVolume}-${currentMobileIndex}`}
                initial={{ opacity: 0, x: 100, rotate: 5 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -100, rotate: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full"
              >
                <DraggableCard
                  section={magazineData[currentMobileIndex]}
                  onCardClick={handleCardClick}
                  className="mx-auto"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center space-x-6 mt-8">
            <motion.button
              onClick={prevCard}
              className="bg-black text-white p-3 rounded-full border-4 border-black shadow-lg hover:bg-white hover:text-black transition-colors duration-300"
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="h-6 w-6" />
            </motion.button>
            <div className="flex space-x-2">
              {magazineData.map((_, index: number) => (
                <motion.button
                  key={index}
                  onClick={() => setCurrentMobileIndex(index)}
                  className={`w-3 h-3 rounded-full border-2 border-black transition-colors duration-300 ${
                    index === currentMobileIndex ? "bg-black" : "bg-white"
                  }`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
              ))}
            </div>
            <motion.button
              onClick={nextCard}
              className="bg-black text-white p-3 rounded-full border-4 border-black shadow-lg hover:bg-white hover:text-black transition-colors duration-300"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronRight className="h-6 w-6" />
            </motion.button>
          </div>

          {/* Card Counter */}
          <div className="mt-4 bg-white border-4 border-black px-4 py-2 transform -rotate-1 shadow-lg">
            <span className="text-sm font-black uppercase tracking-wider">
              {currentMobileIndex + 1} of {magazineData.length}
            </span>
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedSection && <MagazineModal section={selectedSection} onClose={handleCloseModal} />}
        </AnimatePresence>
      </div>
    )
  }

  // Desktop Layout
  return (
    <div ref={containerRef} className="relative w-full h-full bg-white overflow-hidden">
      {/* Comic Book Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Action Lines */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          {actionLinePositions.map((pos, i: number) => (
            <div
              key={i}
              className="absolute bg-black"
              style={{
                width: "2px",
                height: "120px",
                top: pos.top,
                left: pos.left,
                transform: `rotate(${pos.rotation}deg)`,
              }}
            />
          ))}
        </div>

        {/* Comic Dots Pattern */}
        <div className="absolute inset-0 opacity-3">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: "radial-gradient(circle, black 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Scattered Star Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {starPositions.map((star, i: number) => (
            <div
              key={`star-${i}`}
              className="absolute"
              style={{
                left: star.left,
                top: star.top,
                width: "6px",
                height: "6px",
                background: "black",
                clipPath:
                  "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                opacity: 0.2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Draggable Cards Container */}
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentVolume}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full"
          >
            {magazineData.map((section: MagazineSection, index: number) => (
              <DraggableCard
                key={`${currentVolume}-${section.id}`}
                section={section}
                onCardClick={handleCardClick}
                className={getCardPosition(index, magazineData.length)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedSection && <MagazineModal section={selectedSection} onClose={handleCloseModal} />}
      </AnimatePresence>
    </div>
  )
}

// Helper function to get card positions for desktop - updated for better spacing with 3-4 cards
function getCardPosition(index: number, totalCards: number): string {
  // Different positioning strategies based on number of cards
  if (totalCards === 1) {
    return "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-2 hover:rotate-5 transition-transform duration-300"
  }

  if (totalCards === 2) {
    const positions = [
      "absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 rotate-3 hover:rotate-6 transition-transform duration-300",
      "absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 -rotate-3 hover:-rotate-6 transition-transform duration-300",
    ]
    return positions[index]
  }

  if (totalCards === 3) {
    const positions = [
      "absolute top-1/3 left-1/4 transform -translate-x-1/2 -translate-y-1/2 rotate-3 hover:rotate-6 transition-transform duration-300",
      "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-1 hover:rotate-4 transition-transform duration-300",
      "absolute bottom-1/3 right-1/4 transform translate-x-1/2 translate-y-1/2 -rotate-2 hover:-rotate-5 transition-transform duration-300",
    ]
    return positions[index]
  }

  // For 4 cards - arranged in corners with better spacing
  const positions = [
    "absolute top-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2 rotate-3 hover:rotate-6 transition-transform duration-300",
    "absolute top-1/4 right-1/4 transform translate-x-1/2 -translate-y-1/2 -rotate-2 hover:-rotate-5 transition-transform duration-300",
    "absolute bottom-1/4 left-1/4 transform -translate-x-1/2 translate-y-1/2 rotate-1 hover:rotate-4 transition-transform duration-300",
    "absolute bottom-1/4 right-1/4 transform translate-x-1/2 translate-y-1/2 -rotate-3 hover:-rotate-6 transition-transform duration-300",
  ]

  return positions[index % positions.length]
}
