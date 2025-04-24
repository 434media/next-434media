"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { SDOHHero } from "../components/SDOHHero"
import { SDOHNewsletter } from "../components/SDOHNewsletter"
import { BackToTop } from "../components/BackToTop"
import { FadeIn } from "../components/FadeIn"
import Image from "next/image"
import Script from "next/script"
import { Dialog, DialogPanel, Transition, TransitionChild, DialogTitle } from "@headlessui/react"
import { Fragment } from "react"
import dynamic from "next/dynamic"

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false })

// Add the SessionCard component
const SessionCard = ({
  title,
  description,
  image,
  videoId,
  videoUrl,
}: {
  title: string
  description: string
  image: string
  videoId: string
  videoUrl?: string
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const openModal = () => setIsModalOpen(true)
  const closeModal = () => setIsModalOpen(false)

  return (
    <>
      <div
        ref={cardRef}
        className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200 flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:border-cyan-200 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        <div className="aspect-video relative overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 z-10"></div>

          {/* Play button - appears on hover/focus */}
          <div
            className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-300 ${
              isHovered || isFocused ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-4 border border-yellow-300/30 transform transition-transform duration-300 group-hover:scale-110">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          <Image
            src={image || "/placeholder.svg?height=720&width=1280&query=conference presentation"}
            alt={title}
            width={640}
            height={360}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <div className="p-6 flex-grow">
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600 mb-3">
            {title}
          </h3>
          <p className="text-neutral-700 mb-4">{description}</p>
        </div>

        <div className="px-6 pb-6 mt-auto">
          <button
            onClick={openModal}
            className="inline-flex items-center justify-center w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
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
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
            View Session
          </button>
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal isOpen={isModalOpen} closeModal={closeModal} title={title} videoId={videoId} videoUrl={videoUrl} />
    </>
  )
}

// Add the VideoModal component
const VideoModal = ({
  isOpen,
  closeModal,
  title,
  videoId,
  videoUrl,
}: {
  isOpen: boolean
  closeModal: () => void
  title: string
  videoId: string
  videoUrl?: string
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)

  // Handle keyboard events
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal()
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, closeModal])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setProgress(0)
    }
  }, [isOpen])

  const handleReady = () => {
    setIsLoading(false)
  }

  const handleProgress = (state: { played: number }) => {
    setProgress(state.played)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000)
    const hh = date.getUTCHours()
    const mm = date.getUTCMinutes()
    const ss = date.getUTCSeconds().toString().padStart(2, "0")
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`
    }
    return `${mm}:${ss}`
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/75" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-neutral-900 p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle as="h3" className="text-xl font-bold text-white mb-4 pr-8">
                  {title}
                </DialogTitle>

                <button
                  type="button"
                  className="absolute top-4 right-4 rounded-full bg-neutral-800 p-2 text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div ref={videoRef} className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {videoUrl ? (
                    <>
                      {/* Loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-white text-sm">Loading video...</p>
                          </div>
                        </div>
                      )}

                      {/* Video player */}
                      <ReactPlayer
                        url={videoUrl}
                        width="100%"
                        height="100%"
                        playing={isPlaying}
                        volume={isMuted ? 0 : volume}
                        onReady={handleReady}
                        onProgress={handleProgress}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        config={{
                          youtube: {
                            playerVars: {
                              modestbranding: 1,
                              rel: 0,
                            },
                          },
                        }}
                      />

                      {/* Custom controls overlay */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
                          isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
                        }`}
                      >
                        {/* Progress bar */}
                        <div className="w-full h-1 bg-neutral-700 rounded-full mb-3 cursor-pointer">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${progress * 100}%` }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between">
                          {/* Play/Pause button */}
                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400"
                            aria-label={isPlaying ? "Pause" : "Play"}
                          >
                            {isPlaying ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            )}
                          </button>

                          {/* Volume controls */}
                          <div className="flex items-center ml-4">
                            <button
                              onClick={toggleMute}
                              className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 mr-2"
                              aria-label={isMuted ? "Unmute" : "Mute"}
                            >
                              {isMuted ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                    clipRule="evenodd"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                  />
                                </svg>
                              )}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={volume}
                              onChange={handleVolumeChange}
                              className="w-20 accent-cyan-500"
                              aria-label="Volume"
                            />
                          </div>

                          {/* Fullscreen button */}
                          <button
                            onClick={() => {
                              if (videoRef.current) {
                                if (document.fullscreenElement) {
                                  document.exitFullscreen()
                                } else {
                                  videoRef.current.requestFullscreen()
                                }
                              }
                            }}
                            className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400 ml-4"
                            aria-label="Toggle fullscreen"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Placeholder for videos that aren't available yet (Card 3)
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                      <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-6 border-2 border-yellow-300/30 mb-6">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-16 w-16 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <h4 className="text-2xl font-bold text-cyan-400 mb-2">Coming Soon</h4>
                      <p className="text-white/80 max-w-md">
                        This video will be available after the event. Check back later to watch the full session.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
                  <div className="text-sm text-white/60">Session ID: {videoId}</div>
                  <div className="flex flex-wrap gap-3">
                    {videoUrl && (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                        >
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                          <polyline points="16 6 12 2 8 6"></polyline>
                          <line x1="12" y1="2" x2="12" y2="15"></line>
                        </svg>
                        Download Slides
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      onClick={closeModal}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default function SDOHClientPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Common heading styles for consistency
  const gradientHeadingClass = "font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600"
  const sectionHeadingClass = `${gradientHeadingClass} text-2xl sm:text-3xl md:text-4xl lg:text-6xl mb-4 sm:mb-6 text-center`
  const subHeadingClass = `${gradientHeadingClass} text-xl sm:text-2xl md:text-3xl mb-3 sm:mb-4`
  const cardHeadingClass = `${gradientHeadingClass} text-lg sm:text-xl md:text-2xl mb-2 sm:mb-3`

  return (
    <main className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Hero Section */}
      <SDOHHero />

      {/* Main content */}
      <div id="main-content" tabIndex={-1}>
        {/* Powered By Section - Combined with Resources */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6 max-w-6xl">
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-16">
                <h2 className={sectionHeadingClass}>Seminar + Speaker Series</h2>
                <p className="text-base sm:text-lg md:text-xl text-neutral-700 leading-relaxed">
                  Powered by <strong>VelocityTX</strong> and <strong>Methodist Healthcare Ministries</strong>, these
                  live events and panels are designed to spark conversation, raise awareness, and make complex health
                  topics feel approachable and relevant—especially for aspiring founders, healthcare workers, educators,
                  and community changemakers.
                </p>
              </div>

              {/* Replace the grid of 3 cards with this updated implementation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
                {/* Card 1 - With video implementation */}
                <SessionCard
                  title="Market Analysis and Value Delivery"
                  description="Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024 MHM Accelerator Cohort Champion"
                  image="https://ampd-asset.s3.us-east-2.amazonaws.com/rgv-startup-week-banner.png"
                  videoId="session1"
                  videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Shireen+Abdullah.mp4"
                />

                {/* Card 2 - With video implementation */}
                <SessionCard
                  title="Legal Considerations for Raising Capital"
                  description="Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI"
                  image="https://ampd-asset.s3.us-east-2.amazonaws.com/methodist-healthcare-logo.png"
                  videoId="session2"
                  videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Jose+Padilla.mp4"
                />

                {/* Card 3 - With placeholder */}
                <SessionCard
                  title="The Perfect Pitch"
                  description="Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc., Capital Factory"
                  image="https://ampd-asset.s3.us-east-2.amazonaws.com/velocitytx-logo.png"
                  videoId="session3"
                />
              </div>
            </FadeIn>

            {/* Upcoming Events Section (Formerly Resources) */}
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center mb-16">
                <h2 className={sectionHeadingClass}>Upcoming Events</h2>
                <p className="text-xl text-neutral-700 leading-relaxed">
                  Join these upcoming events to learn more about SDOH and how you can get involved in creating healthier
                  communities.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-16">
                {/* Left Side - Startup Bootcamp */}
                <div className="bg-white p-8 rounded-xl shadow-md">
                  <h3 className={`${subHeadingClass} flex items-center`}>
                    <span className="bg-cyan-100 text-cyan-700 p-2 rounded-full mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </span>
                    Startup Bootcamp
                  </h3>
                  <ul className="space-y-4">
                    <li className="pl-6 border-l-4 border-cyan-500">
                      <strong>When:</strong> April 25-27, 2025
                    </li>
                    <li className="pl-6 border-l-4 border-cyan-500">
                      <strong>Where:</strong> TSTC - Harlingen, Welcome Center
                    </li>
                    <li className="pl-6 border-l-4 border-cyan-500">
                      <strong>What:</strong> Embark on a transformative journey at our THREE-DAY Startup Bootcamp. Dive
                      into immersive workshops and collaborate with industry experts!
                    </li>
                  </ul>
                  <div className="mt-6">
                    <a
                      href="https://www.eventbrite.com/e/startup-bootcamp-tickets-1307199552049"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Reserve Your Spot
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Right Side - RGV Startup Week */}
                <div className="bg-white p-8 rounded-xl shadow-md">
                  <h3 className={`${subHeadingClass} flex items-center`}>
                    <span className="bg-yellow-100 text-yellow-700 p-2 rounded-full mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    RGV Startup Week
                  </h3>
                  <ul className="space-y-4">
                    <li className="pl-6 border-l-4 border-yellow-300">
                      <strong>When:</strong> April 25 - May 2, 2025
                    </li>
                    <li className="pl-6 border-l-4 border-yellow-300">
                      <strong>Where:</strong> Multiple venues across the RGV
                    </li>
                    <li className="pl-6 border-l-4 border-yellow-300">
                      <strong>What:</strong> A week-long celebration of entrepreneurship featuring workshops, panels,
                      and networking events. The <strong>SDOH Panel</strong> is a featured event during{" "}
                      <strong>RGV Startup Week</strong>.
                    </li>
                  </ul>
                  <div className="mt-6">
                    <a
                      href="https://rgvsw25.events.whova.com/registration"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Register Now
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Community Health Accelerator Info Box */}
              <div className="bg-gradient-to-r from-cyan-50 to-white p-8 rounded-xl shadow-md border border-cyan-100 mb-20">
                <h3 className={subHeadingClass}>Community Health Accelerator</h3>
                <p className="text-lg text-neutral-700 mb-4">
                  The Community Health Accelerator is a cohort-based program that provides growing companies the
                  assistance they need to overcome the challenges that frequently cause startup companies to fail.
                  Programming is modeled after the gold standards of the industry, and includes a structured curriculum,
                  mentoring, business education, operational advice, pitch coaching, peer collaboration, and more.
                </p>
                <p className="text-lg text-neutral-700 mb-4">
                  Cohort companies will participate in a public Demo Day pitch event at the conclusion of the
                  accelerator and receive the opportunity to run a pilot program of their technology in the Methodist
                  system.
                </p>
                <div className="mt-6">
                  <a
                    href="https://velocitytx.org/startup-programs/support/accelerator/"
                    className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                  >
                    Learn More About the Accelerator
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 ml-1"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </a>
                </div>
              </div>
            </FadeIn>

            {/* Newsletter Section - Moved Below */}
            <FadeIn>
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl p-6 sm:p-10 md:p-16 shadow-xl relative overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10" aria-hidden="true">
                  <Image src="/images/grid-pattern.svg" alt="" fill className="object-cover" />
                </div>

                {/* Accent elements */}
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-cyan-500 to-cyan-700"></div>
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>

                <div className="relative z-10">
                  <div className="max-w-3xl mx-auto text-center mb-6 sm:mb-10">
                    <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-4 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300">
                      Stay Connected
                    </h2>
                    <p className="text-base sm:text-lg md:text-xl text-white/90 leading-relaxed">
                      If you&apos;ve ever asked,{" "}
                      <strong className="text-yellow-300">&quot;What can I do to make a difference?&quot;</strong> —
                      this is where you start.
                    </p>
                  </div>
                  <div className="max-w-xl mx-auto">
                    <SDOHNewsletter />
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Banner Image - Fixed to ensure visibility */}
        <section className="bg-white mb-12 sm:mb-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-yellow-300/20 z-10"></div>

                {/* Banner image */}
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW.png"
                  alt="RGV Startup Week"
                  width={1920}
                  height={300}
                  className="w-full h-auto object-cover"
                  priority
                />

                {/* Animated border */}
                <div
                  className="absolute inset-0 border-2 sm:border-4 border-cyan-500/30 z-20"
                  style={{
                    animation: "pulseBorder 4s infinite alternate",
                  }}
                ></div>

                {/* Add inline styles for the animation */}
                <style jsx>{`
                  @keyframes pulseBorder {
                    0% { border-color: rgba(6, 182, 212, 0.3); }
                    50% { border-color: rgba(253, 224, 71, 0.3); }
                    100% { border-color: rgba(6, 182, 212, 0.3); }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .absolute {
                      animation: none !important;
                    }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Back to top button */}
      <BackToTop />

      <Script
        id="event-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: "¿Qué es SDOH? Panel Discussion",
            description:
              "Join us for a panel discussion on Social Determinants of Health (SDOH) during RGV Startup Week. Learn how local leaders, innovators, and entrepreneurs can turn awareness into action.",
            startDate: "2025-04-28T13:00:00-05:00",
            endDate: "2025-04-28T13:45:00-05:00",
            location: {
              "@type": "Place",
              name: "eBridge Center",
              address: {
                "@type": "PostalAddress",
                streetAddress: "1304 E Adams St",
                addressLocality: "Brownsville",
                addressRegion: "TX",
                postalCode: "78520",
                addressCountry: "US",
              },
            },
            organizer: {
              "@type": "Organization",
              name: "434 Media",
              url: "https://434media.com",
            },
            performer: [
              {
                "@type": "Person",
                name: "Marcos Resendez",
                jobTitle: "CEO",
                worksFor: {
                  "@type": "Organization",
                  name: "434 Media",
                },
              },
              {
                "@type": "Person",
                name: "Lina Rugova",
                jobTitle: "Founder",
                worksFor: {
                  "@type": "Organization",
                  name: "Emerge and Rise",
                },
              },
              {
                "@type": "Person",
                name: "Lyssa Ochoa",
                jobTitle: "Founder & Vascular Surgeon",
                worksFor: {
                  "@type": "Organization",
                  name: "The SAVE Clinic",
                },
              },
              {
                "@type": "Person",
                name: "Daniyal Liaqat",
                jobTitle: "CEO & Co-Founder",
                worksFor: {
                  "@type": "Organization",
                  name: "Tabiat Research",
                },
              },
            ],
          }),
        }}
      />
    </main>
  )
}
