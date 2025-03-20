"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { ScrambleText } from "./ScrambleText"
import { Newsletter } from "./Newsletter"

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 },
    )

    const footerElement = document.querySelector("footer")
    if (footerElement) {
      observer.observe(footerElement)
    }

    return () => {
      if (footerElement) {
        observer.unobserve(footerElement)
      }
    }
  }, [])

  return (
    <footer className="bg-neutral-950 mt-auto relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "100px",
            backgroundRepeat: "repeat",
          }}
        />
      </div>
      <div className="container mx-auto px-4 relative pt-16 sm:pt-24 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-white mb-8 font-menda-black text-3xl sm:text-4xl lg:text-5xl">
            <ScrambleText text="434 MEDIA" className="inline-block cursor-pointer" />
          </h2>
          <div className="border-t border-white/30 pt-8 sm:pt-16 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-md">
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-4">Subscribe to our newsletter</h3>
              <p className="text-base sm:text-lg text-gray-400 mb-6">
                Stay connected with our latest updates, product releases, and exclusive offers
              </p>
            </div>
            <Newsletter />
          </div>
          <div className="mt-12 pt-8 border-t border-white/30">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="text-sm sm:text-base text-neutral-400">
                  &copy; {currentYear} 434 MEDIA. All rights reserved
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}

