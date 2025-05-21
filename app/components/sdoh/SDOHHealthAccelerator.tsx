"use client"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import { useEffect, useState } from "react"
import SDOHDemoDay from "./SDOHDemoDay"
import type { Dictionary } from "../../types/dictionary"

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
  dict: Partial<Dictionary>
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
  const sdohDict = dict?.sdoh
  const d = (sdohDict?.accelerator as AcceleratorDictionary) || defaultDictionary

  // Get the "Learn More" text from the dictionary
  const demoDayDict = sdohDict?.demoDay
  const learnMore = demoDayDict?.learnMore || "Learn More About the Accelerator"

  return (
    <FadeIn key={key}>
      <div className="max-w-5xl mx-auto mb-16 sm:mb-20">
        {/* Main Content - Updated with component number and grid layout */}
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center mb-16">
          <div className="order-2 md:order-1">
            <div className="flex items-center mb-8">
              <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-5 shadow-lg">
                3
              </div>
              <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700">
                {d.title}
              </h2>
            </div>

            <div className="inline-block p-2 px-4 mb-6 rounded-full bg-yellow-100/90 backdrop-blur-sm text-yellow-800 text-sm font-medium shadow-sm border border-yellow-200/50">
              {d.subtitle}
            </div>

            <div className="relative">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-200/20 rounded-full blur-3xl -z-10"></div>
              <div className="p-8 border border-cyan-200/40 rounded-xl bg-gradient-to-br from-white to-cyan-50/50 shadow-sm hover:shadow-md transition-all duration-300">
                <p className="text-lg md:text-xl text-neutral-700 leading-relaxed font-light">{d.description1}</p>
                <p className="text-lg md:text-xl text-neutral-700 leading-relaxed font-light mt-6">{d.description2}</p>

                {/* Learn more link - moved from SDOHDemoDay */}
                <div className="mt-8">
                  <a
                    href="https://velocitytx.org/startup-programs/support/accelerator/"
                    className="inline-flex items-center text-cyan-700 hover:text-cyan-800 font-medium transition-colors duration-200"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Learn more about the Community Health Accelerator"
                  >
                    {learnMore}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 ml-1 group-hover:translate-x-1 transition-transform duration-200"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Day Video - Right side on desktop */}
          <div className="order-1 md:order-2 relative">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-yellow-200/10 rounded-full blur-3xl -z-10"></div>
            <SDOHDemoDay dict={dict} locale={locale} />
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
