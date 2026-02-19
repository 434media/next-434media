"use client"

import { useRef, useEffect, useCallback } from "react"

interface Strand {
  angle: number
  length: number
  baseLength: number
  dotPosition: number
  dotRadius: number
  speed: number
  hue: number
  saturation: number
  lightness: number
  opacity: number
  thickness: number
  offsetX: number
  offsetY: number
  phase: number
}

export default function DataViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const strandsRef = useRef<Strand[]>([])
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const dimensionsRef = useRef({ w: 0, h: 0 })

  const createStrands = useCallback((width: number, height: number) => {
    const strands: Strand[] = []
    const count = Math.min(280, Math.max(120, Math.floor(width / 4)))

    for (let i = 0; i < count; i++) {
      // Distribute evenly across full 180° arc (left edge to right edge)
      const t = i / (count - 1)
      // Angle from straight-left (π) to straight-right (0), passing through straight-up (π/2)
      const angle = Math.PI * (1 - t)

      const baseLength = height * (0.4 + Math.random() * 0.55)

      // Color: outer strands are deeper indigo/violet, center strands lighter cyan/blue
      const centerDist = Math.abs(t - 0.5) * 2 // 0 at center, 1 at edges
      const hueBase = 230 - centerDist * 30 + Math.random() * 25 // center: ~230 blue, edges: ~200 indigo/violet
      const satBase = 55 + centerDist * 25 + Math.random() * 15
      const lightBase = 70 - centerDist * 20 + Math.random() * 15

      strands.push({
        angle,
        length: baseLength,
        baseLength,
        dotPosition: 0.25 + Math.random() * 0.55,
        dotRadius: 1 + Math.random() * 2.5,
        speed: 0.15 + Math.random() * 0.6,
        hue: hueBase,
        saturation: satBase,
        lightness: lightBase,
        opacity: 0.12 + Math.random() * 0.35,
        thickness: 0.3 + Math.random() * 0.9,
        offsetX: 0,
        offsetY: 0,
        phase: Math.random() * Math.PI * 2,
      })
    }
    return strands
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dimensionsRef.current = { w: rect.width, h: rect.height }
      strandsRef.current = createStrands(rect.width, rect.height)
    }

    resize()
    window.addEventListener("resize", resize)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches[0]
      if (touch) {
        mouseRef.current = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        }
      }
    }

    const handleLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseleave", handleLeave)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true })
    canvas.addEventListener("touchend", handleLeave)

    const draw = () => {
      const { w, h } = dimensionsRef.current
      if (w === 0 || h === 0) {
        animationRef.current = requestAnimationFrame(draw)
        return
      }

      const originX = w / 2
      const originY = h + 20
      const mouse = mouseRef.current
      const time = timeRef.current

      ctx.clearRect(0, 0, w, h)

      const strands = strandsRef.current
      const interactionRadius = 200

      for (let i = 0; i < strands.length; i++) {
        const s = strands[i]
        const t = time * s.speed

        // Idle sway
        const idleSwayX = Math.sin(t * 0.35 + s.phase) * 3
        const idleSwayY = Math.cos(t * 0.25 + s.phase * 1.3) * 1.5

        // End point: angle 0 = right, π/2 = up, π = left
        const baseEndX = originX + Math.cos(s.angle) * s.baseLength
        const baseEndY = originY - Math.sin(s.angle) * s.baseLength

        // Mouse interaction along the entire strand, not just the tip
        // Check multiple points along the strand for interaction
        let pushX = 0
        let pushY = 0
        let extraGlow = 0

        for (let sample = 0.3; sample <= 1.0; sample += 0.2) {
          const sampleX = originX + (baseEndX - originX) * sample
          const sampleY = originY + (baseEndY - originY) * sample
          const dx = mouse.x - sampleX
          const dy = mouse.y - sampleY
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < interactionRadius) {
            const force = 1 - dist / interactionRadius
            const forceCubed = force * force * force
            pushX += -dx * forceCubed * 35 * sample
            pushY += -dy * forceCubed * 25 * sample
            extraGlow = Math.max(extraGlow, forceCubed)
          }
        }

        // Lerp offsets
        const targetOffsetX = idleSwayX + pushX
        const targetOffsetY = idleSwayY + pushY
        s.offsetX += (targetOffsetX - s.offsetX) * 0.06
        s.offsetY += (targetOffsetY - s.offsetY) * 0.06

        // Final end point
        const endX = baseEndX + s.offsetX
        const endY = baseEndY + s.offsetY

        // Control point for natural curve
        const midX = (originX + endX) / 2 + s.offsetX * 0.35
        const midY = (originY + endY) / 2 + s.offsetY * 0.35

        // Draw strand
        const alpha = s.opacity + extraGlow * 0.45
        const lightness = s.lightness + extraGlow * 18
        ctx.beginPath()
        ctx.moveTo(originX, originY)
        ctx.quadraticCurveTo(midX, midY, endX, endY)
        ctx.strokeStyle = `hsla(${s.hue}, ${s.saturation}%, ${lightness}%, ${alpha})`
        ctx.lineWidth = s.thickness + extraGlow * 1.5
        ctx.stroke()

        // Draw dot along curve
        const dotT = s.dotPosition + Math.sin(t * 0.5 + s.phase) * 0.04
        const dotX = (1 - dotT) * (1 - dotT) * originX + 2 * (1 - dotT) * dotT * midX + dotT * dotT * endX
        const dotY = (1 - dotT) * (1 - dotT) * originY + 2 * (1 - dotT) * dotT * midY + dotT * dotT * endY

        const dotAlpha = 0.45 + extraGlow * 0.55
        const dotSize = s.dotRadius + extraGlow * 3

        ctx.beginPath()
        ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue}, ${s.saturation + 10}%, ${Math.min(lightness + 10, 88)}%, ${dotAlpha})`
        ctx.fill()

        // Glow
        if (extraGlow > 0.08) {
          ctx.beginPath()
          ctx.arc(dotX, dotY, dotSize * 3, 0, Math.PI * 2)
          const gradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotSize * 3)
          gradient.addColorStop(0, `hsla(${s.hue}, 80%, 72%, ${extraGlow * 0.3})`)
          gradient.addColorStop(1, `hsla(${s.hue}, 80%, 72%, 0)`)
          ctx.fillStyle = gradient
          ctx.fill()
        }
      }

      timeRef.current += 0.016
      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener("resize", resize)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseleave", handleLeave)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("touchend", handleLeave)
    }
  }, [createStrands])

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-64 sm:h-80 md:h-100 lg:h-125 xl:h-150"
      style={{ touchAction: "pan-y" }}
      aria-hidden="true"
    />
  )
}
