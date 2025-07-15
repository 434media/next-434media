"use client"

import { motion } from "motion/react"
import { useState, useEffect } from "react"

export function LoadingSpinner() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 flex items-center justify-center">
        <div className="bg-white border-4 border-black p-8 shadow-2xl">
          <h1
            className="text-4xl md:text-6xl font-black text-black uppercase tracking-wider mb-4"
            style={{
              fontFamily: "Impact, Arial Black, sans-serif",
              textShadow: "3px 3px 0px white, 6px 6px 0px black",
              WebkitTextStroke: "2px black",
            }}
          >
            LOADING
          </h1>
          <div className="bg-black text-white p-2 mb-4">
            <p className="text-lg font-bold uppercase tracking-wide" style={{ fontFamily: "Arial Black, sans-serif" }}>
              DIGITAL CANVAS
            </p>
          </div>
          <div className="flex justify-center items-center space-x-2 mb-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-4 h-4 bg-black rounded-full" />
            ))}
          </div>
          <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">
            Preparing your creative experience...
          </p>
        </div>
      </div>
    )
  }

  // Pre-defined positions to avoid Math.random() hydration issues
  const actionLinePositions = [
    { top: "20%", left: "15%", rotation: 45 },
    { top: "60%", left: "80%", rotation: 120 },
    { top: "40%", left: "25%", rotation: 200 },
    { top: "80%", left: "60%", rotation: 300 },
    { top: "10%", left: "70%", rotation: 15 },
    { top: "70%", left: "10%", rotation: 180 },
    { top: "30%", left: "90%", rotation: 90 },
    { top: "90%", left: "40%", rotation: 270 },
    { top: "50%", left: "5%", rotation: 135 },
    { top: "25%", left: "55%", rotation: 225 },
    { top: "75%", left: "75%", rotation: 315 },
    { top: "5%", left: "35%", rotation: 60 },
    { top: "85%", left: "85%", rotation: 150 },
    { top: "45%", left: "45%", rotation: 240 },
    { top: "65%", left: "20%", rotation: 330 },
    { top: "15%", left: "65%", rotation: 75 },
    { top: "55%", left: "30%", rotation: 165 },
    { top: "35%", left: "75%", rotation: 255 },
    { top: "95%", left: "50%", rotation: 345 },
    { top: "25%", left: "85%", rotation: 105 },
  ]

  const comicActionLines = [
    { top: "30%", left: "20%", rotation: 30 },
    { top: "70%", left: "60%", rotation: 120 },
    { top: "50%", left: "80%", rotation: 210 },
    { top: "20%", left: "40%", rotation: 300 },
    { top: "80%", left: "30%", rotation: 45 },
    { top: "40%", left: "70%", rotation: 135 },
    { top: "60%", left: "10%", rotation: 225 },
    { top: "10%", left: "90%", rotation: 315 },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 flex items-center justify-center relative overflow-hidden">
      {/* Comic Book Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Action Lines */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          {actionLinePositions.map((pos, i) => (
            <motion.div
              key={i}
              className="absolute bg-black"
              style={{
                width: "2px",
                height: "100px",
                top: pos.top,
                left: pos.left,
                transform: `rotate(${pos.rotation}deg)`,
              }}
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>

        {/* Comic Dots Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: "radial-gradient(circle, black 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
        </div>
      </div>

      {/* Loading Content */}
      <div className="relative z-10 text-center">
        {/* Main Loading Panel */}
        <motion.div
          className="bg-white border-4 border-black p-8 shadow-2xl transform"
          animate={{
            rotate: [-1, 1, -1],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          {/* Loading Title */}
          <h1
            className="text-4xl md:text-6xl font-black text-black uppercase tracking-wider mb-4"
            style={{
              fontFamily: "Impact, Arial Black, sans-serif",
              textShadow: "3px 3px 0px white, 6px 6px 0px black",
              WebkitTextStroke: "2px black",
            }}
          >
            LOADING
          </h1>

          {/* Subtitle */}
          <div className="bg-black text-white p-2 mb-4 transform rotate-1">
            <p className="text-lg font-bold uppercase tracking-wide" style={{ fontFamily: "Arial Black, sans-serif" }}>
              DIGITAL CANVAS
            </p>
          </div>

          {/* Loading Animation */}
          <div className="flex justify-center items-center space-x-2 mb-4">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-4 h-4 bg-black rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>

          {/* Loading Text */}
          <p className="text-sm font-bold text-gray-600 uppercase tracking-wide">
            Preparing your creative experience...
          </p>

          {/* Comic Book Action Lines */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {comicActionLines.map((line, i) => (
              <motion.div
                key={i}
                className="absolute bg-black/20"
                style={{
                  width: "1px",
                  height: "40px",
                  top: line.top,
                  left: line.left,
                  transform: `rotate(${line.rotation}deg)`,
                }}
                animate={{
                  opacity: [0, 0.3, 0],
                  scale: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Loading Badge */}
        <motion.div
          className="absolute -top-2 -right-2 bg-yellow-300 border-4 border-black px-2 py-1 transform rotate-12 shadow-lg"
          animate={{
            rotate: [12, 15, 12],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
          }}
          style={{
            fontFamily: "Impact, Arial Black, sans-serif",
          }}
        >
          <span className="text-xs font-black">Learn2AI</span>
        </motion.div>
      </div>
    </div>
  )
}
