"use client"

import { useState } from "react"
import { motion } from "motion/react"

interface PDFExportButtonProps {
  targetSelector?: string // CSS selector for the main analytics container
  filename?: string
  variant?: "icon" | "full"
  contextLabel?: string // e.g., GA4, Instagram, Mailchimp
  fallbackColor?: string // solid color used to replace unsupported gradients
}

export function PDFExportButton({
  targetSelector = "#analytics-root",
  filename = "analytics-report.pdf",
  variant = "icon",
  contextLabel = "Analytics",
  fallbackColor = "#0f0f17",
}: PDFExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    try {
      setError(null)
      setIsGenerating(true)
      const el = document.querySelector(targetSelector) as HTMLElement | null
      if (!el) {
        throw new Error("Analytics container not found")
      }

      // Dynamic imports (avoid SSR / type resolution issues)
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ])

      // Pre-capture style sanitation for unsupported CSS color functions (e.g., oklch in Tailwind v4)
      const mutated: Array<{ node: HTMLElement; bgImage: string; bgColor: string }> = []
      const all = el.querySelectorAll<HTMLElement>("*")
      all.forEach((node) => {
        const style = window.getComputedStyle(node)
        const bgImage = style.backgroundImage || ""
        const bgColor = style.backgroundColor || ""
        // html2canvas currently doesn't parse oklch() or gradients using it
        if (/oklch\(/i.test(bgImage) || /oklch\(/i.test(bgColor)) {
          mutated.push({ node, bgImage, bgColor })
          node.setAttribute("data-pdf-bgimg", bgImage)
          node.setAttribute("data-pdf-bgcol", bgColor)
          // Prefer a neutral solid fallback to maintain contrast
          node.style.backgroundImage = "none"
          node.style.backgroundColor = fallbackColor
        } else if (/linear-gradient/i.test(bgImage) && /oklch\(/i.test(bgImage)) {
          mutated.push({ node, bgImage, bgColor })
          node.setAttribute("data-pdf-bgimg", bgImage)
          node.style.backgroundImage = "none"
          node.style.backgroundColor = fallbackColor
        }
      })

      // Temporarily add a class to ensure full visibility (if scrolling)
      const previousOverflow = el.style.overflow
      el.style.overflow = "visible"

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#0f0f17",
        useCORS: true,
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      })

      el.style.overflow = previousOverflow

      // Restore mutated backgrounds
      mutated.forEach(({ node, bgImage, bgColor }) => {
        node.style.backgroundImage = bgImage && bgImage !== "none" ? bgImage : ""
        node.style.backgroundColor = bgColor
        node.removeAttribute("data-pdf-bgimg")
        node.removeAttribute("data-pdf-bgcol")
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })

      // Dimensions
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      // Add custom header
      pdf.setFillColor(18, 18, 30)
      pdf.rect(0, 0, pageWidth, 70, "F")

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(18)
      pdf.text("434 MEDIA", 40, 40)
      pdf.setFontSize(10)
      pdf.setTextColor(180, 180, 200)
      pdf.text(`${contextLabel} Snapshot • ${new Date().toLocaleString()}`, 40, 58)

      // Fit image
      const margin = 24
      const availableHeight = pageHeight - 70 - margin * 2
      const availableWidth = pageWidth - margin * 2
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight)
      const renderedWidth = imgWidth * ratio
      const renderedHeight = imgHeight * ratio
      const x = (pageWidth - renderedWidth) / 2
      const y = 70 + margin
      pdf.addImage(imgData, "PNG", x, y, renderedWidth, renderedHeight, undefined, "FAST")

      pdf.save(filename)
    } catch (e) {
  setError(e instanceof Error ? e.message : "Failed to generate PDF")
      console.error("PDF generation error", e)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <motion.button
        whileTap={{ scale: 0.95 }}
        disabled={isGenerating}
        onClick={handleDownload}
        className={`group relative inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
          variant === "icon" ? "!px-2 !py-2" : ""
        }`}
        title="Download PDF"
      >
        <span className="inline-flex items-center gap-2">
          <PDFIcon className="w-4 h-4 text-fuchsia-300" />
          {variant === "full" && (isGenerating ? "Generating..." : "Download PDF")}
        </span>
        {variant === "icon" && (
          <span className="sr-only">{isGenerating ? "Generating PDF" : "Download PDF"}</span>
        )}
      </motion.button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  )
}

function PDFIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16c0 1.1.9 2 2 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h1.5a1.5 1.5 0 010 3H9v-3z" />
      <path d="M13 16v-3h1.2a1.8 1.8 0 010 3H13z" />
      <path d="M17 16v-3h1" />
    </svg>
  )
}
