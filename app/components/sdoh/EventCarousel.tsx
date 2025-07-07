"use client"
import { useState, useRef, useCallback, useEffect } from "react"
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
  const [isHovered, setIsHovered] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Update the videoContent to use dictionary values:
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        setIsVideoModalOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const openVideoModal = useCallback(() => {
    setIsVideoModalOpen(true)
  }, [])

  const closeVideoModal = useCallback(() => {
    setIsVideoModalOpen(false)
  }, [])

  return (
    <>
      <div
        className="relative max-w-4xl mx-auto overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={openVideoModal}
        ref={carouselRef}
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
        {/* Enhanced decorative elements */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 via-yellow-400 to-cyan-500 z-10"></div>
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-gradient-to-br from-cyan-500/20 to-yellow-500/20 rounded-full blur-3xl animate-pulse group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-gradient-to-br from-yellow-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse group-hover:scale-110 transition-transform duration-1000 delay-500"></div>

        {/* Video showcase container */}
        <div className="relative aspect-[4/5] lg:h-[600px] lg:aspect-auto">
          {/* Background content with enhanced parallax */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 transition-transform duration-[3000ms] ease-out group-hover:scale-105"
              style={{
                backgroundImage: `url(${videoContent.videoThumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/70 to-neutral-900/30"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-yellow-500/5"></div>

            {/* Enhanced overlay effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-cyan-500/5 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>

          {/* Enhanced content overlay */}
          <div className="relative h-full flex flex-col justify-end p-8 sm:p-10 md:p-12">
            <div className="transition-all duration-700 transform group-hover:translate-y-0 translate-y-2">
              {/* Enhanced watch now button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openVideoModal()
                }}
                className="inline-block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-neutral-900 px-8 py-4 rounded-2xl text-base font-black tracking-wider mb-6 sm:mb-8 shadow-2xl hover:from-yellow-300 hover:to-yellow-500 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-yellow-400/50 focus:ring-offset-2 focus:ring-offset-neutral-900 group-hover:shadow-yellow-400/25"
              >
                <span className="flex items-center">
                  <div className="relative mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <div className="absolute inset-0 animate-ping opacity-75">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  {dictionary.sdoh?.demoDay?.watchNow || "WATCH NOW"}
                </span>
              </button>

              {/* Enhanced content */}
              <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white mb-3 sm:mb-4 leading-tight group-hover:text-yellow-100 transition-colors duration-300">
                {videoContent.title}
              </h3>

              <p className="text-xl sm:text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-yellow-400 to-cyan-400 font-bold mb-6 sm:mb-8 group-hover:from-yellow-300 group-hover:to-cyan-300 transition-all duration-500">
                {videoContent.subtitle}
              </p>

              <p className="text-white/90 text-base sm:text-lg md:text-xl max-w-3xl mb-8 sm:mb-10 leading-relaxed group-hover:text-white transition-colors duration-300">
                {videoContent.description}
              </p>

              {/* Enhanced highlight badge */}
              <div className="flex items-center bg-black/40 backdrop-blur-lg rounded-2xl p-4 sm:p-6 max-w-fit group-hover:bg-black/30 transition-all duration-300">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-cyan-500/30 via-yellow-500/30 to-cyan-500/30 flex items-center justify-center mr-4 sm:mr-6 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 sm:h-7 sm:w-7 text-yellow-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-white font-bold text-base sm:text-lg md:text-xl group-hover:text-yellow-100 transition-colors duration-300">
                  {videoContent.highlight}
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced modal trigger overlay */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openVideoModal()
              }}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/50 backdrop-blur-lg text-white flex items-center justify-center hover:bg-black/70 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 hover:scale-110 group-hover:bg-yellow-500/20"
              aria-label="Open video in fullscreen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 sm:h-8 sm:w-8"
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

          {/* Enhanced floating particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-3 h-3 sm:w-4 sm:h-4 bg-cyan-400 rounded-full animate-float-slow opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="absolute top-3/4 left-1/3 w-4 h-4 sm:w-5 sm:h-5 bg-yellow-400 rounded-full animate-float-medium opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
            <div className="absolute top-1/2 right-1/4 w-2 h-2 sm:w-3 sm:h-3 bg-cyan-400 rounded-full animate-float-fast opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
            <div className="absolute bottom-1/4 right-1/3 w-3 h-3 sm:w-4 sm:h-4 bg-yellow-400 rounded-full animate-float-slow opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
          </div>

          {/* Enhanced hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
        </div>

        {/* Enhanced animations */}
        <style jsx>{`
          @keyframes float-slow {
            0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
            50% { transform: translateY(-40px) translateX(20px) rotate(180deg); }
          }
          @keyframes float-medium {
            0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
            50% { transform: translateY(-30px) translateX(-20px) rotate(-180deg); }
          }
          @keyframes float-fast {
            0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
            50% { transform: translateY(-20px) translateX(15px) rotate(360deg); }
          }
          .animate-float-slow {
            animation: float-slow 15s ease-in-out infinite;
          }
          .animate-float-medium {
            animation: float-medium 10s ease-in-out infinite;
          }
          .animate-float-fast {
            animation: float-fast 8s ease-in-out infinite;
          }
        `}</style>
      </div>

      {/* Fixed Video Modal with correct props */}
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
