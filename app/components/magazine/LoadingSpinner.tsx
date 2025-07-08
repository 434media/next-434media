"use client"

import { useEffect, useState } from "react"
import { useMobile } from "../../hooks/use-mobile"

export function LoadingSpinner() {
  const [mounted, setMounted] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-purple-900/85 to-slate-900/95" />

      {/* Animated Grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className={`absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.3)_1px,transparent_1px)] ${
            isMobile ? "bg-[size:40px_40px]" : "bg-[size:60px_60px]"
          }`}
          style={{
            animation: "grid-move 20s linear infinite",
          }}
        />
      </div>

      {/* Loading Content */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center space-y-6">
          {/* Spinning Logo */}
          <div className="relative">
            <div
              className={`${
                isMobile ? "w-16 h-16" : "w-24 h-24"
              } border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin`}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${isMobile ? "w-8 h-8" : "w-12 h-12"} bg-purple-400/20 rounded-full`} />
            </div>
          </div>

          {/* Loading Text */}
          <div className="space-y-2">
            <h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-white`}>Loading Digital Canvas</h2>
            <p className={`${isMobile ? "text-sm" : "text-base"} text-slate-400`}>
              Preparing your interactive magazine experience...
            </p>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(isMobile ? 8 : 15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400/40 rounded-full"
            style={{
              left: `${10 + i * 8}%`,
              top: `${20 + i * 5}%`,
              animation: `float ${2 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(${isMobile ? "40px, 40px" : "60px, 60px"}); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.4; }
          50% { transform: translateY(-15px) rotate(180deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
