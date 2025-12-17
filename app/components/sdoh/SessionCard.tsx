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
  videoUrl,
  viewSessionText = "View Session",
  comingSoonText = "Coming Soon",
}: SessionCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const openModal = () => setIsModalOpen(true)
  const closeModal = () => setIsModalOpen(false)

  const hasVideo = videoUrl && videoUrl.trim() !== ""

  return (
    <>
      <div
        ref={cardRef}
        className="bg-white border border-neutral-200 overflow-hidden flex flex-col h-full min-h-[500px] transition-colors duration-200 hover:border-neutral-400 group"
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
          <Image
            src={image || "/placeholder.svg?height=720&width=1280&query=conference presentation"}
            alt={title}
            width={640}
            height={360}
            className="w-full h-full object-cover"
          />

          {/* Play indicator */}
          <div className="absolute top-4 right-4 z-20">
            <div className="bg-white p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {hasVideo ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-neutral-900"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-yellow-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              )}
            </div>
          </div>

          {/* Bottom accent line */}
          <div
            className={`absolute bottom-0 left-0 right-0 h-1 ${
              hasVideo ? "bg-cyan-500" : "bg-yellow-400"
            } transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20`}
          />
        </div>

        <div className="p-6 flex-grow flex flex-col">
          <h3 className="text-xl font-bold text-neutral-900 mb-3 flex-shrink-0">
            {title}
          </h3>
          <p className="text-neutral-700 mb-4 text-base leading-relaxed flex-grow">{description}</p>
        </div>

        <div className="px-6 pb-6 flex-shrink-0">
          <button
            onClick={openModal}
            className={`inline-flex items-center justify-center w-full py-3 px-4 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              hasVideo
                ? "bg-neutral-900 text-white hover:bg-cyan-600 focus:ring-neutral-900"
                : "bg-yellow-400 text-neutral-900 hover:bg-yellow-500 focus:ring-yellow-400"
            }`}
            aria-label={`${hasVideo ? "View" : "Preview"} ${title} session`}
          >
            {hasVideo ? (
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
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            )}
            {hasVideo ? viewSessionText : comingSoonText}
          </button>
        </div>
      </div>

      <VideoModal
        isOpen={isModalOpen}
        onClose={closeModal}
        videoSrc={videoUrl || ""}
        title={title}
        description={description}
      />
    </>
  )
}
