"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ScrambleText } from "./ScrambleText"
import { Newsletter } from "./Newsletter"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false)
  const footerRef = useRef<HTMLElement>(null)
  const currentYear = new Date().getFullYear()

  // Updated footer links - Contact now links to /contact page
  const footerLinks: FooterLink[] = []

  useEffect(() => {
    // Use IntersectionObserver to detect when footer is visible
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setIsVisible(true)
          // Once visible, we can disconnect the observer
          if (footerRef.current) {
            observer.unobserve(footerRef.current)
          }
        }
      },
      { threshold: 0.1 },
    )

    // Capture the current value of the ref
    const currentFooterRef = footerRef.current

    if (currentFooterRef) {
      observer.observe(currentFooterRef)
    }

    // Clean up observer on component unmount
    return () => {
      if (currentFooterRef) {
        observer.unobserve(currentFooterRef)
      }
    }
  }, [])

  return (
    <footer
      ref={footerRef}
      className="bg-neutral-950 mt-auto relative overflow-visible"
      aria-labelledby="footer-heading"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" aria-hidden="true">
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
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 mb-8">
                <h2 id="footer-heading" className="text-white font-menda-black text-3xl sm:text-4xl lg:text-5xl">
                  <Link href="/" aria-label="434 Media - Home">
                    <ScrambleText
                      text="434 MEDIA"
                      className="inline-block cursor-pointer"
                      scrambleOnMount={false}
                      scrambleOnHover={true}
                    />
                  </Link>
                </h2>

                <Link
                  href="/contact"
                  className="group flex items-center gap-3 text-white transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded-lg px-2 py-1"
                >
                  <span className="text-lg sm:text-xl font-ggx88 tracking-wide">Actions Speak Louder</span>
                  <div className="relative">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-all duration-300 text-emerald-400 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover:drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  </div>
                </Link>
              </div>

              <div className="border-t border-white/30 pt-8 sm:pt-16">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                  <div className="max-w-md">
                    <h3 className="text-2xl font-semibold text-white mb-4">Subscribe to our newsletter</h3>
                    <p className="text-lg text-gray-400 tracking-tighter md:tracking-normal">
                      See how we blend creativity with community impact through innovative storytelling and design.
                    </p>
                  </div>
                  <Newsletter />
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-white/30">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-sm sm:text-base text-neutral-400">
                    &copy; {currentYear} 434 MEDIA. All rights reserved
                  </div>
                  <nav aria-label="Footer navigation">
                    <div className="flex items-center gap-4">
                      <a
                        href="https://www.linkedin.com/company/434media"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded p-1"
                        aria-label="Follow 434 Media on LinkedIn"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                      </a>
                      {/* Instagram link */}
                      <a
                        href="https://www.instagram.com/digitalcanvas.community/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded p-1"
                        aria-label="Follow 434 Media on Instagram"
                      >
                        <InstagramIcon className="w-6 h-6" />
                      </a>
                    </div>
                  </nav>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  )
}

// instagram svg icon
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props} fill="currentColor" aria-hidden="true">
      <path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 00-2.124 1.388 5.878 5.878 0 00-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 002.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 002.123-1.388 5.881 5.881 0 001.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 00-1.387-2.123 5.857 5.857 0 00-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 01-1.382-.895 3.695 3.695 0 01-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 011.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 01-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 101.437-1.442 1.44 1.44 0 00-1.437 1.442M5.839 12.012a6.161 6.161 0 1012.323-.024 6.162 6.162 0 00-12.323.024M8 12.008A4 4 0 1112.008 16 4 4 0 018 12.008" />
    </svg>
  )
}