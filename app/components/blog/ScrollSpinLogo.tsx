"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export default function ScrollSpinLogo() {
  const [rotation, setRotation] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const scrollProgress = Math.min(scrollY / maxScroll, 1)

      // Create a smooth rotation that accelerates as you scroll
      const newRotation = scrollProgress * 1080 + scrollY * 0.3 // 3 full rotations + continuous spin
      setRotation(newRotation)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="relative group">
      {/* Outer cosmic glow ring */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 blur-2xl opacity-70 group-hover:opacity-90 transition-all duration-700 animate-pulse"
        style={{
          transform: `scale(${isHovered ? 1.4 : 1.2})`,
          background: `conic-gradient(from ${rotation * 0.5}deg, #8b5cf6, #3b82f6, #6366f1, #8b5cf6)`,
        }}
      />

      {/* Middle energy ring */}
      <div
        className="absolute inset-1 rounded-full bg-gradient-to-r from-white/30 to-white/10 backdrop-blur-sm border-2 border-white/40 shadow-2xl"
        style={{
          transform: `rotate(${-rotation * 0.3}deg)`,
          boxShadow: `0 0 40px rgba(139, 92, 246, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.2)`,
        }}
      />

      {/* Inner ring with dynamic gradient */}
      <div
        className="absolute inset-3 rounded-full border border-white/50 shadow-inner"
        style={{
          background: `conic-gradient(from ${rotation * 0.2}deg, rgba(255,255,255,0.1), rgba(139,92,246,0.2), rgba(59,130,246,0.2), rgba(255,255,255,0.1))`,
          transform: `rotate(${rotation * 0.1}deg)`,
        }}
      />

      {/* Main logo container */}
      <div
        className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-md border border-white/30 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:bg-white/25 cursor-pointer shadow-2xl"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: rotation === 0 ? "transform 0.1s ease-out" : "none",
          boxShadow: `0 0 60px rgba(139, 92, 246, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.1)`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Large 434 Logo - fills most of the circle */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40">
          <Image
            src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
            alt="434 Media Logo"
            fill
            className="object-contain filter drop-shadow-2xl"
            style={{
              filter: `drop-shadow(0 0 20px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 40px rgba(139, 92, 246, 0.6))`,
              transform: `scale(${isHovered ? 1.1 : 1})`,
              transition: "all 0.3s ease-out",
            }}
            priority
          />
        </div>

        {/* Dynamic sparkle effects */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div
            className="absolute top-3 left-3 w-3 h-3 bg-white rounded-full animate-ping opacity-80"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="absolute bottom-4 right-4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute top-6 right-3 w-2.5 h-2.5 bg-blue-300 rounded-full animate-pulse"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute bottom-8 left-6 w-1.5 h-1.5 bg-purple-300 rounded-full animate-ping"
            style={{ animationDelay: "1.5s" }}
          />
          <div
            className="absolute top-1/2 left-2 w-1 h-1 bg-indigo-300 rounded-full animate-bounce"
            style={{ animationDelay: "0.3s" }}
          />
          <div
            className="absolute top-1/2 right-2 w-1 h-1 bg-pink-300 rounded-full animate-bounce"
            style={{ animationDelay: "0.8s" }}
          />
        </div>

        {/* Rotating energy lines */}
        <div className="absolute inset-0 rounded-full" style={{ transform: `rotate(${rotation * 2}deg)` }}>
          <div className="absolute top-0 left-1/2 w-0.5 h-6 bg-gradient-to-b from-white/60 to-transparent transform -translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-0.5 h-6 bg-gradient-to-t from-white/60 to-transparent transform -translate-x-1/2" />
          <div className="absolute left-0 top-1/2 h-0.5 w-6 bg-gradient-to-r from-white/60 to-transparent transform -translate-y-1/2" />
          <div className="absolute right-0 top-1/2 h-0.5 w-6 bg-gradient-to-l from-white/60 to-transparent transform -translate-y-1/2" />
        </div>
      </div>

      {/* Enhanced floating particles with physics */}
      <div className="absolute -inset-12 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full animate-bounce opacity-60`}
            style={{
              left: `${20 + i * 10}%`,
              top: `${15 + (i % 3) * 25}%`,
              backgroundColor: ["#ffffff", "#a855f7", "#3b82f6", "#fbbf24", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"][
                i
              ],
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + (i % 3)}s`,
              transform: `rotate(${rotation * 0.1 + i * 45}deg) translateY(${Math.sin(rotation * 0.01 + i) * 10}px)`,
            }}
          />
        ))}
      </div>

      {/* Orbital rings */}
      <div
        className="absolute -inset-8 border border-white/20 rounded-full animate-spin opacity-30"
        style={{ animationDuration: "20s" }}
      />
      <div
        className="absolute -inset-12 border border-purple-300/20 rounded-full animate-spin opacity-20"
        style={{ animationDuration: "30s", animationDirection: "reverse" }}
      />

      {/* Hover effect overlay */}
      {isHovered && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 via-blue-400/20 to-indigo-400/20 animate-pulse" />
      )}
    </div>
  )
}
