"use client"

import { useEffect } from "react"
import { useLanguage } from "@/app/context/language-context"
import SDOHHero from "../../components/sdoh/SDOHHero"
import SDOHImpactMessage from "../../components/sdoh/SDOHImpactMessage"
import SDOHStartupBootcamp from "../../components/sdoh/SDOHStartupBootcamp"
import SDOHHealthAccelerator from "../../components/sdoh/SDOHHealthAccelerator"
import SDOHLanguageToggle from "./SDOHLanguageToggle"
import { SectionTransition, SectionDivider } from "../../components/sdoh/SectionTransition"
import SDOHImpactStats from "../../components/sdoh/SDOHImpactStats"
import SDOHPillars from "../../components/sdoh/SDOHPillars"
import AcceleratorWinner from "../../components/sdoh/AcceleratorWinner"
import ImpactReportDownload from "../../components/sdoh/ImpactReportDownload"
import Script from "next/script"

export default function SDOHClientPage() {
  const { dictionary, currentLocale, isLoading } = useLanguage()

  // Scroll to top on initial load
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <main className="flex flex-col min-h-screen relative bg-white">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-neutral-900 rounded-full animate-pulse"></div>
            <span className="text-neutral-900 font-medium">
              {currentLocale === "en" ? "Loading..." : "Cargando..."}
            </span>
          </div>
        </div>
      )}

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-neutral-900 focus:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
      >
        {currentLocale === "en" ? "Skip to main content" : "Saltar al contenido principal"}
      </a>

      {/* Language Toggle */}
      <SDOHLanguageToggle showOnScroll={true} />

      {/* Hero Section */}
      <SDOHHero locale={currentLocale} dict={dictionary} />

      {/* Main content */}
      <div id="main-content" className="outline-none" tabIndex={-1}>
        {/* LEAD WITH IMPACT - Year 2 Highlights to hook viewers immediately */}
        <SDOHImpactStats locale={currentLocale} />

        {/* Section Divider - Transition from Stats to Framework */}
        <SectionDivider variant="connector" colorScheme="magenta" />

        {/* Three Pillars Section - Show the Learn/Build/Sustain framework */}
        <SDOHPillars locale={currentLocale} />

        {/* Section Divider - Transition to Programs */}
        <SectionDivider variant="double" colorScheme="mixed" />

        <section className="py-20 sm:py-28 lg:py-32 bg-white relative overflow-hidden">
          {/* Startup Bootcamp Section - First program */}
          <SectionTransition variant="wave" colorScheme="magenta" maxWidth="6xl" className="px-4 sm:px-6 lg:px-8">
            <SDOHStartupBootcamp locale={currentLocale} dict={dictionary} />
          </SectionTransition>

          {/* Section Divider between Bootcamp and Accelerator */}
          <SectionDivider variant="double" colorScheme="magenta" />

          {/* Community Health Accelerator Section - Second program */}
          <SectionTransition variant="wave" colorScheme="orange" maxWidth="6xl" className="px-4 sm:px-6 lg:px-8">
            <SDOHHealthAccelerator locale={currentLocale} dict={dictionary} />
          </SectionTransition>
        </section>

        {/* 2025 Accelerator Winner - Success Story Spotlight */}
        <AcceleratorWinner locale={currentLocale} />

        {/* Impact Report PDF Download - CTA to dive deeper */}
        <ImpactReportDownload locale={currentLocale} />

        {/* Section Divider - Transition to Final CTA */}
        <SectionDivider variant="connector" colorScheme="orange" />

        {/* Combined Impact Message + Newsletter Section - Close with CTA */}
        <SDOHImpactMessage locale={currentLocale} dict={dictionary} />
      </div>

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
    </main>
  )
}
