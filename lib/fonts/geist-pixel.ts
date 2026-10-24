import localFont from "next/font/local"

/**
 * Geist Pixel Square, self-hosted. It is the Digital Canvas display face, used
 * by The Feed and the Lead with Ops pages (moved here from the Digital Canvas
 * site in 2026-10) and loaded only by their layouts. The same file is served
 * at /fonts/GeistPixel-Square.ttf for lib/email-templates/lead-with-ops.ts.
 * SIL Open Font License; see public/fonts/GeistPixel-OFL.txt.
 */
export const geistPixelSquare = localFont({
  src: "../../public/fonts/GeistPixel-Square.ttf",
  variable: "--font-geist-pixel-square",
  display: "swap",
})
