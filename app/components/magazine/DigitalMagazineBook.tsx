"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Text, Plane, Box } from "@react-three/drei"
import { useMobile } from "../../hooks/use-mobile"
import type { Group } from "three"
import * as THREE from "three"

interface PageData {
  title: string
  subtitle: string
  content: string
  color: string
  accent: string
  bgColor?: string
}

interface MagazinePageProps {
  pageData: PageData
  position: [number, number, number]
  isLeft: boolean
  isMobile: boolean
}

function MagazinePage({ pageData, position, isLeft, isMobile }: MagazinePageProps) {
  return (
    <group position={position}>
      {/* Page Background */}
      <Plane args={isMobile ? [2.4, 3.2] : [2.8, 3.8]}>
        <meshStandardMaterial color={pageData.bgColor || "#ffffff"} roughness={0.3} metalness={0.1} />
      </Plane>

      {/* Title */}
      <Text
        position={[0, isMobile ? 1.2 : 1.4, 0.02]}
        fontSize={isMobile ? 0.15 : 0.2}
        color={pageData.color}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Bold.ttf"
        letterSpacing={0.02}
        maxWidth={isMobile ? 2.0 : 2.5}
      >
        {pageData.title}
      </Text>

      {/* Subtitle */}
      <Text
        position={[0, isMobile ? 0.9 : 1.0, 0.02]}
        fontSize={isMobile ? 0.08 : 0.1}
        color={pageData.accent}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Regular.ttf"
        letterSpacing={0.01}
      >
        {pageData.subtitle}
      </Text>

      {/* Decorative Line */}
      <Plane args={isMobile ? [1.2, 0.015] : [1.5, 0.02]} position={[0, isMobile ? 0.6 : 0.7, 0.02]}>
        <meshStandardMaterial color={pageData.color} />
      </Plane>

      {/* Content */}
      <Text
        position={[0, isMobile ? 0.1 : 0.2, 0.02]}
        fontSize={isMobile ? 0.06 : 0.08}
        color="#374151"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Regular.ttf"
        maxWidth={isMobile ? 1.8 : 2.2}
        textAlign="center"
        lineHeight={1.6}
      >
        {pageData.content}
      </Text>

      {/* Accent Element */}
      <Plane
        args={isMobile ? [0.4, 0.4] : [0.6, 0.6]}
        position={[0, isMobile ? -0.5 : -0.6, 0.02]}
        rotation={[0, 0, Math.PI / 4]}
      >
        <meshStandardMaterial color={pageData.color} transparent opacity={0.15} />
      </Plane>

      {/* Page Number */}
      <Text
        position={[isLeft ? (isMobile ? -1.0 : -1.2) : isMobile ? 1.0 : 1.2, isMobile ? -1.4 : -1.6, 0.02]}
        fontSize={isMobile ? 0.05 : 0.06}
        color="#9ca3af"
        anchorX={isLeft ? "left" : "right"}
        anchorY="middle"
        font="/fonts/Geist-Regular.ttf"
      >
        {isLeft ? "02" : "03"}
      </Text>
    </group>
  )
}

export function DigitalMagazineBook() {
  const groupRef = useRef<Group>(null)
  const leftPageRef = useRef<Group>(null)
  const rightPageRef = useRef<Group>(null)
  const coverRef = useRef<Group>(null)

  const [currentPage, setCurrentPage] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [hovered, setHovered] = useState(false)

  const { viewport } = useThree()
  const isMobile = useMobile()

  // Magazine pages data
  const pages: PageData[] = [
    {
      title: "DIGITAL CANVAS",
      subtitle: "Magazine Issue #001",
      content: isMobile
        ? "The creative layer of 434 Media. Innovation meets artistry in digital publishing."
        : "The creative layer of 434 Media. Where innovation meets artistry in the digital realm. Experience the future of interactive publishing.",
      color: "#8b5cf6",
      accent: "#a855f7",
      bgColor: "#fefefe",
    },
    {
      title: "INNOVATION",
      subtitle: "Technology & Creativity",
      content: isMobile
        ? "Pushing boundaries in digital storytelling through cutting-edge technology."
        : "Pushing the boundaries of digital storytelling through cutting-edge technology and immersive experiences that captivate and inspire.",
      color: "#10b981",
      accent: "#059669",
      bgColor: "#f0fdf4",
    },
    {
      title: "EXPERIENCE",
      subtitle: "Interactive Media",
      content: isMobile
        ? "Crafting narratives that respond to user interaction and create personalized journeys."
        : "Crafting narratives that respond to user interaction, creating personalized journeys through content that adapts and evolves.",
      color: "#f59e0b",
      accent: "#d97706",
      bgColor: "#fffbeb",
    },
    {
      title: "FUTURE",
      subtitle: "What's Next in 2025",
      content: isMobile
        ? "The evolution of media continues. Join us as we explore new frontiers in digital publishing."
        : "The evolution of media continues. Join us as we explore new frontiers in digital publishing and interactive storytelling.",
      color: "#ef4444",
      accent: "#dc2626",
      bgColor: "#fef2f2",
    },
  ]

  // Handle scroll-based opening
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = isMobile ? 150 : 200
      const progress = Math.min(scrollY / maxScroll, 1)
      setScrollProgress(progress)
      setBookOpen(progress > (isMobile ? 0.15 : 0.2))
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isMobile])

  // Handle click/tap to flip pages
  const handleBookClick = (event: any) => {
    event.stopPropagation()
    if (!isFlipping && bookOpen && currentPage < pages.length - 1) {
      setIsFlipping(true)
      setCurrentPage((prev) => prev + 1)
      setTimeout(() => setIsFlipping(false), isMobile ? 600 : 800)
    } else if (!isFlipping && bookOpen && currentPage >= pages.length - 1) {
      // Reset to beginning
      setCurrentPage(0)
    }
  }

  // Animation loop
  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating animation - reduced on mobile
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * (isMobile ? 0.03 : 0.05)

      // Mouse/touch interaction - reduced on mobile
      const mouse = state.mouse
      const sensitivity = isMobile ? 0.05 : 0.1
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, mouse.x * sensitivity, 0.05)
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -mouse.y * (sensitivity * 0.5),
        0.05,
      )

      // Hover effect - disabled on mobile
      if (!isMobile && hovered) {
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, 0.2, 0.1)
      } else {
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, 0, 0.1)
      }
    }

    // Book opening animation
    if (leftPageRef.current && rightPageRef.current && coverRef.current) {
      const openAngle = bookOpen ? Math.PI * (isMobile ? 0.6 : 0.7) : 0

      leftPageRef.current.rotation.y = THREE.MathUtils.lerp(leftPageRef.current.rotation.y, -openAngle, 0.08)
      rightPageRef.current.rotation.y = THREE.MathUtils.lerp(rightPageRef.current.rotation.y, openAngle, 0.08)

      // Cover animation
      coverRef.current.rotation.y = THREE.MathUtils.lerp(
        coverRef.current.rotation.y,
        bookOpen ? -Math.PI * (isMobile ? 0.7 : 0.8) : 0,
        0.06,
      )

      // Page flipping animation
      if (isFlipping) {
        const flipTime = state.clock.elapsedTime * (isMobile ? 8 : 6)
        const flipProgress = (Math.sin(flipTime) + 1) / 2
        rightPageRef.current.rotation.y = openAngle + Math.PI * flipProgress
      }
    }
  })

  // Better mobile scaling and positioning
  const scale = isMobile
    ? Math.min(viewport.width / 4, viewport.height / 3, 1.0)
    : Math.min(viewport.width / 4, viewport.height / 3, 1.2)

  // Center the book better on mobile
  const position: [number, number, number] = isMobile ? [0, 0, 0] : [0.5, 0, 0]

  return (
    <group
      ref={groupRef}
      scale={[scale, scale, scale]}
      position={position}
      onClick={handleBookClick}
      onPointerOver={() => {
        if (!isMobile) {
          setHovered(true)
          document.body.style.cursor = "pointer"
        }
      }}
      onPointerOut={() => {
        if (!isMobile) {
          setHovered(false)
          document.body.style.cursor = "auto"
        }
      }}
    >
      {/* Book Spine */}
      <Box args={isMobile ? [0.12, 3.2, 2.4] : [0.15, 4, 2.8]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.3} />
      </Box>

      {/* Spine Text */}
      <Text
        position={[0, 0, isMobile ? 1.3 : 1.5]}
        fontSize={isMobile ? 0.06 : 0.08}
        color="#8b5cf6"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Bold.ttf"
        rotation={[0, 0, Math.PI / 2]}
      >
        DIGITAL CANVAS
      </Text>

      {/* Book Cover */}
      <group ref={coverRef} position={[-0.06, 0, 0]}>
        <Plane args={isMobile ? [2.4, 3.2] : [2.8, 4]} position={isMobile ? [-1.2, 0, 0] : [-1.4, 0, 0]}>
          <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.2} />
        </Plane>

        {/* Cover Design */}
        <group position={isMobile ? [-1.2, 0, 0.03] : [-1.4, 0, 0.03]}>
          <Text
            position={[0, isMobile ? 0.6 : 0.8, 0]}
            fontSize={isMobile ? 0.18 : 0.25}
            color="#8b5cf6"
            anchorX="center"
            anchorY="middle"
            font="/fonts/Geist-Bold.ttf"
            letterSpacing={0.05}
          >
            DIGITAL
          </Text>

          <Text
            position={[0, isMobile ? 0.25 : 0.4, 0]}
            fontSize={isMobile ? 0.18 : 0.25}
            color="#06b6d4"
            anchorX="center"
            anchorY="middle"
            font="/fonts/Geist-Bold.ttf"
            letterSpacing={0.05}
          >
            CANVAS
          </Text>

          <Text
            position={[0, isMobile ? -0.1 : 0, 0]}
            fontSize={isMobile ? 0.08 : 0.1}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
            font="/fonts/Geist-Regular.ttf"
          >
            MAGAZINE
          </Text>

          <Text
            position={[0, isMobile ? -1.0 : -1.2, 0]}
            fontSize={isMobile ? 0.06 : 0.08}
            color="#64748b"
            anchorX="center"
            anchorY="middle"
            font="/fonts/Geist-Regular.ttf"
          >
            434 MEDIA • 2025
          </Text>
        </group>
      </group>

      {/* Left Page */}
      <group ref={leftPageRef} position={[-0.06, 0, 0]}>
        {currentPage > 0 && (
          <MagazinePage
            pageData={pages[currentPage - 1]}
            position={isMobile ? [-1.2, 0, 0] : [-1.4, 0, 0]}
            isLeft={true}
            isMobile={isMobile}
          />
        )}
      </group>

      {/* Right Page */}
      <group ref={rightPageRef} position={[0.06, 0, 0]}>
        {currentPage < pages.length && (
          <MagazinePage
            pageData={pages[currentPage]}
            position={isMobile ? [1.2, 0, 0] : [1.4, 0, 0]}
            isLeft={false}
            isMobile={isMobile}
          />
        )}
      </group>

      {/* Enhanced Glow Effect - More visible and persistent */}
      <Plane args={isMobile ? [6, 4] : [8, 5]} position={[0, 0, -1]}>
        <meshStandardMaterial
          color={pages[currentPage]?.color || "#8b5cf6"}
          transparent
          opacity={bookOpen ? (isMobile ? 0.08 : 0.1) : isMobile ? 0.12 : 0.18}
          emissive={pages[currentPage]?.color || "#8b5cf6"}
          emissiveIntensity={bookOpen ? (isMobile ? 0.1 : 0.15) : isMobile ? 0.18 : 0.25}
        />
      </Plane>

      {/* Bright debug cube to ensure 3D is working - Always visible */}
      <Box args={[0.5, 0.5, 0.5]} position={[3, 2, 0]}>
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.8} transparent={false} />
      </Box>

      {/* Additional visibility indicator - Spinning cube */}
      <Box args={[0.3, 0.3, 0.3]} position={[-3, 2, 0]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={0.6} />
      </Box>
    </group>
  )
}
