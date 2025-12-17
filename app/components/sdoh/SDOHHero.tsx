"use client"

import { useEffect, useState } from "react"
import { FadeIn } from "../FadeIn"
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

      {/* Seminar & Speaker Series Section - Clean design */}
      <section className="py-20 sm:py-28 lg:py-32 relative overflow-hidden bg-white">
        <div className="container px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
          {/* Section Header */}
          <FadeIn>
            <div className="text-center mb-16 relative">
              <div className="inline-block relative">
                <div className="relative px-6 sm:px-8 py-4">
                  <p className="text-xs sm:text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    {locale === "es" ? "Serie de Seminarios y Oradores" : "Seminar & Speaker Series"}
                  </p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 mb-4">
                    ¿Que es SDOH?
                  </h2>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-neutral-700 whitespace-nowrap">
                    And What It Means to{" "}
                    <span className="inline-block font-black text-cyan-600">
                      Y-O-U!
                    </span>
                  </p>
                  {/* Accent underline */}
                  <div className="mt-4 mx-auto w-24 h-1 bg-yellow-400"></div>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Two Column Layout - Panel Discussion and Event Carousel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-stretch mb-16">
            {/* Left Column - Panel Description */}
            <FadeIn>
              <div className="h-full lg:h-[600px] bg-white p-8 md:p-10 border border-neutral-200 relative flex flex-col">
                {/* Accent line */}
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>

                {/* Content */}
                <div className="relative z-10 flex-1 flex flex-col pl-4">
                  <div className="mb-8">
                    <div className="inline-flex items-center bg-neutral-100 px-4 py-2 border border-neutral-200 mb-6">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full mr-3"></div>
                      <span className="text-neutral-800 font-semibold text-sm">
                        {locale === "es" ? "Panel de Discusión" : "Panel Discussion"}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center space-y-8">
                    <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed">
                      {getDictValue(
                        "sdoh.mission.description1",
                        "This panel brings together healthcare innovators, entrepreneurs, and community leaders to discuss how we can address SDOH in the Rio Grande Valley.",
                      )}
                    </p>

                    <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed">
                      {getDictValue(
                        "sdoh.mission.description2",
                        "We'll explore how technology, community engagement, and cross-sector collaboration can create sustainable solutions to improve health outcomes for all residents.",
                      )}
                    </p>

                    <div className="flex flex-wrap gap-3">
                      {["#innovation", "#healthcare", "#community"].map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium border border-neutral-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Right Column - Event Carousel */}
            <FadeIn>
              <div className="relative">
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
