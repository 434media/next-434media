"use client"

import { FadeIn } from "../FadeIn"
import { SessionCard } from "./SessionCard"
import type { Dictionary } from "@/types/dictionary"

interface SessionsSectionProps {
  dict: Dictionary
}

export function SessionsSection({ dict }: SessionsSectionProps) {
  return (
    <section className="py-20 sm:py-28 lg:py-32 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
        <FadeIn>
          {/* Section header */}
          <div className="text-center mb-16 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-neutral-900 mb-4">
              Seminar Highlights
            </h2>
            {/* Accent underline */}
            <div className="mx-auto w-24 h-1 bg-[#A31545] mb-6" />
            <p className="text-lg sm:text-xl md:text-2xl text-neutral-600 max-w-4xl mx-auto leading-relaxed font-light">
              Dive deep into the insights shared by our expert speakers
            </p>
          </div>

          {/* Session cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-20 items-stretch">
            {/* Card 1 */}
            <SessionCard
              title={dict.sdoh?.sessions?.card1?.title || "Market Analysis and Value Delivery"}
              description={
                dict.sdoh?.sessions?.card1?.description ||
                "Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024 MHM Accelerator Cohort Champion"
              }
              image="https://ampd-asset.s3.us-east-2.amazonaws.com/card1.jpg"
              videoId="session1"
              videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Shireen+Abdullah.mp4"
              href="https://yumlish.com"
              viewSessionText={dict.sdoh?.sessions?.viewSession || "View Session"}
              comingSoonText={dict.sdoh?.sessions?.comingSoon || "Coming Soon"}
              comingSoonDescriptionText={
                dict.sdoh?.sessions?.comingSoonDescription ||
                "This video will be available after the event. Check back later to watch the full session."
              }
              visitWebsiteText={dict.sdoh?.sessions?.visitWebsite || "Visit Website"}
              closeText={dict.sdoh?.sessions?.close || "Close"}
              sessionIdText={dict.sdoh?.sessions?.sessionId || "Session ID"}
            />

            {/* Card 2 */}
            <SessionCard
              title={dict.sdoh?.sessions?.card2?.title || "Legal Considerations for Raising Capital"}
              description={
                dict.sdoh?.sessions?.card2?.description ||
                "Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI"
              }
              image="https://ampd-asset.s3.us-east-2.amazonaws.com/card2.jpeg"
              videoId="session2"
              videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Jose+Padilla.mp4"
              href="https://padillalawllc.com"
              viewSessionText={dict.sdoh?.sessions?.viewSession || "View Session"}
              comingSoonText={dict.sdoh?.sessions?.comingSoon || "Coming Soon"}
              comingSoonDescriptionText={
                dict.sdoh?.sessions?.comingSoonDescription ||
                "This video will be available after the event. Check back later to watch the full session."
              }
              visitWebsiteText={dict.sdoh?.sessions?.visitWebsite || "Visit Website"}
              closeText={dict.sdoh?.sessions?.close || "Close"}
              sessionIdText={dict.sdoh?.sessions?.sessionId || "Session ID"}
            />

            {/* Card 3 */}
            <SessionCard
              title={dict.sdoh?.sessions?.card3?.title || "The Perfect Pitch"}
              description={
                dict.sdoh?.sessions?.card3?.description ||
                "Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc., Capital Factory"
              }
              image="https://ampd-asset.s3.us-east-2.amazonaws.com/card3.jpeg"
              videoId="session3"
              href="https://capitalfactory.com"
              viewSessionText={dict.sdoh?.sessions?.viewSession || "View Session"}
              comingSoonText={dict.sdoh?.sessions?.comingSoon || "Coming Soon"}
              comingSoonDescriptionText={
                dict.sdoh?.sessions?.comingSoonDescription ||
                "This video will be available after the event. Check back later to watch the full session."
              }
              visitWebsiteText={dict.sdoh?.sessions?.visitWebsite || "Visit Website"}
              closeText={dict.sdoh?.sessions?.close || "Close"}
              sessionIdText={dict.sdoh?.sessions?.sessionId || "Session ID"}
            />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
