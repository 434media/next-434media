"use client"
import { FadeIn } from "./FadeIn"
import type { Locale } from "../../i18n-config"
import { useEffect, useState } from "react"

// Define the structure of the accelerator dictionary
interface AcceleratorDictionary {
  title: string
  subtitle: string
  description1: string
  description2: string
}

// Define the structure of the dictionary props
interface SDOHHealthAcceleratorProps {
  locale: Locale
  dict: Record<string, unknown>
}

export default function SDOHHealthAccelerator({ locale, dict }: SDOHHealthAcceleratorProps) {
  // Track when dictionary or locale changes
  const [key, setKey] = useState(0)

  // Force re-render when locale or dictionary changes
  useEffect(() => {
    setKey((prev) => prev + 1)
    console.log(`SDOHHealthAccelerator: Locale changed to ${locale}`)
    console.log(`SDOHHealthAccelerator: Dictionary available:`, !!dict)
  }, [locale, dict])

  // Default English text
  const defaultDictionary: AcceleratorDictionary = {
    title: "Community Health Accelerator",
    subtitle: "Growth-Stage Program",
    description1:
      "For startups ready to scale, this accelerator provides deeper support—from mentoring and expert workshops to connections with healthcare systems, investors, and ecosystem partners focused on sustainable health innovation.",
    description2:
      "This program exists to answer big questions in a practical way—and to make sure the people closest to the issues have the tools, resources, and support to solve them.",
  }

  // Use the dictionary if provided, otherwise use default English text
  const sdohDict = dict?.sdoh as Record<string, unknown> | undefined
  const d = (sdohDict?.accelerator as AcceleratorDictionary) || defaultDictionary

  return (
    <FadeIn key={key}>
      <div className="max-w-3xl mx-auto mb-16 sm:mb-20">
        <div className="text-center mb-10">
          {/* Updated heading with component number */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-4 shadow-lg">
              3
            </div>
            <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700">
              {d.title}
            </h2>
          </div>
          <div className="inline-block p-1.5 px-3 mb-4 rounded-full bg-yellow-100/80 backdrop-blur-sm text-yellow-800 text-sm font-medium">
            {d.subtitle}
          </div>
          <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto">{d.description1}</p>
          <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto mt-4">{d.description2}</p>
        </div>
      </div>
    </FadeIn>
  )
}
