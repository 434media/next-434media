"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { motion, useAnimation, AnimatePresence } from "motion/react"

export function InteractiveSDOHLogo() {
  const [isHovered, setIsHovered] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const controls = useAnimation()

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Play a subtle sound effect on hover (respecting user preferences)
  useEffect(() => {
    if (isHovered && !prefersReducedMotion && hasInteracted) {
      const audio = new Audio("/sounds/hover.mp3")
      audio.volume = 0.2
      audio.play().catch((err) => console.log("Audio play prevented:", err))
    }
  }, [isHovered, prefersReducedMotion, hasInteracted])

  // Handle initial animation sequence
  useEffect(() => {
    if (!prefersReducedMotion) {
      controls.start({
        scale: [0.9, 1.02, 1],
        opacity: [0, 1],
        transition: { duration: 1.2, ease: "easeOut" },
      })
    } else {
      controls.start({
        opacity: 1,
        transition: { duration: 0.5 },
      })
    }
  }, [controls, prefersReducedMotion])

  // Generate random positions for the particles
  const generateParticles = (count: number) => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 10 + 5,
      delay: Math.random() * 0.5,
      duration: Math.random() * 1 + 1.5,
      distance: Math.random() * 100 + 50,
      angle: Math.random() * 360,
      color: Math.random() > 0.5 ? "cyan" : "yellow", // Add color property
    }))
  }

  const particles = generateParticles(30)

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full max-w-[95%] mx-auto cursor-pointer"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={controls}
      onClick={() => setHasInteracted(true)}
      onHoverStart={() => {
        setIsHovered(true)
        setHasInteracted(true)
      }}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={
        prefersReducedMotion
          ? {}
          : {
              scale: 1.05,
              transition: { duration: 0.5, ease: [0.19, 1.0, 0.22, 1.0] },
            }
      }
    >
      {/* 3D-like shadow effect */}
      <motion.div
        className="absolute inset-0 rounded-3xl bg-black/20 blur-xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: isHovered ? 0.7 : 0.3,
          y: isHovered ? 20 : 10,
          scale: isHovered ? 0.95 : 1,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Main logo container with 3D effect */}
      <motion.div
        className="relative rounded-2xl overflow-hidden"
        animate={{
          rotateX: isHovered ? "5deg" : "0deg",
          rotateY: isHovered ? "3deg" : "0deg",
          z: isHovered ? 50 : 0,
        }}
        transition={{ duration: 0.5 }}
        style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
      >
        {/* Main logo */}
        <Image
          src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
          alt="¿Qué es SDOH?"
          width={2000}
          height={800}
          className="w-full h-auto"
          priority
        />
      </motion.div>

      {/* Interactive elements that appear on hover */}
      <AnimatePresence>
        {isHovered && !prefersReducedMotion && (
          <>
            {/* Colorful particles */}
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  background: `radial-gradient(circle at center, ${
                    particle.color === "cyan" ? "#06b6d4" : "#fde047"
                  }, transparent)`,
                  boxShadow: `0 0 ${particle.size / 2}px ${particle.color === "cyan" ? "#06b6d4" : "#fde047"}`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0],
                  x: [0, Math.cos(particle.angle * (Math.PI / 180)) * particle.distance],
                  y: [0, Math.sin(particle.angle * (Math.PI / 180)) * particle.distance],
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  duration: particle.duration,
                  ease: "easeOut",
                  delay: particle.delay,
                }}
              />
            ))}

            {/* Text highlight effects */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute top-[25%] left-[15%] w-16 h-16 bg-cyan-500/20 rounded-full blur-xl"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                }}
              />
              <motion.div
                className="absolute bottom-[30%] right-[20%] w-20 h-20 bg-yellow-300/20 rounded-full blur-xl"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                  delay: 0.5,
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
