"use client"

import { useRef, useState } from "react"
import { motion, useInView, AnimatePresence } from "motion/react"
import { ImpactStatistic } from "./SectionTransition"
import type { Locale } from "../../../i18n-config"

interface SDOHImpactStatsProps {
  locale: Locale
}

/**
 * SDOHImpactStats - Impact report statistics section with PDF download
 * 
 * Displays key metrics from the Community Health Accelerator program Year 2
 * with animated counters and decorative wave background.
 * Updated with MHMxVelocity Impact Report brand colors and statistics.
 * 
 * Email capture required before download - saves to Firestore with Mailchimp tags.
 */
export default function SDOHImpactStats({ locale }: SDOHImpactStatsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [isDownloading, setIsDownloading] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState("")
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Year 2 Impact Report Statistics
  const stats = locale === "es" ? [
    { value: 7, label: "Sesiones", suffix: "", prefix: "", colorScheme: "magenta" as const },
    { value: 969, label: "Miles de Vistas", suffix: "K+", prefix: "", colorScheme: "orange" as const },
    { value: 1600, label: "Participantes", suffix: "+", prefix: "", colorScheme: "magenta" as const },
    { value: 403, label: "Cuentas Alcanzadas", suffix: "K+", prefix: "", colorScheme: "orange" as const },
  ] : [
    { value: 7, label: "Sessions", suffix: "", prefix: "", colorScheme: "magenta" as const },
    { value: 969, label: "Thousand Views", suffix: "K+", prefix: "", colorScheme: "orange" as const },
    { value: 1600, label: "Participants", suffix: "+", prefix: "", colorScheme: "magenta" as const },
    { value: 403, label: "Accounts Reached", suffix: "K+", prefix: "", colorScheme: "orange" as const },
  ]

  const content = locale === "es" ? {
    badge: "REPORTE DE IMPACTO",
    title: "Impacto del Año 2",
    subtitle: "Cuando la conciencia impulsa la innovación, las comunidades prosperan",
    buttonText: "Descargar PDF del Reporte",
    downloadingText: "Descargando...",
    fileSize: "PDF • 8.4 MB",
    modalTitle: "Descarga el Reporte de Impacto",
    modalSubtitle: "Ingresa tu email para recibir el PDF",
    emailPlaceholder: "tu@email.com",
    subscribeLabel: "Suscríbete al boletín de SDOH",
    submitButton: "Descargar Reporte",
    submittingText: "Procesando...",
    emailRequired: "Por favor ingresa un email válido",
    close: "Cerrar",
  } : {
    badge: "IMPACT REPORT",
    title: "Year 2 Impact",
    subtitle: "When awareness drives innovation, communities thrive",
    buttonText: "Download Report PDF",
    downloadingText: "Downloading...",
    fileSize: "PDF • 8.4 MB",
    modalTitle: "Download Impact Report",
    modalSubtitle: "Enter your email to receive the PDF",
    emailPlaceholder: "you@email.com",
    subscribeLabel: "Subscribe to SDOH newsletter updates",
    submitButton: "Download Report",
    submittingText: "Processing...",
    emailRequired: "Please enter a valid email",
    close: "Close",
  }

  // API routes
  const emailApiUrl = "/api/sdoh-impact-report"
  const downloadApiUrl = "/api/download-impact-report"

  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Open email modal when user clicks download
  const handleDownloadClick = () => {
    setShowEmailModal(true)
    setEmailError(null)
  }

  // Validate email format
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Handle email submission and trigger download
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isValidEmail(email)) {
      setEmailError(content.emailRequired)
      return
    }

    setIsSubmitting(true)
    setEmailError(null)

    try {
      // Save email to Firestore and Mailchimp
      const emailResponse = await fetch(emailApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subscribeToNewsletter,
        }),
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save email")
      }

      // Close modal and start download
      setShowEmailModal(false)
      setEmail("")
      
      // Now download the PDF
      await handleActualDownload()

    } catch (error) {
      console.error("Email submission error:", error)
      setEmailError(locale === "es" 
        ? "Error al procesar. Intenta de nuevo." 
        : "Error processing. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Actual PDF download
  const handleActualDownload = async () => {
    setIsDownloading(true)
    setDownloadError(null)
    try {
      const response = await fetch(downloadApiUrl)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "Download failed")
      }
      
      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/pdf")) {
        throw new Error("PDF file is not currently available")
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
      console.error("Download error:", error)
      setDownloadError(locale === "es" 
        ? "PDF no disponible temporalmente" 
        : "PDF temporarily unavailable")
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
        {/* Section Header */}
        <motion.div
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center px-4 py-2 bg-white/10 text-white text-sm font-bold tracking-wider mb-6">
            <div className="w-2 h-2 bg-[#FF6B35] rounded-full mr-3" />
            {content.badge}
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4">
            {content.title}
          </h2>
          
          <div className="mx-auto w-24 h-1 bg-[#FF6B35] mb-6" />
          
          <p className="text-lg sm:text-xl text-white/70 max-w-3xl mx-auto">
            {content.subtitle}
          </p>
        </motion.div>

        {/* Stats Grid - Fixed sizing */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              <div className="relative p-4 sm:p-6 bg-white border border-neutral-200 h-full min-h-[140px] sm:min-h-[160px] flex flex-col justify-center">
                {/* Accent corner */}
                <div className={`absolute top-0 left-0 w-2 h-2 sm:w-3 sm:h-3 ${stat.colorScheme === "magenta" ? "bg-[#A31545]" : "bg-[#FF6B35]"}`} />
                
                <ImpactStatistic
                  value={stat.value}
                  label={stat.label}
                  suffix={stat.suffix}
                  prefix={stat.prefix || ""}
                  colorScheme={stat.colorScheme}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Download Button */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <motion.button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-white text-[#A31545] font-bold text-base sm:text-lg hover:bg-[#FF6B35] hover:text-white transition-all duration-300 group disabled:opacity-70 disabled:cursor-wait"
            whileHover={{ scale: isDownloading ? 1 : 1.02 }}
            whileTap={{ scale: isDownloading ? 1 : 0.98 }}
          >
            {isDownloading ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {isDownloading ? content.downloadingText : content.buttonText}
            {!isDownloading && (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </motion.button>

          {/* File size indicator or error message */}
          {downloadError ? (
            <p className="text-[#FF6B35] text-sm mt-3 font-medium">
              {downloadError}
            </p>
          ) : (
            <p className="text-white/50 text-sm mt-3">
              {content.fileSize}
            </p>
          )}
        </motion.div>
      </div>

      {/* Email Capture Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailModal(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative bg-white w-full max-w-md p-6 sm:p-8 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowEmailModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-label={content.close}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Accent corner */}
              <div className="absolute top-0 left-0 w-16 h-1 bg-[#A31545]" />
              <div className="absolute top-0 left-0 w-1 h-16 bg-[#A31545]" />

              {/* Modal content */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                  {content.modalTitle}
                </h3>
                <p className="text-neutral-600">
                  {content.modalSubtitle}
                </p>
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={content.emailPlaceholder}
                    className="w-full px-4 py-3 border border-neutral-300 focus:border-[#A31545] focus:ring-2 focus:ring-[#A31545]/20 outline-none transition-colors text-neutral-900"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  {emailError && (
                    <p className="text-red-500 text-sm mt-1">{emailError}</p>
                  )}
                </div>

                {/* Newsletter subscription checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={subscribeToNewsletter}
                      onChange={(e) => setSubscribeToNewsletter(e.target.checked)}
                      className="sr-only"
                      disabled={isSubmitting}
                    />
                    <div className={`w-5 h-5 border-2 transition-colors ${
                      subscribeToNewsletter 
                        ? "bg-[#A31545] border-[#A31545]" 
                        : "border-neutral-300 group-hover:border-neutral-400"
                    }`}>
                      {subscribeToNewsletter && (
                        <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-neutral-600 leading-tight">
                    {content.subscribeLabel}
                  </span>
                </label>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#A31545] text-white font-bold hover:bg-[#8B1E3F] transition-colors disabled:opacity-70 disabled:cursor-wait"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {content.submittingText}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {content.submitButton}
                    </>
                  )}
                </button>
              </form>

              {/* Bottom accent */}
              <div className="absolute bottom-0 right-0 w-16 h-1 bg-[#FF6B35]" />
              <div className="absolute bottom-0 right-0 w-1 h-16 bg-[#FF6B35]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
