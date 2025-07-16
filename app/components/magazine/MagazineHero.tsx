"use client"

import { useEffect, useState, useCallback } from "react"
import { useMobile } from "../../hooks/use-mobile"

interface MagazineHeroProps {
  onEnterCanvas?: () => void
}

export function MagazineHero({ onEnterCanvas }: MagazineHeroProps) {
  const [mounted, setMounted] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleEnterCanvas = useCallback(() => {
    onEnterCanvas?.()
  }, [onEnterCanvas])

  if (!mounted) {
    return (
      <div className="w-full h-full">
        <div className="absolute inset-0 bg-white">
          <div
            className="absolute inset-0 opacity-8"
            style={{
              backgroundImage: `radial-gradient(circle, black 2px, transparent 2px)`,
              backgroundSize: "30px 30px",
            }}
          />
        </div>
        <div className="relative z-10 w-full px-8 py-20">
          <div className="grid grid-cols-12 gap-6 w-full">
            <div className="col-span-8 relative">
              <div className="relative bg-white border-4 border-black p-6 shadow-2xl transform -rotate-1">
                <div className="absolute -bottom-4 left-8 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-black"></div>
                <div className="absolute -bottom-3 left-9 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-white"></div>
                <div className="space-y-6">
                  {/* In the loading state section, replace the h1 with: */}
                  <div className="relative">
                    <div className="relative z-10">
                      <img
                        src="/images/digital-canvas-dark.svg"
                        alt="Digital Canvas"
                        className={`${isMobile ? "w-64 h-auto" : "w-96 h-auto"} mx-auto`}
                        style={{
                          filter: "drop-shadow(4px 4px 0px white) drop-shadow(8px 8px 0px black)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Pre-defined positions to avoid Math.random() hydration issues
  const speedLinePositions = [
    { left: "30%", rotation: -30 },
    { left: "30%", rotation: 0 },
    { left: "30%", rotation: 30 },
    { left: "70%", rotation: 30 },
    { left: "70%", rotation: 60 },
    { left: "70%", rotation: 90 },
  ]

  const starPositions = [
    { left: "30%", top: "40%" },
    { left: "50%", top: "50%" },
    { left: "70%", top: "60%" },
  ]

  return (
    <div className="w-full h-full">
      {/* Simplified Background Effects */}
      <div className="absolute inset-0 bg-white">
        {/* Static Halftone Pattern - No animation */}
        <div
          className="absolute inset-0 opacity-8"
          style={{
            backgroundImage: `radial-gradient(circle, black 2px, transparent 2px)`,
            backgroundSize: "30px 30px",
          }}
        />

        {/* Simplified Speed Lines - Reduced count */}
        <div className="absolute inset-0 overflow-hidden">
          {speedLinePositions.map((line, i) => (
            <div
              key={i}
              className="absolute bg-black opacity-10"
              style={{
                width: "2px",
                height: "60vh",
                left: line.left,
                top: "20%",
                transformOrigin: "center bottom",
                transform: `rotate(${line.rotation}deg) translateX(-50%)`,
              }}
            />
          ))}
        </div>

        {/* Static Star Elements - No animation */}
        <div className="absolute inset-0 overflow-hidden">
          {starPositions.map((star, i) => (
            <div
              key={`star-${i}`}
              className="absolute"
              style={{
                left: star.left,
                top: star.top,
                width: "4px",
                height: "4px",
                background: "black",
                clipPath:
                  "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                opacity: 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Hero Content */}
      <div className={`relative z-10 w-full ${isMobile ? "px-4 py-24" : "px-8 py-20"}`}>
        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-12"} gap-6 w-full`}>
          {/* Main Content Panel */}
          <div className={`${isMobile ? "col-span-1" : "col-span-8"} relative`}>
            <div className="relative bg-white border-4 border-black p-6 shadow-2xl transform -rotate-1"
            /* style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONGREEN.png')`,
            backgroundSize: "60px 60px",
            backgroundRepeat: "repeat",
            backgroundPosition: "0 0",
            animation: "float 25s ease-in-out infinite",
            filter: "brightness(1.2) contrast(1.1)",
          }} */
            >
              {/* Speech Bubble Tails */}
              <div className="absolute -bottom-4 left-8 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-black"></div>
              <div className="absolute -bottom-3 left-9 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-white"></div>

              <div className={`space-y-${isMobile ? "3" : "6"}`}>
                {/* Title - Replace with Logo */}
                <div className="relative">
                  <div className="relative z-10">
                    <img
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-dark.svg"
                      alt="Digital Canvas"
                      className={`${isMobile ? "w-64 h-auto" : "w-96 h-auto"} mx-auto`}
                      style={{
                        filter: "drop-shadow(4px 4px 0px white) drop-shadow(8px 8px 0px black)",
                      }}
                    />
                  </div>
                </div>

                {/* Subtitle */}
                <div className="relative bg-black text-white p-3 transform rotate-1 mt-6 md:mt-0">
                  <p
                    className={`${isMobile ? "text-base" : "text-2xl"} font-bold uppercase tracking-wide text-center`}
                    style={{ fontFamily: "Arial Black, sans-serif" }}
                  >
                    The Creative Layer of{" "}
                    {isMobile ? (
                      <>
                        <br />
                        <span className="bg-white text-black px-2 py-1 font-menda-black">434 MEDIA</span>
                      </>
                    ) : (
                      <span className="bg-white text-black px-2 py-1 font-menda-black">434 MEDIA</span>
                    )}
                  </p>
                </div>

                {/* Description */}
                <div className="relative bg-gray-100 border-4 border-black p-3 rounded-lg">
                  <p
                    className={`${isMobile ? "text-xs" : "text-lg"} text-black leading-relaxed font-semibold`}
                    style={{ fontFamily: "Arial, sans-serif" }}
                  >
                    {isMobile
                      ? "We connect IP & client work, showcasing stories, brands, and campaigns that define the Digital Canvas network."
                      : "We connect our IP & client work, showcasing the stories, brands, and campaigns shaping the Digital Canvas network."}
                  </p>

                  {/* Static thought bubbles */}
                  <div className="absolute -right-3 -top-3 flex space-x-1">
                    <div className="w-2 h-2 bg-black rounded-full"></div>
                    <div className="w-3 h-3 bg-black rounded-full"></div>
                    <div className="w-4 h-4 bg-black rounded-full"></div>
                  </div>
                </div>

                {/* Features Grid */}
                <div className={`grid ${isMobile ? "grid-cols-1 gap-2" : "grid-cols-2 gap-4"} text-black`}>
                  {[
                    { icon: "📝", text: "Founder's Note", color: "bg-purple-400" },
                    { icon: "🎬", text: "Month in Motion", color: "bg-blue-400" },
                    { icon: "📚", text: "Interactive Stories", color: "bg-green-400" },
                    { icon: "💧", text: "The Drop", color: "bg-red-400" },
                  ].map((feature, index) => (
                    <div
                      key={index}
                      className={`flex items-center space-x-2 ${feature.color} text-black ${isMobile ? "p-2" : "p-3"} border-2 border-black shadow-lg`}
                      style={{
                        transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)`,
                      }}
                    >
                      <div className={`${isMobile ? "text-base" : "text-xl"}`}>{feature.icon}</div>
                      <span
                        className={`${isMobile ? "text-xs" : "text-base"} font-black uppercase tracking-wide`}
                        style={{ fontFamily: "Arial Black, sans-serif" }}
                      >
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Panels - Desktop Only */}
          {!isMobile && (
            <div className="col-span-4 space-y-4">
              {/* Volume Info Panel */}
              <div className="bg-white border-4 border-black p-4 transform rotate-2 shadow-xl">
                <div className="space-y-3 text-center">
                  <div className="text-black">
                    <div className="text-sm uppercase tracking-widest font-black mb-2 bg-black text-white px-3 py-2">
                      VOLUME #001
                    </div>
                    <div className="text-4xl font-black" style={{ fontFamily: "Impact, Arial Black, sans-serif" }}>
                      2025
                    </div>
                  </div>
                  <div className="w-full h-2 bg-black"></div>
                  <div className="text-sm uppercase font-bold tracking-wide">
                    RGV STARTUP WEEK
                    <br />
                    <span className="text-xl font-black">PROXIMITY MATTERS</span>
                  </div>
                </div>
              </div>

              {/* Volume 002 Preview Panel */}
              <div className="bg-gradient-to-br from-red-500 to-orange-500 text-white border-4 border-black p-4 transform -rotate-1 shadow-xl">
                <div className="space-y-2">
                  <h3 className="text-lg font-black uppercase tracking-wide border-b-2 border-white pb-2">
                    COMING NEXT
                  </h3>
                  <div className="text-center">
                    <div className="text-sm uppercase tracking-widest font-black mb-2 bg-white text-black px-3 py-2">
                      VOLUME #002
                    </div>
                    <div className="text-lg font-black uppercase tracking-wide">ON THE ROAD TO</div>
                    <div
                      className="text-2xl font-black uppercase tracking-wider"
                      style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
                    >
                      FIGHT NIGHT
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Panel */}
              <div className="bg-gradient-to-br from-yellow-300 to-red-300 border-4 border-black p-4 transform rotate-1 shadow-xl">
                <div className="text-center">
                  <h3 className="text-lg font-black uppercase tracking-wide text-black mb-2">NETWORK</h3>
                  <div className="text-sm font-bold text-black">
                    Stories • Brands • Campaigns
                    <br />
                    <span className="text-xs">Shaping Digital Canvas</span>
                  </div>
                </div>
              </div>

              {/* Call to Action */}
              <div className="text-center pt-2">
                <button
                  onClick={handleEnterCanvas}
                  className="bg-black text-white px-8 py-4 text-xl font-black uppercase tracking-wider border-4 border-black shadow-xl w-full hover:bg-white hover:text-black transition-colors duration-300"
                  style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
                >
                  ENTER THE CANVAS
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Call to Action */}
        {isMobile && (
          <div className="mt-8 text-center">
            <button
              onClick={handleEnterCanvas}
              className="bg-black text-white px-6 py-3 text-base font-black uppercase tracking-wider border-4 border-black shadow-xl hover:bg-white hover:text-black transition-colors duration-300"
              style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
            >
              ENTER THE CANVAS
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
