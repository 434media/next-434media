"use client"

import { useEffect, useState } from "react"
import { FadeIn } from "../FadeIn"
import { FloatingElements } from "./FloatingElements"
import { HeroVideoSection } from "./HeroVideoSection"
import { SessionsSection } from "./SessionsSection"
import { EventCarousel } from "./EventCarousel"
import { SDOHMission } from "./SDOHMission"
import { SpeakersSection } from "./SpeakersSection"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

export interface SDOHHeroProps {
  locale: Locale
  dict?: Dictionary
}

export default function SDOHHero({ locale = "en", dict }: SDOHHeroProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
      setPrefersReducedMotion(mediaQuery.matches)

      const handleChange = () => setPrefersReducedMotion(mediaQuery.matches)
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  // Company logos
  const companyLogos = {
    "434 MEDIA": "https://ampd-asset.s3.us-east-2.amazonaws.com/434media.svg",
    "Emerge and Rise": "https://ampd-asset.s3.us-east-2.amazonaws.com/WY%2Blogo.png",
    "The SAVE Clinic": "https://ampd-asset.s3.us-east-2.amazonaws.com/save-nobg.png",
    "Tabiat Research": "https://ampd-asset.s3.us-east-2.amazonaws.com/tabiat.svg",
  }

  // Create a default dictionary for fallbacks
  const defaultDict = {
    sdoh: {
      mission: {
        description1:
          "This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how we can address SDOH in the Rio Grande Valley.",
        description2:
          "We'll explore how technology, community engagement, and cross-sector collaboration can create sustainable solutions to improve health outcomes for all residents.",
        hashtags: "#innovation #healthcare #community",
      },
      sessions: {
        viewSession: "View Session",
        comingSoon: "Coming Soon",
        comingSoonDescription:
          "This video will be available after the event. Check back later to watch the full session.",
        visitWebsite: "Visit Website",
        downloadSlides: "Download Slides",
        close: "Close",
        sessionId: "Session ID",
        card1: {
          title: "Market Analysis and Value Delivery",
          description:
            "Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024 MHM Accelerator Cohort Champion",
        },
        card2: {
          title: "Legal Considerations for Raising Capital",
          description:
            "Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI",
        },
        card3: {
          title: "The Perfect Pitch",
          description:
            "Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc., Capital Factory",
        },
      },
      hero: {
        subtitle: "Understanding the Social Determinants of Health and What It Means to",
        description:
          "Join us for an insightful exploration of how social, economic, and environmental factors shape health outcomes in our communities.",
        cta1: "Learn More",
        cta2: "Watch Sessions",
      },
    },
  }

  // Merge the provided dictionary with defaults and ensure string types
  const mergedDict = {
    ...defaultDict,
    sdoh: {
      ...defaultDict.sdoh,
      ...(dict?.sdoh || {}),
    },
  }

  // Helper function to safely get string values from dictionary
  const getDictValue = (path: string, fallback: string): string => {
    const keys = path.split(".")
    let value: any = mergedDict

    for (const key of keys) {
      value = value?.[key]
    }

    return typeof value === "string" ? value : fallback
  }

  return (
    <>
      {/* Hero Video Section */}
      <HeroVideoSection prefersReducedMotion={prefersReducedMotion} />

      {/* Mission Statement Section */}
      <SDOHMission locale={locale} dict={mergedDict} />

      {/* Seminar & Speaker Series Section - Enhanced presentation with mobile fixes */}
      <section className="py-16 sm:py-24 relative overflow-hidden bg-gradient-to-br from-neutral-50 via-white to-cyan-50/30">
        {/* Enhanced background elements */}
        <FloatingElements />

        {/* RGV Startup Week Badge - Fixed positioning for mobile */}
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 md:transform md:translate-x-1/4 z-20">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full animate-pulse opacity-20 blur-lg"></div>
            <div className="absolute inset-1 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-2xl border-2 border-white/50 backdrop-blur-sm">
              <div className="text-center p-1 sm:p-2">
                <p className="text-[8px] sm:text-xs font-bold text-yellow-900 uppercase tracking-wider">Part of</p>
                <p className="text-[10px] sm:text-sm md:text-base font-black text-neutral-900 leading-tight">
                  RGV STARTUP
                </p>
                <p className="text-[10px] sm:text-sm md:text-base font-black text-neutral-900 leading-tight">WEEK</p>
                <p className="text-[8px] sm:text-xs font-medium text-yellow-900">2025</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
          {/* Section Header - Enhanced for seminar series with mobile font fixes */}
          <FadeIn>
            <div className="text-center mb-16 relative">
              <div className="inline-block relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-yellow-500/10 to-cyan-500/10 blur-3xl rounded-full scale-150"></div>
                <div className="relative bg-white/80 backdrop-blur-sm px-6 sm:px-8 py-4 rounded-2xl border border-cyan-200/50 shadow-xl">
                  <p className="text-xs sm:text-sm font-semibold text-cyan-600 uppercase tracking-wider mb-2">
                    {locale === "es" ? "Serie de Seminarios y Oradores" : "Seminar & Speaker Series"}
                  </p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-cyan-600 to-yellow-500 mb-4">
                    ¿Que es SDOH?
                  </h2>
                  {/* Fixed Y-O-U text to prevent line breaks */}
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-neutral-700 whitespace-nowrap">
                    And What It Means to{" "}
                    <span className="inline-block font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-cyan-500">
                      Y-O-U!
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Two Column Layout - Panel Discussion and Event Carousel with Equal Heights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-stretch mb-16">
            {/* Left Column - Panel Description with Fixed Height */}
            <FadeIn>
              <div className="h-full lg:h-[600px] bg-white/90 backdrop-blur-sm p-8 md:p-10 rounded-3xl border border-cyan-200/50 shadow-2xl relative overflow-hidden flex flex-col">
                {/* Decorative corner elements */}
                <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-br-full"></div>
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-yellow-500/20 to-transparent rounded-tl-full"></div>

                {/* Content */}
                <div className="relative z-10 flex-1 flex flex-col">
                  <div className="mb-8">
                    <div className="inline-flex items-center bg-gradient-to-r from-cyan-100 to-cyan-50 px-4 py-2 rounded-full border border-cyan-200 mb-6">
                      <div className="w-3 h-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full mr-3 animate-pulse"></div>
                      <span className="text-cyan-800 font-semibold text-sm">
                        {locale === "es" ? "Panel de Discusión" : "Panel Discussion"}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center space-y-8">
                    <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed font-medium">
                      {getDictValue(
                        "sdoh.mission.description1",
                        "This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how we can address SDOH in the Rio Grande Valley.",
                      )}
                    </p>

                    <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed font-medium">
                      {getDictValue(
                        "sdoh.mission.description2",
                        "We'll explore how technology, community engagement, and cross-sector collaboration can create sustainable solutions to improve health outcomes for all residents.",
                      )}
                    </p>

                    <div className="flex flex-wrap gap-3">
                      {["#innovation", "#healthcare", "#community"].map((tag, index) => (
                        <span
                          key={tag}
                          className="inline-block px-4 py-2 bg-gradient-to-r from-neutral-100 to-neutral-50 text-neutral-700 rounded-lg text-sm font-medium border border-neutral-200 hover:border-cyan-300 transition-all duration-300"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Right Column - Enhanced Event Carousel with Matching Height */}
            <FadeIn>
              <div className="relative">
                {/* Enhanced decorative elements */}
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-2xl animate-pulse"></div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-tl from-yellow-500/20 to-transparent rounded-full blur-2xl animate-pulse"></div>

                {/* Event Carousel Component with video integration */}
                <EventCarousel />
              </div>
            </FadeIn>
          </div>
        </div>

        {/* Speakers Section - Full Width Outside Grid */}
        <div className="container px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
          <SpeakersSection companyLogos={companyLogos} />
        </div>
      </section>

      {/* Sessions Section */}
      <SessionsSection dict={mergedDict} />
    </>
  )
}
