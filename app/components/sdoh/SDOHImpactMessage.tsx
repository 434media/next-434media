"use client"
import { useEffect, useState } from "react"
import { FadeIn } from "../FadeIn"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

// Client-side only floating particles component
function FloatingParticles() {
  const [particles, setParticles] = useState<
    Array<{
      id: number
      top: string
      left: string
      delay: string
      duration: string
      size: "small" | "large"
    }>
  >([])

  useEffect(() => {
    // Generate particles only on the client side
    const newParticles: Array<{
      id: number
      top: string
      left: string
      delay: string
      duration: string
      size: "small" | "large"
    }> = []

    // Generate small cyan particles
    for (let i = 0; i < 6; i++) {
      newParticles.push({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        delay: `${i * 0.5}s`,
        duration: `${8 + Math.random() * 10}s`,
        size: "small",
      })
    }

    // Generate larger yellow particles
    for (let i = 0; i < 6; i++) {
      newParticles.push({
        id: i + 6,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        delay: `${i * 0.5}s`,
        duration: `${8 + Math.random() * 10}s`,
        size: "large",
      })
    }

    setParticles(newParticles)
  }, [])

  return (
    <>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute ${
            particle.size === "small" ? "w-4 h-4 bg-cyan-500/20" : "w-6 h-6 bg-yellow-500/20"
          } rounded-full animate-float-slow`}
          style={{
            top: particle.top,
            left: particle.left,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
        ></div>
      ))}
    </>
  )
}

interface SDOHImpactMessageProps {
  locale: Locale
  dict: Dictionary
}

export default function SDOHImpactMessage({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  locale,
  dict,
}: SDOHImpactMessageProps) {
  // Use the dictionary if provided, otherwise use default English text
  const d = dict?.sdoh?.impact || {
    // Default English text
    question: "What can I do to make a difference?",
    message: "If you've ever asked, ",
    conclusion: " — this is where you start.",
  }

  return (
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <blockquote className="relative">
                <div className="relative z-10">
                  <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight sm:leading-tight md:leading-tight lg:leading-tight">
                    <span className="text-neutral-800">{d.message}</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700 italic">
                      &quot;{d.question}&quot;
                    </span>
                    <span className="text-neutral-800">{d.conclusion}</span>
                  </p>
                </div>

                {/* Decorative quotes */}
                <div className="absolute -top-20 -left-16 text-9xl text-cyan-200/30 font-serif" aria-hidden="true">
                  &quot;
                </div>
                <div className="absolute -bottom-20 -right-16 text-9xl text-cyan-200/30 font-serif" aria-hidden="true">
                  &quot;
                </div>
              </blockquote>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <FloatingParticles />
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
  )
}
