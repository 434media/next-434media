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
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 z-10" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-yellow-400 z-10" />

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
              className="inline-block bg-yellow-400 text-neutral-900 px-6 py-3 text-base font-bold mb-6 sm:mb-8 hover:bg-yellow-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-neutral-900 w-fit"
            >
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {dictionary.sdoh?.demoDay?.watchNow || "WATCH NOW"}
              </span>
            </button>

            {/* Title */}
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 sm:mb-4 leading-tight">
              {videoContent.title}
            </h3>

            {/* Subtitle */}
            <p className="text-xl sm:text-2xl md:text-3xl text-cyan-400 font-bold mb-6 sm:mb-8">
              {videoContent.subtitle}
            </p>

            {/* Description */}
            <p className="text-white/90 text-base sm:text-lg md:text-xl max-w-3xl mb-8 sm:mb-10 leading-relaxed">
              {videoContent.description}
            </p>

            {/* Highlight badge */}
            <div className="flex items-center bg-white/10 border border-white/20 p-4 sm:p-5 max-w-fit">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-900 flex items-center justify-center mr-4 relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-2 h-2 bg-cyan-500" />
              </div>
              <span className="text-white font-bold text-base sm:text-lg">
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
