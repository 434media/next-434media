"use client"

import type React from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import { SDOHHero } from "../components/SDOHHero"
import { SDOHNewsletter } from "../components/SDOHNewsletter"
import { BackToTop } from "../components/BackToTop"
import { FadeIn } from "../components/FadeIn"
import Image from "next/image"
import Script from "next/script"

// Update the component to use consistent styling and better accessibility
export default function SDOHClientPage() {
  const [mounted, setMounted] = useState(false)
  const detailsRef = useRef<HTMLElement>(null)
  const heroRef = useRef(null)

  // Add these state variables for video functionality
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // Add these functions to control video playback
  const toggleVideoPlayback = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      // Attempt to play and handle any autoplay restrictions
      const playPromise = videoRef.current.play()

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback started successfully
          })
          .catch((error) => {
            // Auto-play was prevented
            console.error("Video playback was prevented:", error)
            setIsPlaying(false)
          })
      }
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return

    const newMutedState = !isMuted
    videoRef.current.muted = newMutedState
    setIsMuted(newMutedState)
  }

  // Add a useCallback for any event handlers
  const handleVideoKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      // Video play functionality would go here
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Common heading styles for consistency - improved with better contrast and sizing
  const gradientHeadingClass = "font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700"
  const sectionHeadingClass = `${gradientHeadingClass} text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-6 sm:mb-8 text-center`
  const subHeadingClass = `${gradientHeadingClass} text-xl sm:text-2xl md:text-3xl mb-4 sm:mb-5`
  const cardHeadingClass = `${gradientHeadingClass} text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4`

  return (
    <main className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
      >
        Skip to main content
      </a>

      {/* Hero Section */}
      <SDOHHero />

      {/* Main content */}
      <div id="main-content" className="outline-none" tabIndex={-1}>
        <section className="py-16 bg-gradient-to-b from-white via-cyan-50/30 to-white">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
            <div className="relative">
              {/* Background decorative elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/5 blur-3xl"></div>
                <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-yellow-500/5 blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-cyan-500/5 blur-3xl"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                {/* Startup Bootcamp Section - Updated with component number */}
                <FadeIn>
                  <div className="max-w-3xl mx-auto mb-16 sm:mb-20">
                    <div className="text-center mb-10">
                      {/* Updated heading with component number */}
                      <div className="flex items-center justify-center mb-6">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-4 shadow-lg">
                          2
                        </div>
                        <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700">
                          Startup Bootcamp
                        </h2>
                      </div>
                      <div className="inline-block p-1.5 px-3 mb-4 rounded-full bg-cyan-100/80 backdrop-blur-sm text-cyan-800 text-sm font-medium">
                        Early-Stage Program
                      </div>
                      <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto">
                        A hands-on, early-stage program that helps local entrepreneurs turn ideas into action.
                        Participants receive guidance on business models, impact measurement, funding strategies, and
                        how to build solutions that address real community needs.
                      </p>
                    </div>

                    {/* RGVSW Sign Up Card */}
                    <div className="relative overflow-hidden rounded-2xl shadow-xl border border-cyan-200 group transition-all duration-500 hover:shadow-cyan-200/20 hover:border-cyan-300">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-yellow-300/10 z-0 group-hover:opacity-70 transition-opacity duration-500"></div>

                      <div className="relative z-10 p-8 sm:p-10 flex flex-col md:flex-row items-center gap-8">
                        {/* Left side - Image */}
                        <div className="w-full md:w-2/5 flex-shrink-0">
                          <div className="relative rounded-xl overflow-hidden shadow-lg border border-neutral-200/50">
                            <Image
                              src="https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW.png"
                              alt="RGV Startup Week"
                              width={500}
                              height={300}
                              className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 to-transparent"></div>
                            <div className="absolute bottom-3 left-3 bg-yellow-400/90 text-neutral-900 text-xs font-bold px-2 py-1 rounded">
                              April 25-27, 2025
                            </div>
                          </div>
                        </div>

                        {/* Right side - Content */}
                        <div className="w-full md:w-3/5">
                          <h3 className="text-xl sm:text-2xl font-bold text-neutral-800 mb-3">
                            RGV Startup Week Bootcamp
                          </h3>
                          <ul className="space-y-3 mb-6">
                            <li className="flex items-start">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-cyan-600 mt-0.5 mr-2 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="text-neutral-700">
                                <strong className="text-neutral-900">When:</strong> April 25-27, 2025
                              </span>
                            </li>
                            <li className="flex items-start">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-cyan-600 mt-0.5 mr-2 flex-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              <span className="text-neutral-700">
                                <strong className="text-neutral-900">Where:</strong> TSTC - Harlingen, Welcome Center
                              </span>
                            </li>
                          </ul>
                          <a
                            href="https://www.eventbrite.com/e/startup-bootcamp-tickets-1307199552049"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
                            aria-label="Reserve your spot for the Startup Bootcamp"
                          >
                            Reserve Your Spot
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 ml-2"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                              <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>

                {/* Community Health Accelerator Section - Updated with component number */}
                <FadeIn>
                  <div className="max-w-3xl mx-auto mb-16 sm:mb-20">
                    <div className="text-center mb-10">
                      {/* Updated heading with component number */}
                      <div className="flex items-center justify-center mb-6">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-4 shadow-lg">
                          3
                        </div>
                        <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700">
                          Community Health Accelerator
                        </h2>
                      </div>
                      <div className="inline-block p-1.5 px-3 mb-4 rounded-full bg-yellow-100/80 backdrop-blur-sm text-yellow-800 text-sm font-medium">
                        Growth-Stage Program
                      </div>
                      <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto">
                        For startups ready to scale, this accelerator provides deeper support—from mentoring and expert
                        workshops to connections with healthcare systems, investors, and ecosystem partners focused on
                        sustainable health innovation.
                      </p>
                      <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto mt-4">
                        This program exists to answer big questions in a practical way—and to make sure the people
                        closest to the issues have the tools, resources, and support to solve them.
                      </p>
                    </div>
                  </div>
                </FadeIn>

                {/* Demo Day Video Section - Enhanced with proper video controls */}
                <FadeIn>
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden shadow-xl border border-cyan-500/30 transform transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-cyan-500/10">
                      <div className="aspect-video relative flex items-center justify-center">
                        {/* Video player with controls */}
                        <div className="absolute inset-0 z-0">
                          <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            src="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
                            playsInline
                            preload="metadata"
                            poster="https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => setIsPlaying(false)}
                            onLoadStart={() => setIsLoading(true)}
                            onCanPlay={() => setIsLoading(false)}
                            onError={() => {
                              setIsLoading(false)
                              setHasError(true)
                            }}
                            aria-label="Demo Day Highlights video"
                          />
                        </div>

                        {/* Loading overlay */}
                        {isLoading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                            <div className="flex flex-col items-center">
                              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                              <p className="text-white text-sm">Loading video...</p>
                            </div>
                          </div>
                        )}

                        {/* Error overlay */}
                        {hasError && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                            <div className="text-center p-6">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-12 w-12 text-red-500 mx-auto mb-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <h4 className="text-xl font-bold text-white mb-2">Video Error</h4>
                              <p className="text-white/80">
                                There was a problem loading the video. Please try again later.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Play button overlay - only shown when video is not playing */}
                        {!isPlaying && !isLoading && !hasError && (
                          <button
                            className="group absolute inset-0 flex items-center justify-center z-10 bg-black/30 transition-all duration-300 hover:bg-black/40 focus:outline-none focus:bg-black/40"
                            onClick={toggleVideoPlayback}
                            aria-label="Play Demo Day video"
                          >
                            <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-6 border-2 border-yellow-300/30 transition-all duration-300 group-hover:scale-110 group-focus:scale-110 group-hover:bg-cyan-500/30 group-focus:bg-cyan-500/30">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-16 w-16 text-white group-hover:text-yellow-300 group-focus:text-yellow-300 transition-colors duration-300"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </button>
                        )}

                        {/* Video controls overlay - only shown when video is playing */}
                        {isPlaying && (
                          <>
                            {/* Persistent pause button in the center */}
                            <button
                              onClick={toggleVideoPlayback}
                              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 rounded-full p-4 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
                              aria-label="Pause video"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-10 w-10 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                              </svg>
                            </button>

                            {/* Bottom controls bar - appears on hover */}
                            <div
                              className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10 opacity-0 hover:opacity-100 transition-opacity duration-300"
                              aria-hidden="true"
                            >
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={toggleVideoPlayback}
                                  className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400"
                                  aria-label="Pause video"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-8 w-8"
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
                                </button>

                                <button
                                  onClick={toggleMute}
                                  className="text-white hover:text-cyan-400 focus:outline-none focus:text-cyan-400"
                                  aria-label={isMuted ? "Unmute video" : "Mute video"}
                                >
                                  {isMuted ? (
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
                                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
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
                                      className="h-6 w-6"
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
                              </div>
                            </div>
                          </>
                        )}

                        {/* Video title overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-10">
                          <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300 mb-2">
                            Demo Day Highlights
                          </h3>
                          <p className="text-base md:text-lg text-white/90 max-w-md">
                            Watch how our accelerator cohort companies are transforming healthcare through innovation.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Learn more link */}
                    <div className="text-center mt-8">
                      <a
                        href="https://velocitytx.org/startup-programs/support/accelerator/"
                        className="inline-flex items-center text-cyan-700 hover:text-cyan-800 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                        aria-label="Learn more about the Community Health Accelerator"
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
                          aria-hidden="true"
                        >
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </a>
                    </div>
                  </div>
                </FadeIn>

                {/* Wow Impact Message Section */}
                <section className="py-16 sm:py-24 overflow-hidden relative">
                  <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
                    <FadeIn>
                      <div className="relative">
                        {/* Background elements */}
                        <div className="absolute inset-0 -z-10" aria-hidden="true">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-32 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent transform -rotate-3"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-32 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent transform rotate-3"></div>
                        </div>

                        {/* Main content */}
                        <div className="max-w-4xl mx-auto text-center">
                          <div className="inline-block mb-6">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-16 w-16 text-cyan-600 mx-auto animate-pulse"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </div>

                          <blockquote className="relative">
                            <div className="relative z-10">
                              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight sm:leading-tight md:leading-tight lg:leading-tight">
                                <span className="text-neutral-800">If you've ever asked, </span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700 italic">
                                  "What can I do to make a difference?"
                                </span>
                                <span className="text-neutral-800"> — this is where you start.</span>
                              </p>
                            </div>

                            {/* Decorative quotes */}
                            <div
                              className="absolute -top-20 -left-16 text-9xl text-cyan-200/30 font-serif"
                              aria-hidden="true"
                            >
                              "
                            </div>
                            <div
                              className="absolute -bottom-20 -right-16 text-9xl text-cyan-200/30 font-serif"
                              aria-hidden="true"
                            >
                              "
                            </div>
                          </blockquote>
                        </div>
                      </div>
                    </FadeIn>
                  </div>

                  {/* Floating particles */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className={`absolute w-4 h-4 rounded-full bg-cyan-500/20 animate-float-slow`}
                        style={{
                          top: `${Math.random() * 100}%`,
                          left: `${Math.random() * 100}%`,
                          animationDelay: `${i * 0.5}s`,
                          animationDuration: `${8 + Math.random() * 10}s`,
                        }}
                      ></div>
                    ))}
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i + 6}
                        className={`absolute w-6 h-6 rounded-full bg-yellow-500/20 animate-float-slow`}
                        style={{
                          top: `${Math.random() * 100}%`,
                          left: `${Math.random() * 100}%`,
                          animationDelay: `${i * 0.5}s`,
                          animationDuration: `${8 + Math.random() * 10}s`,
                        }}
                      ></div>
                    ))}
                  </div>

                  {/* Add animation keyframes */}
                  <style jsx>{`
                    @keyframes float-slow {
                      0% { transform: translateY(0) translateX(0); opacity: 0; }
                      50% { opacity: 1; }
                      100% { transform: translateY(-100px) translateX(100px); opacity: 0; }
                    }
                    .animate-float-slow {
                      animation: float-slow linear infinite;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .animate-float-slow, .animate-pulse {
                        animation: none !important;
                      }
                    }
                  `}</style>
                </section>

                <div className="container mx-auto px-4 sm:px-6 max-w-5xl mb-16 sm:mb-24">
                  {/* Newsletter Section - Moved Below */}
                  <FadeIn>
                    <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl p-8 sm:p-10 md:p-16 shadow-xl relative overflow-hidden">
                      {/* Accent elements */}
                      <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-cyan-500 to-cyan-700"></div>
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>

                      <div className="relative z-10">
                        <div className="max-w-3xl mx-auto text-center mb-8 sm:mb-10">
                          <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-4 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300">
                            Signup for "Que es SDOH" newsletter
                          </h2>
                          <p className="text-base sm:text-lg md:text-xl text-white/90 leading-relaxed">
                            Join the conversation now.
                          </p>
                        </div>
                        <div className="max-w-xl mx-auto">
                          <SDOHNewsletter />
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                </div>
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
