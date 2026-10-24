import type React from "react"
import { geistPixelSquare } from "@/lib/fonts/geist-pixel"

// Workshop pages moved here from the Digital Canvas site in 2026-10 keep its
// display face, loaded for these pages only.
export default function WorkshopsLayout({ children }: { children: React.ReactNode }) {
  return <div className={geistPixelSquare.variable}>{children}</div>
}
