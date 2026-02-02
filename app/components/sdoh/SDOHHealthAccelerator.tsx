"use client"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import { useEffect, useState } from "react"
import SDOHDemoDay from "./SDOHDemoDay"
import type { Dictionary } from "../../types/dictionary"
import { useLanguage } from "../../context/language-context"

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
          {/* Component Number */}
          <div className="relative inline-block mb-8">
            <div className="relative w-20 h-20 bg-[#8B1E3F] text-white flex items-center justify-center">
              <span className="text-3xl font-black">3</span>
              {/* Accent corner */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-[#FF6B35]" />
            </div>
          </div>

          {/* Title */}
          <div className="relative max-w-4xl mx-auto">
            <p className="text-[#FF6B35] font-medium text-sm uppercase tracking-wider mb-4">
              {locale === "es" ? "Donde la Innovación Encuentra Propósito" : "Where Innovation Meets Purpose"}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6 text-neutral-900">
              {getStringValue(d.title)}
            </h2>
            {/* Accent underline */}
            <div className="mx-auto w-16 h-1 bg-[#A31545] mb-6" />
            <p className="text-lg sm:text-xl text-neutral-500 leading-relaxed max-w-3xl mx-auto">
              {locale === "es"
                ? "Innovación sostenida a través de colaboración real, mentoría e impacto medible"
                : "Sustained innovation through real-world collaboration, mentorship, and measurable impact"}
            </p>
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

                {/* Learn more link */}
                <div className="pl-4">
                  <a
                    href="https://velocitytx.org/startup-programs/support/accelerator/"
                    className="inline-flex items-center text-neutral-900 hover:text-[#A31545] font-medium transition-colors duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Learn more about the Community Health Accelerator"
                  >
                    {learnMore}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 ml-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Day Video */}
          <div className="order-1 md:order-2 relative">
            <div style={{ aspectRatio: "1080/1350" }} className="w-full">
              <SDOHDemoDay dict={currentDict} locale={locale} />
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
