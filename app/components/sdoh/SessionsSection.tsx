"use client"

import { FadeIn } from "../FadeIn"
import { SessionCard } from "./SessionCard"
import type { Dictionary } from "@/app/types/dictionary"

interface SessionsSectionProps {
  dict: Dictionary
}

export function SessionsSection({ dict }: SessionsSectionProps) {
  return (
    <section className="py-24 bg-gradient-to-br from-white via-cyan-50/30 to-yellow-50/30 relative overflow-hidden">
      {/* Enhanced background elements with animated particles */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-cyan-200/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-yellow-200/20 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>

        {/* Floating geometric shapes */}
        <div className="absolute top-10 right-10 w-4 h-4 bg-cyan-400/30 rotate-45 animate-bounce delay-500"></div>
        <div className="absolute bottom-20 left-20 w-6 h-6 bg-yellow-400/30 rounded-full animate-bounce delay-700"></div>
        <div className="absolute top-1/2 left-10 w-3 h-3 bg-cyan-500/40 rotate-45 animate-bounce delay-300"></div>

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(6, 182, 212, 0.3) 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          ></div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <FadeIn>
          {/* Enhanced section header with improved animations */}
          <div className="text-center mb-20">
            <div className="inline-block relative group">
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-yellow-500/20 to-cyan-500/20 blur-2xl rounded-full animate-pulse group-hover:blur-3xl transition-all duration-1000"></div>

              {/* Main title with enhanced gradient */}
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-cyan-600 to-yellow-500 relative px-6 py-4 animate-gradient-x">
                Seminar Highlights
              </h2>

              {/* Subtle underline animation */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-yellow-400 group-hover:w-full transition-all duration-700"></div>
            </div>

            <p className="text-xl md:text-2xl text-neutral-600 mt-6 max-w-4xl mx-auto leading-relaxed font-light">
              Dive deep into the insights shared by our expert speakers
            </p>

            {/* Simplified decorative line without circle dot */}
            <div className="flex items-center justify-center mt-10">
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-400 to-yellow-400 w-64 md:w-80"></div>
            </div>
          </div>

          {/* Session cards grid with equal heights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-20 items-stretch">
            {/* Card 1 */}
            <div className="md:mt-0">
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
            </div>

            {/* Card 2 */}
            <div className="md:mt-0">
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
            </div>

            {/* Card 3 */}
            <div className="md:mt-0">
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
          </div>
        </FadeIn>
      </div>

      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% {
            background-size: 200% 200%;
            background-position: left center;
          }
          50% {
            background-size: 200% 200%;
            background-position: right center;
          }
        }
        
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </section>
  )
}
