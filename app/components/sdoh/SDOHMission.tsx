"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { FadeIn } from "../FadeIn"
import { SectionTransition } from "./SectionTransition"
import SeminarSeries from "./SeminarSeries"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface SDOHMissionProps {
  locale: Locale
  dict: Dictionary
}

export function SDOHMission({ locale, dict }: SDOHMissionProps) {
  const [, setKey] = useState(0)

  useEffect(() => {
    setKey((prev) => prev + 1)
  }, [locale, dict])

  const partnershipDict = dict?.sdoh?.partnership || {
    label: "STRATEGIC PARTNERSHIP",
    title: "Powered by VelocityTX & Methodist Healthcare Ministries",
    description:
      "In partnership with VelocityTX and Methodist Healthcare Ministries, the Community Health Accelerator program connects education, entrepreneurship, and innovation through three core components.",
    velocityAlt: "VelocityTX Logo",
    methodistAlt: "Methodist Healthcare Ministries Logo",
  }

  return (
    <SectionTransition variant="wave" colorScheme="magenta" maxWidth="5xl" className="py-20 sm:py-28 lg:py-32 bg-white">
      <FadeIn>
        {/* Hero SDOH Introduction */}
        <div className="relative mb-16 sm:mb-20 lg:mb-24 text-center px-4 sm:px-6 lg:px-8">
          <div className="relative mb-6 sm:mb-8">
            <h1 className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none text-neutral-900">
              {dict?.sdoh?.title || "¿Qué es SDOH?"}
              </h1>
              <div className="mt-4 mx-auto w-24 sm:w-32 h-1 bg-[#A31545]"></div>
            </div>

            <div className="relative max-w-4xl mx-auto">
              <p className="text-lg sm:text-xl md:text-2xl text-neutral-500 font-medium leading-relaxed">
                {dict?.sdoh?.subtitle || "(Or in plain terms: What the Heck is Social Determinants of Health?)"}
              </p>
            </div>
          </div>

          {/* SDOH Definition Content */}
          <div className="relative mb-16 sm:mb-20 lg:mb-24 px-4 sm:px-6 lg:px-8">
            <div className="space-y-8 sm:space-y-10 max-w-4xl mx-auto">
              <p className="text-lg sm:text-xl md:text-2xl leading-relaxed text-neutral-600 text-center">
                {dict?.sdoh?.intro1 ||
                  "Most of what affects our health doesn't happen in a hospital—it happens in our everyday lives. Where we live, what we eat, how we get to work or school, whether we feel safe, supported, and seen... these things shape our health long before a doctor ever gets involved."}
              </p>

              <div className="relative">
                <div className="relative p-6 sm:p-8 md:p-10 border border-neutral-200 bg-neutral-50">
                  <div className="absolute left-0 top-0 w-1 h-full bg-[#A31545]"></div>
                  <div className="absolute right-0 top-0 w-1 h-full bg-[#FF6B35]"></div>

                  <p className="text-lg sm:text-xl md:text-2xl leading-relaxed text-neutral-700 text-center">
                    {locale === "es" ? (
                      <>
                        {dict?.sdoh?.intro2Part1 || "Eso es lo que son los"}{" "}
                        <span className="font-bold text-[#A31545]">
                          {dict?.sdoh?.sdohFull || "Determinantes Sociales de la Salud (SDOH)"}
                        </span>{" "}
                        {dict?.sdoh?.intro2Part2 ||
                          ": las condiciones del mundo real que impactan cuánto tiempo y qué tan bien vivimos."}
                      </>
                    ) : (
                      <>
                        {dict?.sdoh?.intro2Part1 || "That's what"}{" "}
                        <span className="font-bold text-[#A31545]">
                          {dict?.sdoh?.sdohFull || "Social Determinants of Health (SDOH)"}
                        </span>{" "}
                        {dict?.sdoh?.intro2Part2 ||
                          "are: the real-world conditions that impact how long—and how well—we live."}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* STRATEGIC PARTNERSHIP */}
          <div className="relative mb-16 sm:mb-20 lg:mb-24 px-4 sm:px-6 lg:px-8">
            <div className="relative bg-white py-10 sm:py-12 lg:py-16 px-6 sm:px-8 lg:px-12 border border-neutral-200">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#A31545]"></div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B35]"></div>

              <div className="relative max-w-5xl mx-auto">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-neutral-900 text-white text-sm sm:text-base font-bold tracking-wider">
                    <div className="w-2 h-2 bg-[#FF6B35] rounded-full mr-2 sm:mr-3"></div>
                    {partnershipDict.label}
                  </div>
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-8 sm:mb-10 text-neutral-900 leading-tight text-center">
                  {locale === "es" ? "Impulsado por" : "Powered by"}
                </h2>

                <div className="relative mb-8 sm:mb-10">
                  <div className="relative flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-16">
                    <Link
                      href="https://velocitytx.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:opacity-80 transition-opacity duration-300"
                    >
                      <div className="relative h-28 sm:h-32 lg:h-36 w-72 sm:w-80 lg:w-96">
                        <Image
                          src="https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+BUTTON+RGB.png"
                          alt={partnershipDict.velocityAlt ?? "VelocityTX Logo"}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </Link>

                    <div className="flex lg:flex-col items-center gap-4">
                      <div className="w-16 lg:w-px h-px lg:h-16 bg-neutral-300"></div>
                      <div className="w-4 h-4 bg-[#FF6B35] rounded-full"></div>
                      <div className="w-16 lg:w-px h-px lg:h-16 bg-neutral-300"></div>
                    </div>

                    <Link
                      href="https://mhm.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:opacity-80 transition-opacity duration-300"
                    >
                      <div className="relative h-28 sm:h-32 lg:h-36 w-72 sm:w-80 lg:w-96">
                        <Image
                          src="https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png"
                          alt={partnershipDict.methodistAlt ?? "Methodist Healthcare Ministries Logo"}
                          fill
                          className="object-contain"
                        />
                      </div>
                    </Link>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-base sm:text-lg md:text-xl leading-relaxed text-neutral-700 mb-4 sm:mb-6">
                    {locale === "es" ? (
                      <>
                        En asociación con VelocityTX y Methodist Healthcare Ministries, el programa Community Health
                        Accelerator conecta educación, emprendimiento e innovación a través de{" "}
                        <span className="font-bold text-[#A31545]">tres componentes principales</span>.
                      </>
                    ) : (
                      <>
                        In partnership with VelocityTX and Methodist Healthcare Ministries, the Community Health
                        Accelerator program connects education, entrepreneurship, and innovation through{" "}
                        <span className="font-bold text-[#A31545]">three core components</span>.
                      </>
                    )}
                  </p>

                  <div className="inline-flex items-center px-5 py-2 bg-neutral-100 text-neutral-900 text-base font-medium border border-neutral-200">
                    <div className="w-2 h-2 bg-[#A31545] rounded-full mr-2"></div>
                    {locale === "es" ? "Descubre cada componente a continuación" : "Discover each component below"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seminar Series Content - Component 1 */}
          <div className="px-4 sm:px-6 lg:px-8">
            <SeminarSeries locale={locale} dict={dict} />
          </div>
        </FadeIn>
    </SectionTransition>
  )
}
