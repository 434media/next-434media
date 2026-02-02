"use client"

import { useRef, useState } from "react"
import { motion, useInView } from "motion/react"
import type { Locale } from "../../../i18n-config"

interface ImpactReportDownloadProps {
  locale: Locale
}

/**
 * ImpactReportDownload - Section to download the Year 2 Impact Report PDF
 * 
 * Provides a visually prominent call-to-action to download the full impact report.
 */
export default function ImpactReportDownload({ locale }: ImpactReportDownloadProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [isDownloading, setIsDownloading] = useState(false)

  const content = locale === "es" ? {
    eyebrow: "DESCARGAR",
    title: "Reporte de Impacto Año 2",
    subtitle: "Avanzando la Equidad en Salud a Través de la Educación, Conexión y Comunidad",
    description: "Descubre cómo el Community Health Accelerator transformó la conciencia en acción y las ideas en innovación durante el Año 2.",
    buttonText: "Descargar PDF del Reporte",
    downloadingText: "Descargando...",
    cta: "Si alguna vez te has preguntado, \"¿Qué puedo hacer para marcar la diferencia?\" — aquí es donde empiezas.",
    fileSize: "PDF • 2.4 MB",
  } : {
    eyebrow: "DOWNLOAD",
    title: "Year 2 Impact Report",
    subtitle: "Advancing Health Equity Through Education, Connection & Community",
    description: "Discover how the Community Health Accelerator transformed awareness into action and ideas into innovation during Year 2.",
    buttonText: "Download Report PDF",
    downloadingText: "Downloading...",
    cta: "If you've ever asked, \"What can I do to make a difference?\" — this is where you start.",
    fileSize: "PDF • 2.4 MB",
  }

  // API route for proxied download (avoids S3 CORS issues)
  const downloadApiUrl = "/api/download-impact-report"

  // Handle download via API route
  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch(downloadApiUrl)
      
      if (!response.ok) {
        throw new Error("Download failed")
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "MHMxVelocity_Year2_Impact_Report.pdf"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      // Fallback: try direct link (may work in some cases)
      console.error("Download error:", error)
      window.open(downloadApiUrl, "_blank")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <section ref={ref} className="py-20 sm:py-28 lg:py-32 bg-[#8B1E3F] relative overflow-hidden">
      {/* Decorative wave background */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.path
              key={i}
              d={`M ${-50 + i * 20} 0 Q ${200 - i * 30} 100, ${100 + i * 25} 200 T ${-50 + i * 20} 400`}
              fill="none"
              stroke="#A31545"
              strokeWidth={1.5 - i * 0.15}
              strokeOpacity={0.4 - i * 0.05}
              initial={{ pathLength: 0 }}
              animate={isInView ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{ duration: 1.5, delay: i * 0.1, ease: "easeOut" }}
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.path
              key={`right-${i}`}
              d={`M ${850 - i * 20} 0 Q ${600 + i * 30} 100, ${700 - i * 25} 200 T ${850 - i * 20} 400`}
              fill="none"
              stroke="#FF6B35"
              strokeWidth={1.5 - i * 0.15}
              strokeOpacity={0.3 - i * 0.04}
              initial={{ pathLength: 0 }}
              animate={isInView ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{ duration: 1.5, delay: 0.5 + i * 0.1, ease: "easeOut" }}
            />
          ))}
        </svg>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center px-4 py-2 bg-white/10 text-white text-sm font-bold tracking-wider mb-6">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {content.eyebrow}
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4">
            {content.title}
          </h2>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[#FF6B35] font-semibold mb-6">
            {content.subtitle}
          </p>

          {/* Accent line */}
          <div className="mx-auto w-24 h-1 bg-[#FF6B35] mb-8" />

          {/* Description */}
          <p className="text-lg text-white/80 leading-relaxed max-w-2xl mx-auto mb-10">
            {content.description}
          </p>

          {/* Download Button */}
          <motion.button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#A31545] font-bold text-lg hover:bg-[#FF6B35] hover:text-white transition-all duration-300 group disabled:opacity-70 disabled:cursor-wait"
            whileHover={{ scale: isDownloading ? 1 : 1.02 }}
            whileTap={{ scale: isDownloading ? 1 : 0.98 }}
          >
            {isDownloading ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {isDownloading ? content.downloadingText : content.buttonText}
            {!isDownloading && (
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </motion.button>

          {/* File size indicator */}
          <p className="text-white/50 text-sm mt-4">
            {content.fileSize}
          </p>

          {/* CTA Message */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-xl sm:text-2xl text-white font-medium leading-relaxed max-w-2xl mx-auto">
              {content.cta}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
