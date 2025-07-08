"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Text, Box, Plane } from "@react-three/drei"
import type { Group, Mesh } from "three"

export function DigitalMagazine() {
  const groupRef = useRef<Group>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const { viewport } = useThree()

  // Magazine pages data
  const pages = [
    {
      title: "DIGITAL CANVAS",
      subtitle: "Issue #001 - Coming Soon",
      content: "The Creative Layer of 434 Media",
      color: "#8b5cf6",
    },
    {
      title: "INNOVATION",
      subtitle: "Creative Technology",
      content: "Where Art Meets Digital",
      color: "#06b6d4",
    },
    {
      title: "DESIGN",
      subtitle: "Visual Storytelling",
      content: "Crafting Digital Experiences",
      color: "#10b981",
    },
    {
      title: "FUTURE",
      subtitle: "What's Next",
      content: "The Evolution of Media",
      color: "#f59e0b",
    },
  ]

  // Auto-flip pages
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isFlipping) {
        setCurrentPage((prev) => (prev + 1) % pages.length)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [isFlipping, pages.length])

  // Animation
  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1

      // Subtle rotation based on mouse position
      const mouse = state.mouse
      groupRef.current.rotation.y = mouse.x * 0.1
      groupRef.current.rotation.x = -mouse.y * 0.05
    }
  })

  const handlePageClick = () => {
    if (!isFlipping) {
      setIsFlipping(true)
      setCurrentPage((prev) => (prev + 1) % pages.length)
      setTimeout(() => setIsFlipping(false), 1000)
    }
  }

  const currentPageData = pages[currentPage]
  const scale = Math.min(viewport.width / 8, viewport.height / 6)

  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* Magazine Base */}
      <MagazineBase onClick={handlePageClick} />

      {/* Current Page */}
      <MagazinePage pageData={currentPageData} isFlipping={isFlipping} position={[0, 0, 0.02]} />

      {/* Page Stack Effect */}
      {pages.map((_, index) => (
        <Plane key={index} args={[3.8, 5.8]} position={[0, 0, -0.01 - index * 0.002]}>
          <meshStandardMaterial color="#ffffff" transparent opacity={0.8 - index * 0.1} />
        </Plane>
      ))}

      {/* Magazine Spine */}
      <Box args={[0.1, 6, 4]} position={[-1.95, 0, 0]}>
        <meshStandardMaterial color="#1f2937" />
      </Box>

      {/* Interactive Glow */}
      <Plane args={[4.2, 6.2]} position={[0, 0, -0.1]}>
        <meshStandardMaterial
          color={currentPageData.color}
          transparent
          opacity={0.1}
          emissive={currentPageData.color}
          emissiveIntensity={0.2}
        />
      </Plane>
    </group>
  )
}

function MagazineBase({ onClick }: { onClick: () => void }) {
  return (
    <Plane
      args={[4, 6]}
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.1} />
    </Plane>
  )
}

function MagazinePage({
  pageData,
  isFlipping,
  position,
}: {
  pageData: any
  isFlipping: boolean
  position: [number, number, number]
}) {
  const pageRef = useRef<Mesh>(null)

  useFrame(() => {
    if (pageRef.current && isFlipping) {
      pageRef.current.rotation.y = Math.sin(Date.now() * 0.01) * 0.5
    } else if (pageRef.current) {
      pageRef.current.rotation.y = 0
    }
  })

  return (
    <group position={position} ref={pageRef}>
      {/* Page Background */}
      <Plane args={[3.8, 5.8]}>
        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.1} />
      </Plane>

      {/* Title */}
      <Text
        position={[0, 1.5, 0.01]}
        fontSize={0.3}
        color={pageData.color}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Bold.ttf"
        letterSpacing={0.05}
      >
        {pageData.title}
      </Text>

      {/* Subtitle */}
      <Text
        position={[0, 1, 0.01]}
        fontSize={0.15}
        color="#64748b"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Regular.ttf"
      >
        {pageData.subtitle}
      </Text>

      {/* Content */}
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.2}
        color="#1f2937"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Regular.ttf"
        maxWidth={3}
        textAlign="center"
      >
        {pageData.content}
      </Text>

      {/* Decorative Elements */}
      <Plane args={[2, 0.02]} position={[0, 0.5, 0.01]}>
        <meshStandardMaterial color={pageData.color} />
      </Plane>

      {/* Coming Soon Badge */}
      <group position={[0, -1.5, 0.01]}>
        <Plane args={[1.5, 0.4]}>
          <meshStandardMaterial color={pageData.color} transparent opacity={0.9} />
        </Plane>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.12}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          font="/fonts/Geist-Bold.ttf"
        >
          COMING SOON
        </Text>
      </group>

      {/* Page Number */}
      <Text
        position={[1.5, -2.5, 0.01]}
        fontSize={0.1}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Regular.ttf"
      >
        {String(Math.floor(Math.random() * 50) + 1).padStart(2, "0")}
      </Text>
    </group>
  )
}
