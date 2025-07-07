"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { VideoModal } from "./VideoModal"

interface SessionCardProps {
  title: string
  description: string
  image: string
  videoId: string
  videoUrl?: string
  href?: string
  viewSessionText?: string
  comingSoonText?: string
  comingSoonDescriptionText?: string
  visitWebsiteText?: string
  closeText?: string
  sessionIdText?: string
}

export function SessionCard({
  title,
  description,
  image,
  videoId,
  videoUrl,
  href,
  viewSessionText = "View Session",
  comingSoonText = "Coming Soon",
  comingSoonDescriptionText = "This video will be available after the event. Check back later to watch the full session.",
  visitWebsiteText = "Visit Website",
  closeText = "Close",
  sessionIdText = "Session ID",
}: SessionCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const openModal = () => setIsModalOpen(true)
  const closeModal = () => setIsModalOpen(false)

  return (
    <>
      <div
        ref={cardRef}
        className="bg-white rounded-2xl shadow-lg overflow-hidden border border-neutral-200 flex flex-col h-full min-h-[500px] transition-all duration-300 hover:shadow-xl hover:border-cyan-200 group"
      >
        <div
          className="aspect-video relative overflow-hidden cursor-pointer flex-shrink-0"
          onClick={openModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              openModal()
            }
          }}
          aria-label={`Open ${title} session video`}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

          {/* Clean image without play button overlay */}
          <Image
            src={image || "/placeholder.svg?height=720&width=1280&query=conference presentation"}
            alt={title}
            width={640}
            height={360}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Elegant corner indicator */}
          <div className="absolute top-4 right-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-cyan-600"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Bottom gradient bar indicator */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-yellow-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20"></div>
        </div>

        <div className="p-6 flex-grow flex flex-col">
          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-cyan-600 transition-colors duration-300 flex-shrink-0">
            {title}
          </h3>
          <p className="text-neutral-700 mb-4 text-base leading-relaxed flex-grow">{description}</p>
        </div>

        <div className="px-6 pb-6 flex-shrink-0">
          <button
            onClick={openModal}
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-yellow-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
            aria-label={`View ${title} session`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {viewSessionText}
          </button>
        </div>
      </div>

      <VideoModal
        isOpen={isModalOpen}
        closeModal={closeModal}
        title={title}
        videoId={videoId}
        videoUrl={videoUrl}
        href={href}
        image={image}
        comingSoonText={comingSoonText}
        comingSoonDescriptionText={comingSoonDescriptionText}
        visitWebsiteText={visitWebsiteText}
        closeText={closeText}
        sessionIdText={sessionIdText}
      />
    </>
  )
}
