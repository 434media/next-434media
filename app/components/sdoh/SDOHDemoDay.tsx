"use client"
import { useState, useRef } from "react"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "../../types/dictionary"
import { motion, AnimatePresence } from "motion/react"
import { VideoModal } from "./VideoModal"

interface SDOHDemoDayProps {
  locale: Locale
  dict: Partial<Dictionary>
}

export default function SDOHDemoDay({ dict }: SDOHDemoDayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Use type guards to safely access dictionary values
  const sdohDict = dict?.sdoh
  const demoDayDict = sdohDict?.demoDay

  // Default text with proper type guards
  const title = demoDayDict?.title || "Demo Day Highlights"
  const description =
    demoDayDict?.description ||
    "Watch how our accelerator cohort companies are transforming healthcare through innovation."

  const handlePlayClick = () => {
    setIsModalOpen(true)
  }

  const handleVideoLoad = () => {
    setIsLoading(false)
  }

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-2xl overflow-hidden shadow-xl border border-cyan-500/30 relative group"
          whileHover={{
            scale: 1.02,
            boxShadow: "0 25px 50px -12px rgba(6, 182, 212, 0.25)",
          }}
          transition={{ duration: 0.3 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          {/* Video container with Instagram aspect ratio (1080x1350 = 4:5) */}
          <div className="aspect-[4/5] relative overflow-hidden">
            {/* Loading skeleton */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center z-10"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Enhanced video element */}
            <motion.video
              ref={videoRef}
              className="w-full h-full object-cover transition-all duration-500"
              src="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
              poster="https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onLoadedData={handleVideoLoad}
              style={{
                filter: isHovered && !isPlaying ? "brightness(0.8)" : "brightness(1)",
              }}
            />

            {/* Enhanced Play Button Overlay */}
            <AnimatePresence>
              {(isHovered || !isPlaying) && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer"
                  onClick={handlePlayClick}
                >
                  {/* Background overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black"
                  />

                  {/* Play button container */}
                  <motion.div className="relative z-10" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    {/* Outer glow ring */}
                    <motion.div
                      className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 blur-xl opacity-60"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.6, 0.8, 0.6],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    />

                    {/* Main play button */}
                    <motion.div
                      className="relative w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl border-2 border-white/20"
                      animate={{
                        boxShadow: [
                          "0 10px 30px rgba(6, 182, 212, 0.3)",
                          "0 15px 40px rgba(6, 182, 212, 0.5)",
                          "0 10px 30px rgba(6, 182, 212, 0.3)",
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    >
                      {/* Inner highlight */}
                      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

                      {/* Play icon */}
                      <motion.svg
                        className="w-8 h-8 text-white ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        animate={isPlaying ? { opacity: 0 } : { opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path d="M8 5v14l11-7z" />
                      </motion.svg>

                      {/* Pause icon */}
                      <motion.svg
                        className="absolute w-8 h-8 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        animate={isPlaying ? { opacity: 1 } : { opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </motion.svg>
                    </motion.div>

                    {/* Ripple effect */}
                    <motion.div
                      className="absolute inset-0 w-20 h-20 rounded-full border-2 border-white/30"
                      animate={{
                        scale: [1, 1.5, 2],
                        opacity: [0.5, 0.2, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeOut",
                      }}
                    />
                  </motion.div>

                  {/* Play text */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-16 left-1/2 transform -translate-x-1/2"
                  >
                    <span className="text-white font-medium text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                      {isPlaying ? "Pause" : "Demo Day Recap"}
                    </span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Enhanced video title overlay */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-5"
              animate={{
                opacity: isHovered && isPlaying ? 0.7 : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              <motion.h3
                className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300 mb-2"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{
                  duration: 4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
                style={{
                  backgroundSize: "200% 100%",
                }}
              >
                Demo Day Recap
              </motion.h3>
              <motion.p
                className="text-sm sm:text-base md:text-lg text-white/90 max-w-md leading-relaxed"
                initial={{ opacity: 0.9 }}
                animate={{ opacity: [0.9, 1, 0.9] }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                Cohort companies will participate in a public Demo Day pitch event 
              </motion.p>
            </motion.div>

            {/* Enhanced corner accents */}
            <motion.div
              className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-400/60 rounded-tl-lg"
              animate={{
                opacity: [0.6, 1, 0.6],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-400/60 rounded-tr-lg"
              animate={{
                opacity: [0.6, 1, 0.6],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: 1,
              }}
            />
            <motion.div
              className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-yellow-400/60 rounded-bl-lg"
              animate={{
                opacity: [0.6, 1, 0.6],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: 2,
              }}
            />
            <motion.div
              className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-yellow-400/60 rounded-br-lg"
              animate={{
                opacity: [0.6, 1, 0.6],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: 3,
              }}
            />

            {/* Progress indicator when playing */}
            <AnimatePresence>
              {isPlaying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 z-10"
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 60, ease: "linear" }} // Adjust based on video length
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      {/* Video Modal */}
      <VideoModal
        isOpen={isModalOpen}
        closeModal={() => setIsModalOpen(false)}
        videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov"
        title={title}
        videoId="demo-day-v3"
        image="https://ampd-asset.s3.us-east-2.amazonaws.com/demoday-poster.png"
      />
    </FadeIn>
  )
}
