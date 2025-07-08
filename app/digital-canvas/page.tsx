"use client"

import { Suspense, useState, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { Environment } from "@react-three/drei"
import { DigitalMagazineBook } from "../components/magazine/DigitalMagazineBook"
import { MagazineHero } from "../components/magazine/MagazineHero"
import { LoadingSpinner } from "../components/magazine/LoadingSpinner"
import { useMobile } from "../hooks/use-mobile"

export default function DigitalCanvasPage() {
  const [mounted, setMounted] = useState(false)
  const isMobile = useMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <LoadingSpinner />
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-x-hidden">
      {/* Hero Background - Lowest z-index */}
      <div className="absolute inset-0 z-0">
        <MagazineHero />
      </div>

      {/* 3D Canvas - Very high z-index to ensure it's always visible */}
      <div className="absolute inset-0 z-30 pointer-events-auto">
        <Canvas
          camera={{
            position: isMobile ? [0, 0, 4] : [0, 0, 5],
            fov: isMobile ? 75 : 50,
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
            height: "100vh",
          }}
          dpr={isMobile ? [1, 2] : [1, 2]}
        >
          <Suspense fallback={null}>
            {/* Enhanced Lighting for better visibility */}
            <ambientLight intensity={isMobile ? 3 : 2.5} />
            <directionalLight
              position={[5, 5, 5]}
              intensity={isMobile ? 4 : 3.5}
              castShadow={!isMobile}
              shadow-mapSize-width={isMobile ? 512 : 1024}
              shadow-mapSize-height={isMobile ? 512 : 1024}
            />
            <pointLight position={[-5, 5, 5]} intensity={isMobile ? 3 : 2.5} color="#8b5cf6" />
            <pointLight position={[5, -5, 5]} intensity={isMobile ? 2.5 : 2} color="#06b6d4" />
            <pointLight position={[0, 0, 10]} intensity={isMobile ? 2 : 1.5} color="#ffffff" />

            {/* 3D Magazine Book */}
            <DigitalMagazineBook />

            {/* Environment for reflections */}
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </div>

      {/* Debug indicator with proper spacing from navbar */}
      <div
        className={`absolute ${isMobile ? "top-32" : "top-28"} right-4 z-50 bg-green-500/20 text-green-300 px-3 py-1 rounded text-xs border border-green-400/30`}
      >
        3D Canvas Active
      </div>
    </div>
  )
}
