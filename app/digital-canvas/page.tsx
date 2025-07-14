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
    <div className="relative min-h-screen bg-white overflow-x-hidden">
      {/* Comic Book Style Background Pattern */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-white">
          {/* Halftone Pattern Background */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `radial-gradient(circle, black 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 10px 10px",
            }}
          />

          {/* Comic Book Grid Lines */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(black 1px, transparent 1px),
                linear-gradient(90deg, black 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
        </div>
      </div>

      {/* Hero Background - Lowest z-index */}
      <div className="absolute inset-0 z-0">
        <MagazineHero />
      </div>

      {/* 3D Canvas - High z-index but below navbar */}
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
            {/* Enhanced Lighting for comic book effect */}
            <ambientLight intensity={isMobile ? 2 : 1.8} />
            <directionalLight
              position={[5, 5, 5]}
              intensity={isMobile ? 3 : 2.8}
              castShadow={!isMobile}
              shadow-mapSize-width={isMobile ? 512 : 1024}
              shadow-mapSize-height={isMobile ? 512 : 1024}
            />
            {/* Dramatic side lighting for comic book effect */}
            <directionalLight position={[-5, 2, 3]} intensity={1.5} color="#000000" />
            <pointLight position={[0, 0, 10]} intensity={isMobile ? 1.5 : 1.2} color="#ffffff" />

            {/* 3D Magazine Book */}
            <DigitalMagazineBook />

            {/* Environment for reflections */}
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      {/* Comic Book Style Border Frame - Properly sized for both mobile and desktop */}
      <div
        className={`absolute z-20 pointer-events-none border-4 border-black ${
          isMobile ? "top-20 left-2 right-2" : "top-16 left-2 right-2"
        }`}
        style={{
          borderStyle: "solid",
          borderImage: "repeating-linear-gradient(45deg, black 0, black 10px, white 10px, white 20px) 4",
          height: isMobile ? "calc(100vh + 210px)" : "calc(100vh + 2px)", // Extended height for both
        }}
      />
    </div>
  )
}
