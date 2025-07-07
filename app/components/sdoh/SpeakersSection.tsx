"use client"

import { FadeIn } from "../FadeIn"
import { useLanguage } from "@/app/context/language-context"

interface SpeakersSectionProps {
  companyLogos: Record<string, string>
}

export function SpeakersSection({ companyLogos }: SpeakersSectionProps) {
  const { dictionary } = useLanguage()
  return (
    <div className="mt-16 sm:mt-24 relative">
      <FadeIn>
        <div className="relative">
          {/* Enhanced decorative elements with more dynamic positioning */}
          <div className="absolute -top-16 -left-16 w-32 h-32 border-t-4 border-l-4 border-yellow-400/40 rounded-tl-3xl transform rotate-12"></div>
          <div className="absolute -bottom-16 -right-16 w-32 h-32 border-b-4 border-r-4 border-cyan-400/40 rounded-br-3xl transform -rotate-12"></div>

          {/* Enhanced floating accent elements with staggered animations */}
          <div className="absolute top-1/4 -left-8 w-4 h-4 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full animate-bounce opacity-60"></div>
          <div className="absolute bottom-1/4 -right-8 w-3 h-3 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full animate-pulse delay-1000 opacity-70"></div>
          <div className="absolute top-1/2 -left-4 w-2 h-2 bg-gradient-to-r from-yellow-300 to-cyan-300 rounded-full animate-ping delay-2000 opacity-50"></div>

          {/* Main container with enhanced styling */}
          <div className="bg-gradient-to-br from-white/95 via-white/90 to-white/95 backdrop-blur-lg rounded-3xl p-8 lg:p-12 shadow-2xl border border-cyan-200/30 relative overflow-hidden">
            {/* Enhanced background pattern with multiple layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/60 via-white/20 to-yellow-50/60"></div>
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-cyan-100/40 via-cyan-50/20 to-transparent rounded-bl-full"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-yellow-100/40 via-yellow-50/20 to-transparent rounded-tr-full"></div>

            {/* Animated mesh gradient overlay */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-cyan-400/20 to-transparent rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute bottom-1/3 right-1/3 w-24 h-24 bg-gradient-to-l from-yellow-400/20 to-transparent rounded-full blur-xl animate-pulse delay-1000"></div>
            </div>

            <div className="relative z-10">
              {/* Enhanced header section */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-12 gap-6">
                <div className="flex items-center">
                  <div className="relative">
                    <span className="inline-block w-6 h-12 bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600 mr-6 rounded-lg shadow-xl transform rotate-3"></span>
                    <div className="absolute -top-1 -left-1 w-6 h-12 bg-gradient-to-b from-cyan-400/50 to-transparent rounded-lg blur-sm"></div>
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-cyan-700 to-cyan-800 mb-2">
                      {dictionary.sdoh?.speakers?.title || "Panel Speakers"}
                    </h2>
                    <p className="text-lg text-neutral-600 font-medium">
                      {dictionary.sdoh?.speakers?.subtitle || "Healthcare innovators shaping the future"}
                    </p>
                  </div>
                </div>

                {/* Enhanced featured session badge */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-yellow-500/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                  <div className="relative px-6 py-3 bg-gradient-to-r from-cyan-50 via-white to-yellow-50 text-cyan-800 rounded-2xl text-sm font-bold border-2 border-cyan-300/60 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                    <span className="flex items-center">
                      <div className="relative mr-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-yellow-600"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <div className="absolute inset-0 animate-ping">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-yellow-400 opacity-75"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>
                      {dictionary.sdoh?.speakers?.featuredSession || "Featured Event"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enhanced 4-column grid for desktop with improved speaker cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 xl:gap-8 max-w-8xl mx-auto">
                {/* Moderator - Enhanced card design */}
                <div className="group relative">
                  {/* Card glow effect */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-all duration-500"></div>

                  <div className="relative bg-gradient-to-br from-white via-yellow-50/50 to-white rounded-3xl p-8 shadow-xl border-2 border-yellow-200/50 group-hover:border-yellow-300/70 transition-all duration-500 transform group-hover:-translate-y-2 group-hover:shadow-2xl">
                    {/* Moderator badge */}
                    <div className="absolute -top-3 -right-3 z-10">
                      <div className="relative">
                        <div className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs font-black rounded-full shadow-lg transform rotate-12 group-hover:rotate-6 transition-transform duration-300">
                          {dictionary.sdoh?.speakers?.moderator || "MODERATOR"}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full blur-md opacity-50 animate-pulse"></div>
                      </div>
                    </div>

                    {/* Profile image with enhanced styling */}
                    <div className="relative mb-6">
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gradient-to-r from-yellow-400 to-yellow-500 shadow-xl group-hover:scale-110 transition-transform duration-300">
                          <img
                            src="https://ampd-asset.s3.us-east-2.amazonaws.com/49d10ec854acc0af8a20810dd891eafb.jpeg"
                            alt="Marcos Resendez"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="text-center space-y-3">
                      <h3 className="font-black text-xl text-neutral-900 group-hover:text-yellow-700 transition-colors duration-300">
                        Marcos Resendez
                      </h3>
                      <p className="text-sm text-neutral-600 font-semibold">
                        {dictionary.sdoh?.speakers?.founder || "Founder"}
                      </p>

                      {/* Company logo */}
                      <div className="flex items-center justify-center py-2">
                        <div className="relative">
                          <img
                            src={companyLogos["434 MEDIA"] || "/placeholder.svg"}
                            alt="434 MEDIA"
                            className="h-8 w-auto filter group-hover:brightness-110 transition-all duration-300"
                          />
                        </div>
                      </div>

                      {/* Enhanced website link */}
                      <a
                        href="https://434media.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-yellow-600 hover:text-yellow-700 font-bold transition-all duration-300 group-hover:scale-105"
                      >
                        <span className="mr-2">{dictionary.sdoh?.speakers?.visitWebsite || "Visit Website"}</span>
                        <svg
                          className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Speaker 1 - Dr. Lyssa Ochoa */}
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-all duration-500"></div>

                  <div className="relative bg-gradient-to-br from-white via-cyan-50/50 to-white rounded-3xl p-8 shadow-xl border-2 border-cyan-200/50 group-hover:border-cyan-300/70 transition-all duration-500 transform group-hover:-translate-y-2 group-hover:shadow-2xl">
                    <div className="relative mb-6">
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gradient-to-r from-cyan-400 to-cyan-500 shadow-xl group-hover:scale-110 transition-transform duration-300">
                          <img
                            src="https://ampd-asset.s3.us-east-2.amazonaws.com/Lyssa_Ochoa_LinkedIn_Headshot.jpeg"
                            alt="Dr. Lyssa Ochoa"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-center space-y-3">
                      <h3 className="font-black text-xl text-neutral-900 group-hover:text-cyan-700 transition-colors duration-300">
                        Dr. Lyssa Ochoa
                      </h3>
                      <p className="text-sm text-neutral-600 font-semibold">
                        {dictionary.sdoh?.speakers?.founder || "Founder"}
                      </p>

                      <div className="flex items-center justify-center py-2">
                        <img
                          src={companyLogos["The SAVE Clinic"] || "/placeholder.svg"}
                          alt="The SAVE Clinic"
                          className="h-8 w-auto filter group-hover:brightness-110 transition-all duration-300"
                        />
                      </div>

                      <a
                        href="https://thesaveclinic.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-cyan-600 hover:text-cyan-700 font-bold transition-all duration-300 group-hover:scale-105"
                      >
                        <span className="mr-2">{dictionary.sdoh?.speakers?.visitWebsite || "Visit Website"}</span>
                        <svg
                          className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Speaker 2 - Daniyal Liaqat */}
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-all duration-500"></div>

                  <div className="relative bg-gradient-to-br from-white via-purple-50/50 to-white rounded-3xl p-8 shadow-xl border-2 border-purple-200/50 group-hover:border-purple-300/70 transition-all duration-500 transform group-hover:-translate-y-2 group-hover:shadow-2xl">
                    <div className="relative mb-6">
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gradient-to-r from-purple-400 to-purple-500 shadow-xl group-hover:scale-110 transition-transform duration-300">
                          <img
                            src="https://ampd-asset.s3.us-east-2.amazonaws.com/daniyal-liaqat.jpeg"
                            alt="Daniyal Liaqat"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-center space-y-3">
                      <h3 className="font-black text-xl text-neutral-900 group-hover:text-purple-700 transition-colors duration-300">
                        Daniyal Liaqat
                      </h3>
                      <p className="text-sm text-neutral-600 font-semibold">Founder, 2024 MHM Accelerator</p>

                      <div className="flex items-center justify-center py-2">
                        <img
                          src={companyLogos["Tabiat Research"] || "/placeholder.svg"}
                          alt="Tabiat Research"
                          className="h-8 w-auto filter group-hover:brightness-110 transition-all duration-300"
                        />
                      </div>

                      <a
                        href="https://tabiat.care"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 font-bold transition-all duration-300 group-hover:scale-105"
                      >
                        <span className="mr-2">{dictionary.sdoh?.speakers?.visitWebsite || "Visit Website"}</span>
                        <svg
                          className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Speaker 3 - Lina Rugova */}
                <div className="group relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-all duration-500"></div>

                  <div className="relative bg-gradient-to-br from-white via-emerald-50/50 to-white rounded-3xl p-8 shadow-xl border-2 border-emerald-200/50 group-hover:border-emerald-300/70 transition-all duration-500 transform group-hover:-translate-y-2 group-hover:shadow-2xl">
                    <div className="relative mb-6">
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full blur-lg opacity-30 animate-pulse"></div>
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-gradient-to-r from-emerald-400 to-emerald-500 shadow-xl group-hover:scale-110 transition-transform duration-300">
                          <img
                            src="https://ampd-asset.s3.us-east-2.amazonaws.com/lina-rugova.jpeg"
                            alt="Lina Rugova"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-center space-y-3">
                      <h3 className="font-black text-xl text-neutral-900 group-hover:text-emerald-700 transition-colors duration-300">
                        Lina Rugova
                      </h3>
                      <p className="text-sm text-neutral-600 font-semibold">
                        {dictionary.sdoh?.speakers?.founder || "Founder"}
                      </p>

                      <div className="flex items-center justify-center py-2">
                        <img
                          src={companyLogos["Emerge and Rise"] || "/placeholder.svg"}
                          alt="Emerge and Rise"
                          className="h-8 w-auto filter group-hover:brightness-110 transition-all duration-300 invert"
                        />
                      </div>

                      <a
                        href="https://emergeandrise.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-bold transition-all duration-300 group-hover:scale-105"
                      >
                        <span className="mr-2">{dictionary.sdoh?.speakers?.visitWebsite || "Visit Website"}</span>
                        <svg
                          className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
