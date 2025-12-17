"use client"

import { FadeIn } from "../FadeIn"
import { useLanguage } from "@/app/context/language-context"

interface SpeakersSectionProps {
  companyLogos: Record<string, string>
}

interface Speaker {
  name: string
  role: string
  image: string
  company: string
  website: string
  isModerator?: boolean
}

export function SpeakersSection({ companyLogos }: SpeakersSectionProps) {
  const { dictionary } = useLanguage()

  const speakers: Speaker[] = [
    {
      name: "Marcos Resendez",
      role: dictionary.sdoh?.speakers?.founder || "Founder",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/49d10ec854acc0af8a20810dd891eafb.jpeg",
      company: "434 MEDIA",
      website: "https://434media.com",
      isModerator: true,
    },
    {
      name: "Dr. Lyssa Ochoa",
      role: dictionary.sdoh?.speakers?.founder || "Founder",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/Lyssa_Ochoa_LinkedIn_Headshot.jpeg",
      company: "The SAVE Clinic",
      website: "https://thesaveclinic.com",
    },
    {
      name: "Daniyal Liaqat",
      role: "Founder, 2024 MHM Accelerator",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/daniyal-liaqat.jpeg",
      company: "Tabiat Research",
      website: "https://tabiat.care",
    },
    {
      name: "Lina Rugova",
      role: dictionary.sdoh?.speakers?.founder || "Founder",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/lina-rugova.jpeg",
      company: "Emerge and Rise",
      website: "https://emergeandrise.org",
    },
  ]

  return (
    <div className="mt-16 sm:mt-24 relative">
      <FadeIn>
        <div className="relative">
          {/* Main container */}
          <div className="bg-white border border-neutral-200 p-8 lg:p-12 relative">
            {/* Accent lines */}
            <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500" />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-400" />

            <div className="relative">
              {/* Header section */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-12 gap-6">
                <div className="flex items-center">
                  <div className="relative">
                    <span className="inline-block w-1 h-12 bg-yellow-400 mr-6" />
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-neutral-900 mb-2">
                      {dictionary.sdoh?.speakers?.title || "Panel Speakers"}
                    </h2>
                    <p className="text-lg text-neutral-600 font-medium">
                      {dictionary.sdoh?.speakers?.subtitle || "Healthcare innovators shaping the future"}
                    </p>
                  </div>
                </div>

                {/* Featured session badge */}
                <div className="inline-flex items-center px-4 py-2 bg-neutral-900 text-white text-sm font-bold">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3" />
                  {dictionary.sdoh?.speakers?.featuredSession || "Featured Event"}
                </div>
              </div>

              {/* Speaker grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 xl:gap-8">
                {speakers.map((speaker, index) => (
                  <div key={speaker.name} className="relative group">
                    <div className="relative bg-neutral-50 border border-neutral-200 p-8 transition-colors duration-200 hover:border-neutral-400">
                      {/* Moderator badge */}
                      {speaker.isModerator && (
                        <div className="absolute -top-3 -right-3 z-10">
                          <div className="px-3 py-1 bg-yellow-400 text-neutral-900 text-xs font-black">
                            {dictionary.sdoh?.speakers?.moderator || "MODERATOR"}
                          </div>
                        </div>
                      )}

                      {/* Accent corner */}
                      <div
                        className={`absolute top-0 right-0 w-3 h-3 ${
                          speaker.isModerator ? "bg-yellow-400" : "bg-cyan-500"
                        }`}
                      />

                      {/* Profile image */}
                      <div className="relative mb-6">
                        <div className="relative w-24 h-24 mx-auto">
                          <div className="relative w-24 h-24 overflow-hidden border-2 border-neutral-200">
                            <img
                              src={speaker.image}
                              alt={speaker.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="text-center space-y-3">
                        <h3 className="font-black text-xl text-neutral-900">
                          {speaker.name}
                        </h3>
                        <p className="text-sm text-neutral-600 font-semibold">
                          {speaker.role}
                        </p>

                        {/* Company logo */}
                        <div className="flex items-center justify-center py-2 h-12">
                          <img
                            src={companyLogos[speaker.company] || "/placeholder.svg"}
                            alt={speaker.company}
                            className={`h-8 w-auto ${
                              speaker.company === "Emerge and Rise" ? "invert" : ""
                            }`}
                          />
                        </div>

                        {/* Website link */}
                        <a
                          href={speaker.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-neutral-900 hover:text-cyan-600 font-bold transition-colors duration-200"
                        >
                          <span className="mr-2">{dictionary.sdoh?.speakers?.visitWebsite || "Visit Website"}</span>
                          <svg
                            className="w-4 h-4"
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
