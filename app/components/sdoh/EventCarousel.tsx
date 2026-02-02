"use client"
import { useState, useCallback } from "react"
import { VideoModal } from "./VideoModal"
import { useLanguage } from "@/app/context/language-context"

interface VideoContent {
  id: string
  type: "video"
  videoUrl: string
  videoThumbnail: string
  title: string
  subtitle: string
  description: string
  highlight: string
}

export function EventCarousel() {
  const { dictionary } = useLanguage()
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const videoContent: VideoContent = {
    id: "video-session",
    type: "video",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW25+-+%C2%BFQue+es+SDOH_.mp4",
    videoThumbnail: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSWPanels-27.jpg",
    title: dictionary.sdoh?.demoDay?.title || "¿Que es SDOH? Panel Session",
    subtitle: dictionary.sdoh?.demoDay?.subtitle || "Watch the Full Discussion",
    description:
      dictionary.sdoh?.demoDay?.description || "Experience the complete panel discussion from RGV Startup Week 2025.",
    highlight: dictionary.sdoh?.demoDay?.highlight || "Featured Video Session",
  }

  const openVideoModal = useCallback(() => {
    setIsVideoModalOpen(true)
  }, [])

  const closeVideoModal = useCallback(() => {
    setIsVideoModalOpen(false)
  }, [])

  return (
    <>
      <div
        className="relative max-w-4xl mx-auto overflow-hidden border border-neutral-200 bg-neutral-900 group cursor-pointer"
        onClick={openVideoModal}
        role="button"
        tabIndex={0}
        aria-label="Open SDOH panel video"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openVideoModal()
          }
        }}
      >
        {/* Accent lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#A31545] z-10" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B35] z-10" />

        {/* Video showcase container */}
        <div className="relative aspect-[4/5] lg:h-[600px] lg:aspect-auto">
          {/* Background image */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${videoContent.videoThumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/70 to-neutral-900/30" />
          </div>

          {/* Content overlay */}
          <div className="relative h-full flex flex-col justify-end p-8 sm:p-10 md:p-12">
            {/* Watch now button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                openVideoModal()
              }}
              className="inline-block bg-[#FF6B35] text-white px-6 py-3 text-base font-bold mb-6 sm:mb-8 hover:bg-[#FF8C5A] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:ring-offset-2 focus:ring-offset-neutral-900 w-fit"
            >
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {dictionary.sdoh?.demoDay?.watchNow || "WATCH NOW"}
              </span>
            </button>

            {/* Title */}
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 leading-snug">
              {videoContent.title}
            </h3>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-[#FF8C5A] font-medium mb-6">
              {videoContent.subtitle}
            </p>

            {/* Description */}
            <p className="text-white/80 text-base sm:text-lg max-w-2xl mb-8 leading-relaxed">
              {videoContent.description}
            </p>

            {/* Highlight badge */}
            <div className="flex items-center bg-white/10 border border-white/20 px-4 py-3 max-w-fit">
              <div className="w-8 h-8 bg-neutral-900 flex items-center justify-center mr-3 relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-[#FF6B35]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#A31545]" />
              </div>
              <span className="text-white font-medium text-sm">
                {videoContent.highlight}
              </span>
            </div>
          </div>

          {/* Fullscreen button */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openVideoModal()
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 bg-white text-neutral-900 flex items-center justify-center hover:bg-neutral-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
              aria-label="Open video in fullscreen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 sm:h-6 sm:w-6"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={closeVideoModal}
        videoSrc={videoContent.videoUrl}
        title={videoContent.title}
        description={videoContent.description}
      />
    </>
  )
}
