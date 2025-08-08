"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue, useSpring } from "motion/react"
import { useMobile } from "../../hooks/use-mobile"

interface MagazineHeroProps {}

export function MagazineHero({}: MagazineHeroProps) {
  const [mounted, setMounted] = useState(false)
  const isMobile = useMobile()
  
  // Cursor follow motion values - initialize with center screen position
  const cursorX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
  const cursorY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0)
  
  // Enhanced cursor followers with more variety
  const cursorXSpring = useSpring(cursorX, { stiffness: 400, damping: 40 })
  const cursorYSpring = useSpring(cursorY, { stiffness: 400, damping: 40 })
  
  const cursor2X = useSpring(cursorX, { stiffness: 250, damping: 30 })
  const cursor2Y = useSpring(cursorY, { stiffness: 250, damping: 30 })
  
  const cursor3X = useSpring(cursorX, { stiffness: 150, damping: 25 })
  const cursor3Y = useSpring(cursorY, { stiffness: 150, damping: 25 })
  
  const cursor4X = useSpring(cursorX, { stiffness: 100, damping: 20 })
  const cursor4Y = useSpring(cursorY, { stiffness: 100, damping: 20 })
  
  const cursor5X = useSpring(cursorX, { stiffness: 80, damping: 15 })
  const cursor5Y = useSpring(cursorY, { stiffness: 80, damping: 15 })

  useEffect(() => {
    setMounted(true)
    
    // Global mouse move handler for cursor following
    const handleGlobalMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleGlobalMouseMove)
      return () => window.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [cursorX, cursorY])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-2xl font-black text-black">Loading...</div>
      </div>
    )
  }

  return (
    <>
      {/* Enhanced Multi-colored cursor followers */}
      {!isMobile && mounted && (
        <>
          {/* Main cursor - Pink - Largest */}
          <motion.div
            className="fixed w-8 h-8 rounded-full pointer-events-none z-50 mix-blend-difference"
            style={{
              backgroundColor: '#ff0088',
              left: 0,
              top: 0,
              x: cursorXSpring,
              y: cursorYSpring,
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
          
          {/* Second cursor - Cyan */}
          <motion.div
            className="fixed w-6 h-6 rounded-full pointer-events-none z-50 mix-blend-difference"
            style={{
              backgroundColor: '#0cdcf7',
              left: 0,
              top: 0,
              x: cursor2X,
              y: cursor2Y,
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
          
          {/* Third cursor - Yellow */}
          <motion.div
            className="fixed w-5 h-5 rounded-full pointer-events-none z-50 mix-blend-difference"
            style={{
              backgroundColor: '#fff312',
              left: 0,
              top: 0,
              x: cursor3X,
              y: cursor3Y,
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
          
          {/* Fourth cursor - Orange */}
          <motion.div
            className="fixed w-4 h-4 rounded-full pointer-events-none z-50 mix-blend-difference"
            style={{
              backgroundColor: '#ff6b35',
              left: 0,
              top: 0,
              x: cursor4X,
              y: cursor4Y,
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
          
          {/* Fifth cursor - Purple - Smallest */}
          <motion.div
            className="fixed w-3 h-3 rounded-full pointer-events-none z-50 mix-blend-difference"
            style={{
              backgroundColor: '#7209b7',
              left: 0,
              top: 0,
              x: cursor5X,
              y: cursor5Y,
              translateX: '-50%',
              translateY: '-50%',
            }}
          />
        </>
      )}

      <div className="min-h-screen w-full bg-white flex items-center justify-center relative overflow-hidden cursor-none">
        {/* Subtle Static Background Pattern */}
        <div className="absolute inset-0 bg-white">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `radial-gradient(circle, black 2px, transparent 2px)`,
              backgroundSize: "30px 30px",
            }}
          />
        </div>

        {/* Centered Logo and Banner */}
        <div className="relative z-10 text-center space-y-8">
          {/* Digital Canvas Logo */}
          <motion.div 
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <img
              src="https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-dark.svg"
              alt="Digital Canvas"
              className={`${isMobile ? "w-96 h-auto" : "w-[600px] h-auto"} mx-auto`}
              style={{
                filter: "drop-shadow(4px 4px 0px white) drop-shadow(8px 8px 0px black)",
              }}
            />
          </motion.div>

          {/* Creative Layer Banner - Fixed for mobile */}
          <motion.div 
            className="relative bg-black text-white p-6 transform rotate-1 shadow-2xl border-4 border-black max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            <p
              className={`${isMobile ? "text-base" : "text-3xl"} font-bold uppercase tracking-wide text-center whitespace-nowrap`}
              style={{ fontFamily: "Arial Black, sans-serif" }}
            >
              The Creative Layer of{" "}
              <span className="bg-white text-black px-3 py-2 font-menda-black">434 MEDIA</span>
            </p>
          </motion.div>
        </div>

        {/* Enhanced Cursor Indicator */}
        <div className="absolute bottom-8 right-8 text-black/50 text-sm font-medium pointer-events-none">
          {!isMobile ? "Move your cursor to create magic" : "Digital Canvas"}
        </div>
      </div>
    </>
  )
}
