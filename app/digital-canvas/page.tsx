"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { Environment } from "@react-three/drei"
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
      title: "ORIGIN STORY",
      subtitle: "Volume 001",
      description: "The beginning of Digital Canvas",
      isActive: currentVolume === 0,
    },
    {
      id: "vol2",
      title: "HERO'S JOURNEY",
      subtitle: "Volume 002",
      description: "Our mission and quest",
      isActive: currentVolume === 1,
    },
    {
      id: "vol3",
      title: "FINAL BATTLE",
      subtitle: "Volume 003",
      description: "The digital revolution",
      isActive: currentVolume === 2,
    },
  ]

  return (
    <div className="bg-white">
      {/* Hero Section - Fixed to allow proper scrolling and height */}
      <div className="w-full overflow-y-auto">
        <div className="relative w-full min-h-screen">
          <MagazineHero onEnterCanvas={scrollToMagazine} />
        </div>
      </div>

      {/* Magazine Section - Increased height to accommodate sidebar */}
      <div ref={magazineRef} className="relative min-h-[120vh] bg-white overflow-hidden">
        {/* Comic Book Style Background Pattern */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-white">
            {/* Enhanced Halftone Pattern */}
            <div
              className="absolute inset-0 opacity-8"
              style={{
                backgroundImage: `radial-gradient(circle, black 1px, transparent 1px)`,
                backgroundSize: "25px 25px",
                backgroundPosition: "0 0, 12.5px 12.5px",
              }}
            />

            {/* Comic Book Grid Lines */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: `
                  linear-gradient(black 1px, transparent 1px),
                  linear-gradient(90deg, black 1px, transparent 1px)
                `,
                backgroundSize: "50px 50px",
              }}
            />

            {/* Speed lines for dynamic effect */}
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bg-black opacity-5"
                  style={{
                    width: "2px",
                    height: "100vh",
                    left: `${10 + i * 12}%`,
                    top: "0%",
                    transformOrigin: "center bottom",
                    transform: `rotate(${i * 15 - 60}deg)`,
                    animation: `speed-line ${3 + i * 0.2}s linear infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Left Sidebar Navigation - Comic Book Style - Fixed z-index to be below navbar */}
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

            {/* Instructions Panel - Reduced padding and font sizes */}
            <div className="bg-gray-100 border-4 border-black p-3 transform rotate-1 shadow-lg">
              <h4 className="text-sm font-black uppercase tracking-wide mb-2 text-black">HOW TO READ</h4>
              <div className="space-y-1 text-xs text-black font-bold">
                <div>• Scroll to open book</div>
                <div>• Click & drag to turn pages</div>
                <div>• Select volumes on left</div>
                <div>• Experience in 3D</div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Volume Selector */}
        {isMobile && (
          <div className="absolute top-20 left-2 right-2 z-30">
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
                    p-3 min-w-[120px] text-center
                  `}
                >
                  <div className="text-xs font-black uppercase">{volume.subtitle}</div>
                  <div className="text-sm font-black uppercase mt-1">{volume.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3D Canvas - Positioned to the right of sidebar with better camera positioning */}
        <div className={`absolute inset-0 z-20 pointer-events-auto ${!isMobile ? "left-72" : ""}`}>
          <Canvas
            camera={{
              position: isMobile ? [0, 0, 6] : [0, 0, 7],
              fov: isMobile ? 60 : 45,
              near: 0.1,
              far: 100,
            }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            style={{
              background: "transparent",
              width: "100%",
              height: "100%",
            }}
            dpr={isMobile ? [1, 2] : [1, 2]}
          >
            <Suspense fallback={null}>
              {/* Enhanced Lighting for comic book effect */}
              <ambientLight intensity={isMobile ? 2.5 : 2.2} />
              <directionalLight
                position={[5, 5, 5]}
                intensity={isMobile ? 3.5 : 3.2}
                castShadow={!isMobile}
                shadow-mapSize-width={isMobile ? 512 : 1024}
                shadow-mapSize-height={isMobile ? 512 : 1024}
              />
              {/* High contrast lighting for comic book effect */}
              <directionalLight position={[-5, 2, 3]} intensity={2} color="#ffffff" />
              <pointLight position={[0, 0, 10]} intensity={isMobile ? 2 : 1.8} color="#ffffff" />

              {/* 3D Magazine Book */}
              <DigitalMagazineBook />

              {/* Environment for reflections */}
              <Environment preset="studio" />
            </Suspense>
          </Canvas>
        </div>

        {/* Comic Book Style Border Frame - Adjusted for new height */}
        <div
          className={`absolute z-10 pointer-events-none border-4 border-black ${
            isMobile ? "top-32 left-2 right-2" : "top-16 left-2 right-2"
          }`}
          style={{
            borderStyle: "solid",
            borderImage: "repeating-linear-gradient(45deg, black 0, black 10px, white 10px, white 20px) 4",
            height: isMobile ? "calc(100vh - 100px)" : "calc(120vh - 64px)",
          }}
        />

        {/* CSS for comic book animations */}
        <style jsx>{`
          @keyframes speed-line {
            0% { 
              opacity: 0; 
              transform: rotate(var(--rotation, 0deg)) scaleY(0);
            }
            50% { 
              opacity: 0.1; 
              transform: rotate(var(--rotation, 0deg)) scaleY(1);
            }
            100% { 
              opacity: 0; 
              transform: rotate(var(--rotation, 0deg)) scaleY(0);
            }
          }

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
