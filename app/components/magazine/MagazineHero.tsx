"use client"

import { useEffect, useState } from "react"
import { ScrambleText } from "../ScrambleText"
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

  if (!mounted) return null

  return (
    <div className="w-full h-full">
      {/* Comic Book Background Effects */}
      <div className="absolute inset-0 bg-white">
        {/* Dynamic Halftone Pattern */}
        <div
          className="absolute inset-0 opacity-8"
          style={{
            backgroundImage: `radial-gradient(circle, black 2px, transparent 2px)`,
            backgroundSize: "30px 30px",
            animation: "halftone-pulse 4s ease-in-out infinite",
          }}
        />

        {/* Comic Book Action Lines - More dramatic */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Speed lines radiating from multiple points */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute bg-black opacity-15"
              style={{
                width: "2px",
                height: "80vh",
                left: i < 6 ? "30%" : "70%",
                top: "10%",
                transformOrigin: "center bottom",
                transform: `rotate(${i * 30 + (i < 6 ? -45 : 45)}deg) translateX(-50%)`,
                animation: `speed-line ${2 + i * 0.1}s linear infinite`,
              }}
            />
          ))}
        </div>

        {/* Comic Book Explosion Effects */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Starburst patterns */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`star-${i}`}
              className="absolute"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`,
                width: "4px",
                height: "4px",
                background: "black",
                clipPath:
                  "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                animation: `star-twinkle ${3 + i * 0.5}s ease-in-out infinite`,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Full Width Hero Layout - Fixed height and scrolling issues */}
      <div className={`relative z-10 w-full ${isMobile ? "px-4 py-24" : "px-8 py-20"}`}>
        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-12"} gap-6 w-full`}>
          {/* Main Content Panel - Takes up most space */}
          <div className={`${isMobile ? "col-span-1" : "col-span-8"} relative`}>
            {/* Primary Comic Book Panel */}
            <div className="relative bg-white border-4 border-black p-6 shadow-2xl transform -rotate-1">
              {/* Multiple Speech Bubble Tails for dynamic effect */}
              <div className="absolute -bottom-4 left-8 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-black"></div>
              <div className="absolute -bottom-3 left-9 w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-white"></div>

              {/* Secondary bubble tail */}
              <div className="absolute -right-3 top-12 w-0 h-0 border-l-6 border-t-6 border-b-6 border-l-black border-t-transparent border-b-transparent"></div>
              <div className="absolute -right-2 top-13 w-0 h-0 border-l-4 border-t-4 border-b-4 border-l-white border-t-transparent border-b-transparent"></div>

              <div className={`space-y-${isMobile ? "3" : "6"}`}>
                {/* Explosive Title with Comic Book Effects */}
                <div className="relative">
                  <h1
                    className={`${
                      isMobile ? "text-3xl leading-tight" : "text-7xl md:text-8xl leading-tight"
                    } font-black text-black uppercase tracking-wider relative z-10`}
                    style={{
                      fontFamily: "Impact, Arial Black, sans-serif",
                      textShadow: "4px 4px 0px white, 8px 8px 0px black",
                      WebkitTextStroke: "2px black",
                    }}
                  >
                    <ScrambleText text="DIGITAL" className="block" />
                    <ScrambleText text="CANVAS" className={`block ${isMobile ? "text-2xl" : "text-6xl md:text-7xl"}`} />
                  </h1>

                  {/* Comic Book "POW!" effect */}
                  <div
                    className={`absolute ${isMobile ? "-top-1 -right-1" : "-top-4 -right-8"} bg-yellow-300 border-4 border-black px-2 py-1 transform rotate-12 shadow-lg`}
                    style={{
                      fontFamily: "Impact, Arial Black, sans-serif",
                      animation: "pow-pulse 2s ease-in-out infinite",
                    }}
                  >
                    <span className={`${isMobile ? "text-xs" : "text-sm"} font-black`}>Learn2AI</span>
                  </div>
                </div>

                {/* Enhanced Subtitle with Action Lines - Modified for mobile block layout */}
                <div className="relative bg-black text-white p-3 transform rotate-1">
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

                  {/* Action lines around subtitle */}
                  <div className="absolute -inset-2 border-2 border-black opacity-50 transform -rotate-1"></div>
                  <div className="absolute -inset-1 border-2 border-black opacity-30 transform rotate-1"></div>
                </div>

                {/* Description in Comic Speech Bubble Style */}
                <div className="relative bg-gray-100 border-4 border-black p-3 rounded-lg">
                  <p
                    className={`${isMobile ? "text-xs" : "text-lg"} text-black leading-relaxed font-semibold`}
                    style={{ fontFamily: "Arial, sans-serif" }}
                  >
                    {isMobile
                      ? "We connect IP & client work, showcasing stories, brands, and campaigns that define the Digital Canvas network."
                      : "We connect our IP & client work, showcasing the stories, brands, and campaigns shaping the Digital Canvas network."}
                  </p>

                  {/* Enhanced thought bubble chain */}
                  <div className="absolute -right-3 -top-3 flex space-x-1">
                    <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                    <div
                      className="w-3 h-3 bg-black rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-4 h-4 bg-black rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>

                {/* Enhanced Features Grid with Comic Styling - Compact for mobile */}
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
              {/* Issue Info Panel */}
              <div className="bg-white border-4 border-black p-4 transform rotate-2 shadow-xl">
                <div className="space-y-3 text-center">
                  <div className="text-black">
                    <div className="text-sm uppercase tracking-widest font-black mb-2 bg-black text-white px-3 py-2">
                      ISSUE #001
                    </div>
                    <div className="text-4xl font-black" style={{ fontFamily: "Impact, Arial Black, sans-serif" }}>
                      2025
                    </div>
                  </div>

                  <div className="w-full h-2 bg-black"></div>

                  <div className="text-sm uppercase font-bold tracking-wide">
                    POWERED BY
                    <br />
                    <span className="text-xl font-black">WEBGL + GSAP</span>
                  </div>
                </div>
              </div>

              {/* Tech Specs Panel */}
              <div className="bg-black text-white border-4 border-black p-4 transform -rotate-1 shadow-xl">
                <div className="space-y-2">
                  <h3 className="text-lg font-black uppercase tracking-wide border-b-2 border-white pb-2">
                    TECH SPECS
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div>• React Three Fiber</div>
                    <div>• GSAP Animations</div>
                    <div>• WebGL Shaders</div>
                    <div>• Interactive 3D</div>
                    <div>• Responsive Design</div>
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

              {/* Enhanced Call to Action - Desktop Only with hover animation */}
              <div className="text-center pt-2">
                <button
                  onClick={onEnterCanvas}
                  className="bg-black text-white px-8 py-4 text-xl font-black uppercase tracking-wider border-4 border-black shadow-xl w-full hover:bg-white hover:text-black transition-colors duration-300"
                  style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
                >
                  ENTER THE CANVAS
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Call to Action - Mobile Only - Positioned at bottom with proper spacing */}
        {isMobile && (
          <div className="mt-8 text-center">
            <button
              onClick={onEnterCanvas}
              className="bg-black text-white px-6 py-3 text-base font-black uppercase tracking-wider border-4 border-black shadow-xl hover:bg-white hover:text-black transition-colors duration-300"
              style={{ fontFamily: "Impact, Arial Black, sans-serif" }}
            >
              ENTER THE CANVAS
            </button>
          </div>
        )}
      </div>

      {/* CSS for enhanced comic book animations */}
      <style jsx>{`
        @keyframes halftone-pulse {
          0%, 100% { 
            opacity: 0.08; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.15; 
            transform: scale(1.02);
          }
        }
        
        @keyframes speed-line {
          0% { 
            opacity: 0; 
            transform: rotate(var(--rotation, 0deg)) translateX(-50%) scaleY(0);
          }
          50% { 
            opacity: 0.2; 
            transform: rotate(var(--rotation, 0deg)) translateX(-50%) scaleY(1);
          }
          100% { 
            opacity: 0; 
            transform: rotate(var(--rotation, 0deg)) translateX(-50%) scaleY(0);
          }
        }

        @keyframes pow-pulse {
          0%, 100% { 
            transform: rotate(12deg) scale(1);
          }
          50% { 
            transform: rotate(15deg) scale(1.1);
          }
        }

        @keyframes star-twinkle {
          0%, 100% { 
            opacity: 0.3; 
            transform: scale(1) rotate(0deg);
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.2) rotate(180deg);
          }
        }
      `}</style>
    </div>
  )
}
