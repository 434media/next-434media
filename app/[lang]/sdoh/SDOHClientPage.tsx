"use client"

import { useEffect } from "react"
import { useLanguage } from "@/app/context/language-context"
import SDOHHero from "../../components/sdoh/SDOHHero"
import SDOHImpactMessage from "../../components/sdoh/SDOHImpactMessage"
import SDOHStartupBootcamp from "../../components/sdoh/SDOHStartupBootcamp"
import SDOHHealthAccelerator from "../../components/sdoh/SDOHHealthAccelerator"
import SDOHNewsletter from "../../components/sdoh/SDOHNewsletter"
import SDOHLanguageToggle from "./SDOHLanguageToggle"
import { BackToTop } from "../../components/BackToTop"
import Script from "next/script"
import { AnimatePresence, motion } from "motion/react"

export default function SDOHClientPage() {
  const { dictionary, currentLocale, isLoading } = useLanguage()

  // Scroll to top on initial load
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={currentLocale}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.8 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col min-h-screen relative"
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
              <svg
                className="animate-spin h-5 w-5 text-cyan-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-cyan-800 font-medium">
                {currentLocale === "en" ? "Changing language..." : "Cambiando idioma..."}
              </span>
            </div>
          </div>
        )}

        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
        >
          {currentLocale === "en" ? "Skip to main content" : "Saltar al contenido principal"}
        </a>

        {/* Language Toggle */}
        <SDOHLanguageToggle showOnScroll={true} />

        {/* Hero Section */}
        <SDOHHero locale={currentLocale} dict={dictionary} />

        {/* Main content */}
        <div id="main-content" className="outline-none" tabIndex={-1}>
          <section className="py-16 bg-gradient-to-b from-white via-cyan-50/30 to-white">
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
              <div className="relative">
                {/* Background decorative elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                  <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/5 blur-3xl"></div>
                  <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-yellow-500/5 blur-3xl"></div>
                  <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-cyan-500/5 blur-3xl"></div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                  {/* Startup Bootcamp Section */}
                  <SDOHStartupBootcamp locale={currentLocale} dict={dictionary} />

                  {/* Community Health Accelerator Section */}
                  <SDOHHealthAccelerator locale={currentLocale} dict={dictionary} />

                  {/* Wow Impact Message Section */}
                  <SDOHImpactMessage locale={currentLocale} dict={dictionary} />

                  <div className="container mx-auto px-4 sm:px-6 max-w-5xl mb-16 sm:mb-24">
                    {/* Newsletter Section - Enhanced with better visibility */}
                    <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl p-8 sm:p-10 md:p-16 shadow-xl relative overflow-hidden">
                      {/* Accent elements */}
                      <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-cyan-500 to-cyan-700"></div>
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>

                      <div className="relative z-10">
                        <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-10">
                          <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-4 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300">
                            {dictionary?.sdoh?.newsletter?.title || 'Signup for "Que es SDOH" newsletter'}
                          </h2>
                          <p className="text-base sm:text-lg md:text-xl text-white/90 leading-relaxed">
                            {dictionary?.sdoh?.newsletter?.subtitle || "Join the conversation now."}
                          </p>
                        </div>
                        <div className="max-w-xl mx-auto">
                          <SDOHNewsletter locale={currentLocale} dict={dictionary} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Back to top button */}
        <BackToTop />

        <Script
          id="event-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Event",
              name: "¿Qué es SDOH? Panel Discussion",
              description:
                "Join us for a panel discussion on Social Determinants of Health (SDOH) during RGV Startup Week. Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.",
              startDate: "2025-04-28T13:00:00-05:00",
              endDate: "2025-04-28T13:45:00-05:00",
              location: {
                "@type": "Place",
                name: "eBridge Center",
                address: {
                  "@type": "PostalAddress",
                  streetAddress: "1304 E Adams St",
                  addressLocality: "Brownsville",
                  addressRegion: "TX",
                  postalCode: "78520",
                  addressCountry: "US",
                },
              },
              organizer: {
                "@type": "Organization",
                name: "434 Media",
                url: "https://434media.com",
              },
              performer: [
                {
                  "@type": "Person",
                  name: "Marcos Resendez",
                  jobTitle: "CEO",
                  worksFor: {
                    "@type": "Organization",
                    name: "434 Media",
                  },
                },
                {
                  "@type": "Person",
                  name: "Lina Rugova",
                  jobTitle: "Founder",
                  worksFor: {
                    "@type": "Organization",
                    name: "Emerge and Rise",
                  },
                },
                {
                  "@type": "Person",
                  name: "Lyssa Ochoa",
                  jobTitle: "Founder & Vascular Surgeon",
                  worksFor: {
                    "@type": "Organization",
                    name: "The SAVE Clinic",
                  },
                },
                {
                  "@type": "Person",
                  name: "Daniyal Liaqat",
                  jobTitle: "CEO & Co-Founder",
                  worksFor: {
                    "@type": "Organization",
                    name: "Tabiat Research",
                  },
                },
              ],
            }),
          }}
        />
      </motion.main>
    </AnimatePresence>
  )
}
