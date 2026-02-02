"use client"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import type { Dictionary } from "../../types/dictionary"
import { useLanguage } from "../../context/language-context"
import { VideoModal } from "./VideoModal"

interface AcceleratorDictionary {
  title: string
  subtitle: string
  description1: string
  description2: string
}

interface SDOHHealthAcceleratorProps {
  locale: Locale
  dict: Partial<Dictionary>
}

const getStringValue = (value: any): string => {
  if (typeof value === "string") return value
  return String(value || "")
}

export default function SDOHHealthAccelerator({ locale, dict }: SDOHHealthAcceleratorProps) {
  const { dictionary } = useLanguage()
  const [key, setKey] = useState(0)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const openVideoModal = useCallback(() => {
    setIsVideoModalOpen(true)
  }, [])

  const closeVideoModal = useCallback(() => {
    setIsVideoModalOpen(false)
  }, [])

  useEffect(() => {
    setKey((prev) => prev + 1)
  }, [locale, dict])

  const defaultDictionary: AcceleratorDictionary = {
    title: "Community Health Accelerator",
    subtitle: "Growth-Stage Program",
    description1:
      "For startups ready to scale, this accelerator provides deeper support—from mentoring and expert workshops to connections with healthcare systems, investors, and ecosystem partners focused on sustainable health innovation.",
    description2:
      "This program exists to answer big questions in a practical way—and to make sure the people closest to the issues have the tools, resources, and support to solve them.",
  }

  const currentDict = dictionary || dict
  const sdohDict = currentDict?.sdoh
  const d = (sdohDict?.accelerator as AcceleratorDictionary) || defaultDictionary

  const demoDayDict = sdohDict?.demoDay
  const learnMore = getStringValue(demoDayDict?.learnMore) || "Learn More About the Accelerator"

  return (
    <FadeIn key={key}>
      <div className="max-w-5xl mx-auto pt-16 sm:pt-20 lg:pt-24 mb-8 sm:mb-12 relative">
        {/* Header Section */}
        <div className="text-center mb-12 sm:mb-16 relative">
          {/* Title */}
          <div className="relative max-w-4xl mx-auto">
            <p className="text-[#FF6B35] font-medium text-sm uppercase tracking-wider mb-4">
              {locale === "es" ? "Donde la Innovación Encuentra Propósito" : "Where Innovation Meets Purpose"}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-neutral-900">
              {getStringValue(d.title)}
            </h2>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center mb-16">
          {/* Text Content */}
          <div className="order-2 md:order-1">
            <div className="mb-8">
              <div className="inline-flex items-center px-4 py-2 bg-[#FF6B35]/10 border border-[#FF6B35]/30 text-neutral-800 text-sm font-bold">
                <div className="w-2 h-2 bg-[#FF6B35] rounded-full mr-3" />
                {getStringValue(d.subtitle)}
              </div>
            </div>

            <div className="relative">
              <div className="p-8 border border-neutral-200 bg-neutral-50 relative">
                {/* Accent line */}
                <div className="absolute left-0 top-0 w-1 h-full bg-[#A31545]" />

                <p className="text-lg text-neutral-600 leading-relaxed pl-4 mb-6">
                  {getStringValue(d.description1)}
                </p>

                <p className="text-lg md:text-xl text-neutral-700 leading-relaxed pl-4 mb-8">
                  {getStringValue(d.description2)}
                </p>

                {/* Learn more link - opens video modal */}
                <div className="pl-4">
                  <button
                    onClick={openVideoModal}
                    className="inline-flex items-center text-neutral-900 hover:text-[#A31545] font-medium transition-colors duration-200"
                    aria-label="Watch the Accelerator Program Recap video"
                  >
                    {learnMore}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 ml-2"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Accelerator Image */}
          <div className="order-1 md:order-2 relative">
            {/* Decorative frame */}
            <div className="absolute -inset-4 border border-[#A31545]/20 -z-10" />
            <div className="absolute -inset-4 border border-[#FF6B35]/20 translate-x-2 translate-y-2 -z-10" />
            
            {/* Image container */}
            <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-accelerator.jpg"
                alt="SDOH Community Health Accelerator winner receiving $50,000 check"
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              
              {/* Accent corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#A31545]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FF6B35]" />
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal for Accelerator Program Recap */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={closeVideoModal}
        videoSrc="https://ampd-asset.s3.us-east-2.amazonaws.com/SDOH+ACCELERATOR+PROGRAM+RECAP_2025.mp4"
        title={locale === "es" ? "Resumen del Programa Acelerador SDOH" : "SDOH Accelerator Program Recap"}
        description={locale === "es" ? "Mira los momentos destacados del programa acelerador de salud comunitaria." : "Watch the highlights from the community health accelerator program."}
      />
    </FadeIn>
  )
}
