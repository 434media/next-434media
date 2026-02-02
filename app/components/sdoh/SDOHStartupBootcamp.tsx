"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"
import { useLanguage } from "@/app/context/language-context"
import { FadeIn } from "../FadeIn"

interface SDOHStartupBootcampProps {
  locale: Locale
  dict: Dictionary
}

export default function SDOHStartupBootcamp({ locale, dict }: SDOHStartupBootcampProps) {
  const { dictionary } = useLanguage()
  const [key, setKey] = useState(0)

  useEffect(() => {
    setKey((prev) => prev + 1)
  }, [locale, dict])

  const d = dictionary?.sdoh?.bootcamp ||
    dict?.sdoh?.bootcamp || {
      title: "Startup Bootcamp",
      subtitle: "Early-Stage Program",
      description:
        "A hands-on, early-stage program that helps local entrepreneurs turn ideas into action. Participants receive guidance on business models, impact measurement, funding strategies, and how to build solutions that address real community needs.",
      keyFocus: "Key Focus:",
      keyFocusDescription:
        "Participants received hands-on mentorship, networking opportunities, and practical tools to build solutions addressing real community health needs.",
    }

  const getStringValue = (value: any): string => {
    if (typeof value === "string") return value
    return String(value || "")
  }

  return (
    <div className="space-y-16 sm:space-y-20 lg:space-y-24 py-8 sm:py-12">
      {/* Title Section */}
      <FadeIn>
        <div className="relative text-center">
          {/* Title */}
          <div className="relative max-w-4xl mx-auto">
            <p className="text-[#FF6B35] font-medium text-sm uppercase tracking-wider mb-4">
              {locale === "es" ? "Convirtiendo la Perspicacia en Acción" : "Turning Insight into Action"}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-neutral-900">
              {getStringValue(d.title)}
            </h2>
          </div>
        </div>
      </FadeIn>

      {/* Content Section - Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Text Content */}
        <FadeIn>
          <div className="order-2 md:order-1 space-y-8">
            {/* Subtitle badge */}
            <div className="inline-flex items-center px-4 py-2 bg-[#A31545]/10 border border-[#A31545]/30 text-neutral-800 text-sm font-bold">
              <div className="w-2 h-2 bg-[#A31545] rounded-full mr-3" />
              {getStringValue(d.subtitle)}
            </div>

            {/* Main description */}
            <div className="relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#A31545]" />
              <p className="text-lg text-neutral-600 leading-relaxed pl-6">
                {getStringValue(d.description)}
              </p>
            </div>

            {/* Feature highlight box */}
            <div className="relative p-6 bg-neutral-50 border border-neutral-200">
              {/* Accent line */}
              <div className="absolute left-0 top-0 w-1 h-full bg-[#FF6B35]" />
              <p className="text-base leading-relaxed text-neutral-600 pl-4">
                <span className="font-semibold text-neutral-900">{getStringValue(d.keyFocus)}</span>{" "}
                {getStringValue(d.keyFocusDescription)}
              </p>
            </div>

            {/* Year 2 Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div className="text-center p-4 bg-[#FF6B35]/10 border border-[#FF6B35]/20">
                <p className="text-2xl font-bold text-[#FF6B35]">7</p>
                <p className="text-xs text-neutral-500">{locale === "es" ? "Sesiones" : "Sessions"}</p>
              </div>
              <div className="text-center p-4 bg-[#A31545]/10 border border-[#A31545]/20">
                <p className="text-2xl font-bold text-[#A31545]">1,600+</p>
                <p className="text-xs text-neutral-500">{locale === "es" ? "Participantes" : "Participants"}</p>
              </div>
              <div className="text-center p-4 bg-[#FF6B35]/10 border border-[#FF6B35]/20">
                <p className="text-2xl font-bold text-[#FF6B35]">6</p>
                <p className="text-xs text-neutral-500">{locale === "es" ? "Ciudades" : "Cities"}</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Bootcamp Image */}
        <FadeIn>
          <div className="order-1 md:order-2 relative">
            {/* Decorative frame */}
            <div className="absolute -inset-4 border border-[#A31545]/20 -z-10" />
            <div className="absolute -inset-4 border border-[#FF6B35]/20 translate-x-2 translate-y-2 -z-10" />
            
            {/* Image container */}
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-bootcamp.jpg"
                alt="SDOH Startup Bootcamp participants group photo"
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              
              {/* Accent corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#A31545]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FF6B35]" />
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
