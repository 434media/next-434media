"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Text, Box, Plane } from "@react-three/drei"
import type * as THREE from "three"

interface Page {
  id: number
  title: string
  content: string
  type: "cover" | "content" | "back"
}

export function DigitalMagazineBook() {
  const bookRef = useRef<THREE.Group>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const { camera, gl } = useThree()

  // Sample pages data
  const pages: Page[] = [
    {
      id: 0,
      title: "DIGITAL CANVAS",
      content: "Issue #001 - 2025\nThe Creative Layer",
      type: "cover",
    },
    {
      id: 1,
      title: "FOUNDER'S NOTE",
      content: "Welcome to Digital Canvas,\nwhere creativity meets\ntechnology in perfect\nharmony.",
      type: "content",
    },
    {
      id: 2,
      title: "MONTH IN MOTION",
      content: "This month we explore\nthe intersection of\nAI and creative\nstorytelling.",
      type: "content",
    },
    {
      id: 3,
      title: "INTERACTIVE STORIES",
      content: "Discover how we're\nrevolutionizing digital\nnarratives through\nimmersive experiences.",
      type: "content",
    },
    {
      id: 4,
      title: "THE DROP",
      content: "Latest releases and\nupdates from the\nDigital Canvas\necosystem.",
      type: "content",
    },
    {
      id: 5,
      title: "BACK COVER",
      content: "434 MEDIA\nDigital Canvas\nLearn2AI",
      type: "back",
    },
  ]

  // Floating animation
  useFrame((state) => {
    if (bookRef.current && !isDragging) {
      bookRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
      bookRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.05
    }
  })

  // Handle mouse/touch events
  const handlePointerDown = (event: any) => {
    event.stopPropagation()
    setIsDragging(true)
    setDragStart({
      x: event.clientX || event.touches?.[0]?.clientX || 0,
      y: event.clientY || event.touches?.[0]?.clientY || 0,
    })

    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handlePointerMove = (event: any) => {
    if (!isDragging) return

    const currentX = event.clientX || event.touches?.[0]?.clientX || 0
    const deltaX = currentX - dragStart.x

    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1)
        setDragStart({ x: currentX, y: dragStart.y })
      } else if (deltaX < 0 && currentPage < pages.length - 1) {
        setCurrentPage(currentPage + 1)
        setDragStart({ x: currentX, y: dragStart.y })
      }
    }
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Add event listeners
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener("mousemove", handlePointerMove)
    canvas.addEventListener("mouseup", handlePointerUp)
    canvas.addEventListener("touchmove", handlePointerMove)
    canvas.addEventListener("touchend", handlePointerUp)

    return () => {
      canvas.removeEventListener("mousemove", handlePointerMove)
      canvas.removeEventListener("mouseup", handlePointerUp)
      canvas.removeEventListener("touchmove", handlePointerMove)
      canvas.removeEventListener("touchend", handlePointerUp)
    }
  }, [isDragging, dragStart, currentPage])

  return (
    <group ref={bookRef} position={[0, 0.3, 0]}>
      {/* Book Base */}
      <Box args={[2.5, 3.2, 0.25]} position={[0, 0, -0.125]} onPointerDown={handlePointerDown}>
        <meshStandardMaterial color="#2a2a2a" />
      </Box>

      {/* Current Page */}
      <group position={[0, 0, 0.01]} rotation={[0, 0, isOpen ? -0.1 : 0]}>
        <Plane args={[2.3, 3]} position={[0, 0, 0.01]}>
          <meshStandardMaterial color="white" />
        </Plane>

        {/* Page Content */}
        <Text
          position={[0, 1.2, 0.02]}
          fontSize={0.25}
          color="black"
          anchorX="center"
          anchorY="middle"
          font="/fonts/impact.woff"
          fontWeight="bold"
        >
          {pages[currentPage]?.title || ""}
        </Text>

        <Text
          position={[0, 0, 0.02]}
          fontSize={0.12}
          color="black"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          maxWidth={2}
        >
          {pages[currentPage]?.content || ""}
        </Text>

        {/* Page Number */}
        <Text position={[1, -1.3, 0.02]} fontSize={0.08} color="gray" anchorX="center" anchorY="middle">
          {currentPage + 1} / {pages.length}
        </Text>

        {/* Turn Page Indicator */}
        {isDragging && (
          <Text position={[0, -1, 0.02]} fontSize={0.1} color="red" anchorX="center" anchorY="middle">
            {currentPage > 0 ? "← PREV" : ""} {currentPage < pages.length - 1 ? "NEXT →" : ""}
          </Text>
        )}
      </group>

      {/* Next Page Preview (slightly visible) */}
      {isOpen && currentPage < pages.length - 1 && (
        <group position={[0.08, 0, 0.005]} rotation={[0, 0, 0.04]}>
          <Plane args={[2.3, 3]}>
            <meshStandardMaterial color="#f8f8f8" transparent opacity={0.8} />
          </Plane>
          <Text
            position={[0, 1.2, 0.01]}
            fontSize={0.2}
            color="gray"
            anchorX="center"
            anchorY="middle"
            font="/fonts/impact.woff"
            fontWeight="bold"
          >
            {pages[currentPage + 1]?.title || ""}
          </Text>
        </group>
      )}

      {/* Book Spine */}
      <Box args={[0.25, 3.2, 0.25]} position={[-1.25, 0, -0.125]}>
        <meshStandardMaterial color="#1a1a1a" />
      </Box>

      {/* Spine Text */}
      <Text
        position={[-1.25, 0, 0.13]}
        fontSize={0.12}
        color="white"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
        font="/fonts/impact.woff"
        fontWeight="bold"
      >
        DIGITAL CANVAS
      </Text>

      {/* Instructions (when closed) */}
      {!isOpen && (
        <Text position={[0, -2, 0]} fontSize={0.1} color="black" anchorX="center" anchorY="middle" textAlign="center">
          CLICK TO OPEN
          {"\n"}
          DRAG TO TURN PAGES
        </Text>
      )}

      {/* Page turning hint */}
      {isOpen && !isDragging && (
        <Text position={[0, -1.8, 0]} fontSize={0.08} color="gray" anchorX="center" anchorY="middle" textAlign="center">
          DRAG LEFT/RIGHT TO TURN PAGES
        </Text>
      )}
    </group>
  )
}
