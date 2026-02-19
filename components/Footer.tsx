"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ScrambleText } from "./ScrambleText"
import { Newsletter } from "./Newsletter"
import Link from "next/link"

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false)
  const footerRef = useRef<HTMLElement>(null)
  const currentYear = new Date().getFullYear()

  const navLinks = [
    { label: "Work", href: "/work" },
    { label: "The Feed", href: "https://digitalcanvas.community/thefeed", external: true },
    { label: "Events", href: "https://devsa.community/events", external: true },
    { label: "Shop", href: "/shop" },
    { label: "Contact", href: "/contact" },
  ]

  const legalLinks = [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms-of-service" },
  ]

  const networkLinks = [
    { label: "TXMX Boxing", href: "https://www.txmxboxing.com/", external: true },
    { label: "Vemos Vamos", href: "https://www.vemosvamos.com/", external: true },
    { label: "Digital Canvas", href: "https://www.digitalcanvas.community", external: true },
    { label: "AMPD Project", href: "https://www.ampdproject.com/", external: true },
    { label: "Salute to Troops", href: "https://www.salutetotroops.com/", external: true },
    { label: "AIM R&D Summit", href: "https://www.aimsatx.com/", external: true },
    { label: "SDOH", href: "/sdoh" },
    { label: "DEVSA", href: "https://devsa.community", external: true },
  ]

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setIsVisible(true)
          if (footerRef.current) {
            observer.unobserve(footerRef.current)
          }
        }
      },
      { threshold: 0.1 },
    )

    const currentFooterRef = footerRef.current
    if (currentFooterRef) {
      observer.observe(currentFooterRef)
    }

    return () => {
      if (currentFooterRef) {
        observer.unobserve(currentFooterRef)
      }
    }
  }, [])

  return (
    <footer
      ref={footerRef}
      className="bg-neutral-950 mt-auto relative overflow-hidden"
      aria-labelledby="footer-heading"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
            backgroundSize: "80px",
            backgroundRepeat: "repeat",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {/* Main footer grid — Brand / Nav / Network / Newsletter */}
              <div className="py-12 md:py-16 border-b border-white/10">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-y-10 gap-x-6 md:gap-x-8">
                  {/* Brand */}
                  <div className="col-span-2 md:col-span-3">
                    <h2 id="footer-heading" className="font-menda-black text-white text-2xl leading-none mb-3">
                      <Link href="/" aria-label="434 Media - Home">
                        <ScrambleText
                          text="434 MEDIA"
                          className="inline-block cursor-pointer"
                          scrambleOnMount={false}
                          scrambleOnHover={true}
                        />
                      </Link>
                    </h2>
                    <p className="font-geist-sans text-sm text-neutral-500 leading-relaxed max-w-xs mb-5">
                      Where creativity meets community. Bold stories, proven impact.
                    </p>
                    {/* Social */}
                    <div className="flex items-center gap-3">
                      <a
                        href="https://www.linkedin.com/company/434media"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-white transition-colors duration-200"
                        aria-label="Follow 434 Media on LinkedIn"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                      </a>
                      <a
                        href="https://www.instagram.com/digitalcanvashq/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-white transition-colors duration-200"
                        aria-label="Follow 434 Media on Instagram"
                      >
                        <InstagramIcon className="w-4.5 h-4.5" />
                      </a>
                    </div>
                  </div>

                  {/* Nav Links */}
                  <nav className="md:col-span-2" aria-label="Footer navigation">
                    <p className="font-geist-sans text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-4 leading-none">
                      Navigate
                    </p>
                    <ul className="space-y-2.5">
                      {navLinks.map((link) => (
                        <li key={link.label}>
                          {link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-geist-sans text-sm text-neutral-400 hover:text-white transition-colors duration-200 leading-tight"
                            >
                              {link.label}
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              className="font-geist-sans text-sm text-neutral-400 hover:text-white transition-colors duration-200 leading-tight"
                            >
                              {link.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </nav>

                  {/* Network Links */}
                  <div className="md:col-span-3">
                    <p className="font-geist-sans text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-4 leading-none">
                      Network
                    </p>
                    <ul className="grid grid-cols-2 md:grid-cols-2 gap-x-6 gap-y-2.5">
                      {networkLinks.map((link) => (
                        <li key={link.label}>
                          {link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-geist-sans text-sm text-neutral-400 hover:text-white transition-colors duration-200 leading-tight"
                            >
                              {link.label}
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              className="font-geist-sans text-sm text-neutral-400 hover:text-white transition-colors duration-200 leading-tight"
                            >
                              {link.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Newsletter */}
                  <div className="col-span-2 md:col-span-4">
                    <p className="font-geist-sans text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-4 leading-none">
                      Subscribe to The Feed
                    </p>
                    <p className="font-geist-sans text-sm text-neutral-500 leading-relaxed mb-4 max-w-sm">
                      The latest newsletters and community spotlights from 434 MEDIA x DEVSA.
                    </p>
                    <Newsletter />
                  </div>
                </div>
              </div>

              {/* Copyright + Legal */}
              <div className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="font-geist-sans text-xs text-neutral-600 leading-none">
                  &copy; {currentYear} 434 MEDIA. All rights reserved.
                </p>
                <div className="flex items-center gap-4">
                  {legalLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="font-geist-sans text-xs text-neutral-600 hover:text-neutral-400 transition-colors duration-200 leading-none"
                    >
                      {link.label}
                    </Link>
                  ))}
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