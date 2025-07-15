"use client"

import { useState, useEffect, useRef } from "react"
import { DigitalMagazineBook } from "../components/magazine/DigitalMagazineBook"
import { MagazineHero } from "../components/magazine/MagazineHero"
import { LoadingSpinner } from "../components/magazine/LoadingSpinner"
import { useMobile } from "../hooks/use-mobile"

interface VolumeNavItem {
  id: string
  title: string
  subtitle: string
  description: string
  isActive: boolean
}

export default function DigitalCanvasPage() {
  const [mounted, setMounted] = useState(false)
  const [currentVolume, setCurrentVolume] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const magazineRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Function to scroll to magazine section
  const scrollToMagazine = () => {
    if (magazineRef.current) {
      magazineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }

  if (!mounted) {
    return <LoadingSpinner />
  }

  // Volume navigation data
  const volumes: VolumeNavItem[] = [
    {
      id: "vol1",
      title: "Road to RGVSW",
      subtitle: "Volume 001",
      description: "Welcome to RGV Startup Week",
      isActive: currentVolume === 0,
    },
    {
      id: "vol2",
      title: "TXMX Boxing",
      subtitle: "Volume 002",
      description: "On the road to Fight Night",
      isActive: currentVolume === 1,
    },
    {
      id: "vol3",
      title: "Coming Soon",
      subtitle: "Volume 003",
      description: "August 2025",
      isActive: currentVolume === 2,
    },
  ]

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="w-full overflow-y-auto">
        <div className="relative w-full min-h-screen">
          <MagazineHero onEnterCanvas={scrollToMagazine} />
        </div>
      </div>

      {/* Magazine Section */}
      <div
        ref={magazineRef}
        className="relative bg-white overflow-hidden"
        style={{ minHeight: isMobile ? "100vh" : "100vh" }}
      >
        {/* Left Sidebar Navigation - Desktop Only */}
        {!isMobile && (
          <div className="absolute left-4 top-4 z-30 space-y-3 w-64 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Navigation Header */}
            <div className="bg-black text-white border-4 border-black p-3 transform -rotate-1 shadow-xl">
              <h2
                className="text-lg font-black uppercase tracking-wider text-center"
                style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
              >
                VOLUMES
              </h2>
              <div className="w-full h-1 bg-white mt-2"></div>
              <p className="text-xs text-center mt-2 font-bold">SELECT YOUR ADVENTURE</p>
            </div>

            {/* Volume Navigation Boxes */}
            {volumes.map((volume, index) => (
              <div
                key={volume.id}
                onClick={() => setCurrentVolume(index)}
                className={`
                  relative cursor-pointer transition-all duration-300 transform hover:scale-105
                  ${
                    volume.isActive
                      ? "bg-black text-white border-4 border-black shadow-2xl rotate-0"
                      : "bg-white text-black border-4 border-black shadow-lg hover:shadow-xl"
                  }
                  ${index % 2 === 0 ? "rotate-1" : "-rotate-1"}
                  p-3
                `}
                style={{
                  animation: volume.isActive ? "active-pulse 2s ease-in-out infinite" : "none",
                }}
              >
                {/* Comic book style corner accent */}
                <div
                  className={`absolute top-0 right-0 w-0 h-0 border-l-6 border-b-6 ${
                    volume.isActive ? "border-l-white border-b-white" : "border-l-black border-b-black"
                  }`}
                ></div>

                {/* Volume number badge */}
                <div
                  className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-wider mb-2 ${
                    volume.isActive ? "bg-white text-black" : "bg-black text-white"
                  }`}
                >
                  {volume.subtitle}
                </div>

                {/* Title */}
                <h3
                  className={`text-base font-black uppercase tracking-wide mb-2 ${
                    volume.isActive ? "text-white" : "text-black"
                  }`}
                  style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
                >
                  {volume.title}
                </h3>

                {/* Description */}
                <p className={`text-sm font-bold ${volume.isActive ? "text-gray-300" : "text-gray-600"}`}>
                  {volume.description}
                </p>

                {/* Active indicator */}
                {volume.isActive && (
                  <div className="absolute -right-2 top-1/2 transform -translate-y-1/2">
                    <div className="w-0 h-0 border-l-6 border-t-3 border-b-3 border-l-white border-t-transparent border-b-transparent"></div>
                  </div>
                )}

                {/* Comic book style action lines */}
                {volume.isActive && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute bg-white opacity-20"
                        style={{
                          width: "1px",
                          height: "100%",
                          left: `${20 + i * 30}%`,
                          top: "0%",
                          transform: `rotate(${i * 20 - 10}deg)`,
                          animation: `action-line ${1 + i * 0.3}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Instructions Panel */}
            <div className="bg-gray-100 border-4 border-black p-3 transform rotate-1 shadow-lg">
              <h4 className="text-sm font-black uppercase tracking-wide mb-2 text-black">HOW TO READ</h4>
              <div className="space-y-1 text-xs text-black font-bold">
                <div>• Drag cards around</div>
                <div>• Click to open details</div>
                <div>• Explore interactive content</div>
                <div>• Select volumes on left</div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Volume Selector - Hidden when modal is open */}
        {isMobile && (
          <div
            className={`absolute top-4 left-2 right-2 transition-opacity duration-300 ${
              isModalOpen ? "opacity-0 pointer-events-none" : "opacity-100 z-30"
            }`}
          >
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {volumes.map((volume, index) => (
                <div
                  key={volume.id}
                  onClick={() => setCurrentVolume(index)}
                  className={`
                    flex-shrink-0 cursor-pointer transition-all duration-300
                    ${
                      volume.isActive
                        ? "bg-black text-white border-2 border-black"
                        : "bg-white text-black border-2 border-black"
                    }
                    p-3 min-w-[120px] text-center shadow-lg
                  `}
                >
                  <div className="text-xs font-black uppercase">{volume.subtitle}</div>
                  <div className="text-sm font-black uppercase mt-1">{volume.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Magazine Cards Container */}
        <div
          className={`absolute inset-0 z-20 ${!isMobile ? "left-72" : "top-20"}`}
          style={{
            height: isMobile ? "calc(100vh - 5rem)" : "100vh",
          }}
        >
          <DigitalMagazineBook currentVolume={currentVolume} onModalStateChange={setIsModalOpen} />
        </div>

        {/* CSS for comic book animations */}
        <style jsx>{`
          @keyframes active-pulse {
            0%, 100% { 
              transform: rotate(0deg) scale(1);
              box-shadow: 0 10px 20px rgba(0,0,0,0.3);
            }
            50% { 
              transform: rotate(0deg) scale(1.02);
              box-shadow: 0 15px 30px rgba(0,0,0,0.4);
            }
          }

          @keyframes action-line {
            0%, 100% { 
              opacity: 0.2; 
              transform: rotate(var(--rotation, 0deg)) scaleY(1);
            }
            50% { 
              opacity: 0.4; 
              transform: rotate(var(--rotation, 0deg)) scaleY(1.2);
            }
          }

          /* Custom scrollbar for sidebar */
          .absolute.left-4::-webkit-scrollbar {
            width: 4px;
          }
          
          .absolute.left-4::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.1);
            border-radius: 2px;
          }
          
          .absolute.left-4::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.3);
            border-radius: 2px;
          }
          
          .absolute.left-4::-webkit-scrollbar-thumb:hover {
            background: rgba(0,0,0,0.5);
          }
        `}</style>
      </div>
    </div>
  )
}
