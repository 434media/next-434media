"use client"
import { useState, useCallback } from "react"
import { VideoModal } from "./VideoModal"
import { useLanguage } from "@/context/language-context"

interface VideoContent {
  id: string
  type: "video"
  videoUrl: string
  videoThumbnail: string
  title: string
  description: string
}

export function EventCarousel() {
  const { dictionary } = useLanguage()
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const videoContent: VideoContent = {
    id: "video-session",
    type: "video",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW25+-+%C2%BFQue+es+SDOH_.mp4",
    videoThumbnail: "https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-ochoa.jpg",
    title: dictionary.sdoh?.demoDay?.title || "¿Que es SDOH? Panel Session",
    description:
      dictionary.sdoh?.demoDay?.description || "Experience the complete panel discussion from RGV Startup Week 2025.",
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
        className="relative overflow-hidden bg-neutral-900 group cursor-pointer"
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
        {/* Video showcase container */}
        <div className="relative aspect-[4/5]">
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
            <div className="absolute inset-0 bg-neutral-900/40 group-hover:bg-neutral-900/50 transition-colors duration-300" />
          </div>

          {/* Centered Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openVideoModal()
              }}
              className="w-20 h-20 sm:w-24 sm:h-24 bg-[#A31545] text-white flex items-center justify-center group-hover:bg-[#8B1E3F] transition-all duration-300 group-hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[#A31545]/50"
              aria-label="Play video"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 sm:h-10 sm:w-10 ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
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

export default EventCarousel
