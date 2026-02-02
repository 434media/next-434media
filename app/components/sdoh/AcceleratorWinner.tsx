"use client"

import { useRef, useState } from "react"
import { motion, useInView } from "motion/react"
import Image from "next/image"
import type { Locale } from "../../../i18n-config"

interface AcceleratorWinnerProps {
  locale: Locale
}

/**
 * AcceleratorWinner - Spotlight section for the 2025 Accelerator Winner (InovCares)
 * 
 * Features Mohamed Kamara's story with an embedded YouTube video.
 * Inspired by page 10 of the MHMxVelocity Impact Report.
 */
export default function AcceleratorWinner({ locale }: AcceleratorWinnerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  const content = locale === "es" ? {
    badge: "GANADOR DEL ACELERADOR 2025",
    title: "Sobre InovCares",
    founderName: "Mohamed Kamara",
    founderRole: "CEO/Fundador",
    story: "La inspiración del fundador Mohamed Kamara para crear un recurso para la salud y el bienestar de la mujer durante toda su vida comenzó en Sierra Leona. Después de perder a su hermana durante el parto debido a una condición prevenible llamada preeclampsia, reconoció la necesidad global de educación y prevención consolidadas.",
    watchVideo: "Ver la Historia de Mo",
    quote: "Aplaudimos la audaz visión de InovCares y esperamos con ansias el cambio positivo que traerán a la salud y el bienestar de nuestras comunidades.",
    quoteAuthor: "Jaime Wesolowski",
    quoteRole: "Presidente y CEO de Methodist Healthcare Ministries of South Texas, Inc.",
  } : {
    badge: "2025 ACCELERATOR WINNER",
    title: "About InovCares",
    founderName: "Mohamed Kamara",
    founderRole: "CEO/Founder",
    story: "Founder Mohamed Kamara's inspiration to create a women's resource for a lifetime of health and wellness began in Sierra Leone. After losing his sister during childbirth due to a preventable condition called pre-eclampsia, he recognized the global need for consolidated education and prevention.",
    watchVideo: "Watch Mo's Story",
    quote: "We applaud InovCares's bold vision and eagerly anticipate the positive change they will bring to the health and well-being of our communities.",
    quoteAuthor: "Jaime Wesolowski",
    quoteRole: "President & CEO of Methodist Healthcare Ministries of South Texas, Inc.",
  }

  const youtubeVideoId = "LrTEGcjb1xo"

  return (
    <section ref={ref} className="py-20 sm:py-28 lg:py-32 bg-[#FF6B35] relative overflow-hidden">
      {/* Decorative wave background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="absolute top-0 right-0 w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M ${800 + i * 30} 0 Q ${600 - i * 20} 150, ${700 + i * 20} 300 T ${800 + i * 30} 600`}
              fill="none"
              stroke="#A31545"
              strokeWidth={2 - i * 0.3}
              strokeOpacity={0.5 - i * 0.08}
            />
          ))}
        </svg>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Video and Founder Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-white text-[#A31545] text-sm font-bold tracking-wider mb-6">
              <div className="w-2 h-2 bg-[#A31545] rounded-full mr-3" />
              {content.badge}
            </div>

            {/* Title */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-8">
              {content.title}
            </h2>

            {/* Video Embed */}
            <div className="relative aspect-video bg-neutral-900 rounded-lg overflow-hidden mb-8 border-4 border-white/20">
              {!isVideoPlaying ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Video Thumbnail */}
                  <Image
                    src={`https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`}
                    alt="InovCares Story Video Thumbnail"
                    fill
                    className="object-cover"
                  />
                  
                  {/* Play Button Overlay */}
                  <button
                    onClick={() => setIsVideoPlaying(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors group"
                    aria-label="Play video"
                  >
                    <div className="w-20 h-20 rounded-full bg-[#A31545] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </button>

                  {/* Watch CTA */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center text-white">
                    <span className="text-sm font-semibold">{content.watchVideo}</span>
                  </div>
                </div>
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
                  title="InovCares Story - Starting Families"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              )}
            </div>

            {/* Founder Card */}
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
                MK
              </div>
              <div>
                <p className="text-white font-bold text-lg">{content.founderName}</p>
                <p className="text-white/80 text-sm">{content.founderRole}</p>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Story and Quote */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Founder Story */}
            <p className="text-white/90 text-lg leading-loose mb-10">
              {content.story}
            </p>

            {/* Quote Block */}
            <div className="relative bg-white rounded-lg p-8">
              {/* Quote mark */}
              <div className="absolute -top-4 left-6 text-[#A31545] text-6xl font-serif leading-none">
                &ldquo;
              </div>
              
              <blockquote className="relative z-10">
                <p className="text-neutral-700 text-lg italic leading-relaxed mb-6 pt-4">
                  {content.quote}
                </p>
                
                <footer className="border-t border-neutral-200 pt-4">
                  <p className="text-[#A31545] font-bold">~ {content.quoteAuthor}</p>
                  <p className="text-neutral-500 text-sm">{content.quoteRole}</p>
                </footer>
              </blockquote>
            </div>

            {/* InovCares Logo Placeholder */}
            <div className="mt-8 flex items-center justify-center">
              <div className="text-white text-3xl font-black tracking-tight">
                Inov<span className="text-[#A31545]">Cares</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
