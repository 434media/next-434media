"use client"
import Image from "next/image"
import { FadeIn } from "./FadeIn"
import type { Locale } from "../../i18n-config"
import { useEffect, useState } from "react"

interface SDOHStartupBootcampProps {
  locale: Locale
  dict: any
}

export default function SDOHStartupBootcamp({ locale, dict }: SDOHStartupBootcampProps) {
  // Track when dictionary or locale changes
  const [key, setKey] = useState(0)

  // Force re-render when locale or dictionary changes
  useEffect(() => {
    setKey((prev) => prev + 1)
    console.log(`SDOHStartupBootcamp: Locale changed to ${locale}`)
    console.log(`SDOHStartupBootcamp: Dictionary available:`, !!dict)
  }, [locale, dict])

  // Use the dictionary if provided, otherwise use default English text
  const d = dict?.sdoh?.bootcamp || {
    // Default English text
    title: "Startup Bootcamp",
    subtitle: "Early-Stage Program",
    description:
      "A hands-on, early-stage program that helps local entrepreneurs turn ideas into action. Participants receive guidance on business models, impact measurement, funding strategies, and how to build solutions that address real community needs.",
    rgvTitle: "RGV Startup Week Bootcamp",
    when: "When",
    date: "April 25-27, 2025",
    where: "Where",
    location: "TSTC - Harlingen, Welcome Center",
    cta: "Reserve Your Spot",
  }

  return (
    <FadeIn key={key}>
      <div className="max-w-3xl mx-auto mb-16 sm:mb-20">
        <div className="text-center mb-10">
          {/* Updated heading with component number */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-4 shadow-lg">
              2
            </div>
            <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700">
              {d.title}
            </h2>
          </div>
          <div className="inline-block p-1.5 px-3 mb-4 rounded-full bg-cyan-100/80 backdrop-blur-sm text-cyan-800 text-sm font-medium">
            {d.subtitle}
          </div>
          <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto">{d.description}</p>
        </div>

        {/* RGVSW Sign Up Card */}
        <div className="relative overflow-hidden rounded-2xl shadow-xl border border-cyan-200 group transition-all duration-500 hover:shadow-cyan-200/20 hover:border-cyan-300">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-yellow-300/10 z-0 group-hover:opacity-70 transition-opacity duration-500"></div>

          <div className="relative z-10 p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8">
            {/* Left side - Image */}
            <div className="w-full md:w-2/5 flex-shrink-0">
              <div className="relative rounded-xl overflow-hidden shadow-lg border border-neutral-200/50">
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW.png"
                  alt="RGV Startup Week"
                  width={500}
                  height={300}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent"></div>
                <div className="absolute bottom-3 left-3 bg-yellow-400/90 text-neutral-900 text-xs font-bold px-2 py-1 rounded">
                  {d.date}
                </div>
              </div>
            </div>

            {/* Right side - Content */}
            <div className="w-full md:w-3/5">
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-800 mb-3">{d.rgvTitle}</h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-cyan-600 mt-0.5 mr-2 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-neutral-700">
                    <strong className="text-neutral-900">{d.when}:</strong> {d.date}
                  </span>
                </li>
                <li className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-cyan-600 mt-0.5 mr-2 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="text-neutral-700">
                    <strong className="text-neutral-900">{d.where}:</strong> {d.location}
                  </span>
                </li>
              </ul>
              <a
                href="https://www.eventbrite.com/e/startup-bootcamp-tickets-1307199552049"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
                aria-label="Reserve your spot for the Startup Bootcamp"
              >
                {d.cta}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 ml-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
