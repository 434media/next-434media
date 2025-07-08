"use client"

import { useEffect, useState } from "react"
import { ScrambleText } from "../ScrambleText"
import { useMobile } from "../../hooks/use-mobile"

export function MagazineHero() {
  const [mounted, setMounted] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="absolute inset-0 z-0">
      {/* Background Effects - Very low opacity to not interfere with 3D */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-purple-900/70 to-slate-900/80" />

      {/* Animated Grid - Very subtle */}
      <div className="absolute inset-0 opacity-3">
        <div
          className={`absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.2)_1px,transparent_1px)] ${
            isMobile ? "bg-[size:40px_40px]" : "bg-[size:60px_60px]"
          }`}
          style={{
            animation: "grid-move 20s linear infinite",
          }}
        />
      </div>

      {/* Static Floating Particles - No Math.random() to fix hydration */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Predefined particle positions to avoid hydration mismatch */}
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "10%", top: "20%", animation: "pulse 2s infinite" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "25%", top: "60%", animation: "pulse 2.5s infinite 0.5s" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "70%", top: "30%", animation: "pulse 3s infinite 1s" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "85%", top: "70%", animation: "pulse 2.2s infinite 1.5s" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "40%", top: "80%", animation: "pulse 2.8s infinite 0.8s" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "60%", top: "15%", animation: "pulse 2.3s infinite 1.2s" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "15%", top: "75%", animation: "pulse 2.7s infinite 0.3s" }}
        />
        <div
          className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
          style={{ left: "90%", top: "45%", animation: "pulse 2.1s infinite 1.8s" }}
        />
        {isMobile ? null : (
          <>
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "35%", top: "25%", animation: "pulse 2.4s infinite 0.7s" }}
            />
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "55%", top: "85%", animation: "pulse 2.6s infinite 1.3s" }}
            />
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "80%", top: "10%", animation: "pulse 2.9s infinite 0.2s" }}
            />
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "20%", top: "50%", animation: "pulse 2.2s infinite 1.6s" }}
            />
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "75%", top: "65%", animation: "pulse 2.5s infinite 0.9s" }}
            />
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "45%", top: "35%", animation: "pulse 2.8s infinite 1.1s" }}
            />
            <div
              className="absolute w-1 h-1 bg-purple-400/20 rounded-full"
              style={{ left: "65%", top: "90%", animation: "pulse 2.3s infinite 0.4s" }}
            />
          </>
        )}
      </div>

      {/* Hero Content - Much more spacing to avoid card overlap */}
      <div
        className={`absolute z-10 ${
          isMobile
            ? "top-36 left-4 right-4 pb-80" // Massive bottom padding to avoid card overlap
            : "top-32 left-8 max-w-lg"
        }`}
      >
        <div className={`space-y-${isMobile ? "4" : "6"}`}>
          {/* Main Title - Mobile Responsive with better sizing */}
          <h1
            className={`${
              isMobile ? "text-3xl leading-tight" : "text-5xl md:text-6xl leading-tight"
            } font-bold text-white`}
          >
            <ScrambleText
              text="DIGITAL CANVAS"
              className="block bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent"
            />
            <ScrambleText
              text="MAGAZINE"
              className={`block bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent ${
                isMobile ? "text-2xl" : "text-4xl md:text-5xl"
              }`}
            />
          </h1>

          {/* Subtitle - Mobile Responsive */}
          <p className={`${isMobile ? "text-base" : "text-2xl"} text-slate-300 leading-relaxed font-light`}>
            The creative layer of <span className="text-purple-400 font-semibold">434 Media</span>
          </p>

          {/* Description - Mobile Responsive */}
          <p
            className={`${isMobile ? "text-sm" : "text-lg"} text-slate-400 leading-relaxed ${
              isMobile ? "max-w-none" : "max-w-md"
            }`}
          >
            {isMobile
              ? "Experience the future of digital publishing with interactive storytelling."
              : "Experience the future of digital publishing with our interactive magazine platform that blends cutting-edge technology with compelling storytelling."}
          </p>

          {/* Features List - Mobile Optimized */}
          <div className={`space-y-${isMobile ? "2" : "3"} text-slate-300`}>
            {[
              "Interactive 3D Reading Experience",
              "Immersive Visual Storytelling",
              "Revolutionary Digital Publishing",
            ].map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full"
                  style={{ animation: `pulse 2s infinite ${index * 0.2}s` }}
                />
                <span className={isMobile ? "text-xs" : "text-sm"}>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side Info - Desktop Only with proper spacing */}
      {!isMobile && (
        <div className="absolute top-1/2 right-8 transform -translate-y-1/2 z-10 text-right max-w-xs">
          <div className="space-y-4">
            <div className="text-white/80">
              <div className="text-sm uppercase tracking-widest text-purple-300 mb-2">Issue #001</div>
              <div className="text-2xl font-bold">July 2025</div>
            </div>

            <div className="w-px h-16 bg-gradient-to-b from-transparent via-purple-400/60 to-transparent ml-auto" />
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(${isMobile ? "40px, 40px" : "60px, 60px"}); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
