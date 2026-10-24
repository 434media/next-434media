import type React from "react"
import { geistPixelSquare } from "@/lib/fonts/geist-pixel"

// The Feed moved here from the Digital Canvas site in 2026-10. It keeps that
// brand's display face, loaded for these pages only.
export default function TheFeedLayout({ children }: { children: React.ReactNode }) {
  return <div className={geistPixelSquare.variable}>{children}</div>
}
