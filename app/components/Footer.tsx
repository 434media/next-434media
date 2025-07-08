"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ScrambleText } from "./ScrambleText"
import { Newsletter } from "./Newsletter"
import Link from "next/link"
import Image from "next/image"
import { AIMLogo } from "./AIMLogo"
import { ChevronRight } from "lucide-react"

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

export default function Footer() {
  const [isVisible, setIsVisible] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const footerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLLIElement>(null)
  const currentYear = new Date().getFullYear()

  // Updated footer links - Contact now links to /contact page
  const footerLinks: FooterLink[] = [{ label: "Contact", href: "/contact" }]

  const adminLinks = [
    { label: "Analytics Dashboard", href: "/analytics" },
    { label: "Blog Admin", href: "/admin/blog" },
    { label: "Media Admin", href: "/admin/blog/media" },
    { label: "Data Admin", href: "/admin/insert-data" },
  ]

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

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isMenuOpen])

  // Handle escape key to close menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener("keydown", handleEscapeKey)
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey)
    }
  }, [isMenuOpen])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

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

                <div className="flex items-center gap-4">
                  {/* SDOH Logo Link - Replaced text with SVG image */}
                  <Link
                    href="/sdoh"
                    className="group relative overflow-hidden rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
                    aria-label="Learn about SDOH"
                  >
                    <div className="relative z-10 h-6 w-auto transition-all duration-300 group-hover:opacity-80">
                      <Image
                        src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                        alt="¿Qué es SDOH?"
                        width={100}
                        height={24}
                        className="w-auto h-full grayscale"
                      />
                    </div>
                    <span className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-400/10 via-sky-400/10 to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded"></span>
                  </Link>

                  {/* AIM Logo Link */}
                  <Link
                    href="https://www.aimsatx.com/"
                    className="text-white hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded p-1 flex items-center justify-center"
                    aria-label="Visit AIM page"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="w-7 h-7 relative flex items-center justify-center">
                      <AIMLogo
                        variant="white"
                        className="w-full h-full transition-transform duration-300 hover:scale-110"
                      />
                    </div>
                  </Link>

                  {/* Shopify Store Link */}
                  <Link
                    href="/shop"
                    className="text-white hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded p-1 flex items-center justify-center"
                    aria-label="Visit our Shopify store"
                  >
                    <div className="w-6 h-6 relative">
                      <Image
                        src="https://ampd-asset.s3.us-east-2.amazonaws.com/shopify_glyph_white.svg"
                        alt="Shopify"
                        fill
                        className="object-contain transition-transform duration-300 hover:scale-110"
                      />
                    </div>
                  </Link>

                  {/* LinkedIn link */}
                  <a
                    href="https://www.linkedin.com/company/434media"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded p-1"
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
                </div>
              </div>

              <div className="border-t border-white/30 pt-8 sm:pt-16">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="max-w-md">
                    <h3 className="text-xl sm:text-2xl font-semibold text-white mb-4">Subscribe to our newsletter</h3>
                    <p className="text-base sm:text-lg text-gray-400">
                      Get insights on ROI-driven media strategies and creative approaches that deliver measurable
                      results.
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
                    <ul className="flex flex-wrap justify-center sm:justify-end gap-6 items-center">
                      {footerLinks.map((link) => (
                        <li key={link.label}>
                          {link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm sm:text-base text-neutral-400 hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded"
                            >
                              {link.label}
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              className="text-sm sm:text-base text-neutral-400 hover:text-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded"
                            >
                              {link.label}
                            </Link>
                          )}
                        </li>
                      ))}
                      <li className="relative" ref={menuRef}>
                        <button
                          onClick={toggleMenu}
                          className="text-sm sm:text-base text-neutral-400 hover:text-emerald-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-950 rounded-md flex items-center gap-2 px-3 py-2 hover:bg-neutral-800/50 group"
                          aria-expanded={isMenuOpen}
                          aria-haspopup="true"
                          aria-label="Admin menu"
                        >
                          Admin
                          <ChevronRight
                            className={`w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5 ${
                              isMenuOpen ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isMenuOpen && (
                            <>
                              {/* Enhanced backdrop overlay */}
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-md z-40"
                                onClick={closeMenu}
                              />

                              {/* Centered overlay menu */}
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 25,
                                  duration: 0.4,
                                }}
                                className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 sm:top-auto sm:bottom-0 sm:right-8 sm:left-auto sm:transform-none w-80 sm:w-72 bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl border border-neutral-700/60 rounded-2xl shadow-2xl z-50 overflow-hidden"
                              >
                                {/* Enhanced header with glow effect */}
                                <div className="relative px-6 py-4 border-b border-neutral-700/50 bg-gradient-to-r from-emerald-500/15 to-emerald-600/15">
                                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-emerald-600/5 blur-xl"></div>
                                  <div className="relative flex items-center justify-between">
                                    <div>
                                      <h4 className="text-base font-bold text-emerald-400 tracking-wide">
                                        ADMIN PANEL
                                      </h4>
                                      <p className="text-xs text-neutral-400 mt-1">Management Dashboard</p>
                                    </div>
                                    <button
                                      onClick={closeMenu}
                                      className="p-1 rounded-full hover:bg-neutral-800/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                      aria-label="Close admin menu"
                                    >
                                      <svg
                                        className="w-4 h-4 text-neutral-400 hover:text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Enhanced menu items */}
                                <div className="py-3">
                                  {adminLinks.map((adminLink, index) => (
                                    <motion.div
                                      key={adminLink.label}
                                      initial={{ opacity: 0, x: -30 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{
                                        delay: index * 0.1 + 0.1,
                                        duration: 0.4,
                                        ease: "easeOut",
                                      }}
                                    >
                                      <Link
                                        href={adminLink.href}
                                        onClick={closeMenu}
                                        className="group flex items-center px-6 py-4 text-sm text-neutral-300 hover:text-white hover:bg-gradient-to-r hover:from-emerald-500/15 hover:to-emerald-600/15 transition-all duration-300 border-l-3 border-transparent hover:border-emerald-500/60 focus:outline-none focus:bg-gradient-to-r focus:from-emerald-500/15 focus:to-emerald-600/15 focus:text-white focus:border-emerald-500/60 relative overflow-hidden"
                                      >
                                        {/* Hover glow effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                        <div className="relative flex items-center w-full">
                                          <div className="w-3 h-3 rounded-full bg-neutral-600 group-hover:bg-emerald-500 transition-all duration-300 mr-4 flex-shrink-0 group-hover:shadow-lg group-hover:shadow-emerald-500/30"></div>
                                          <div className="flex-1">
                                            <span className="font-semibold block">{adminLink.label}</span>
                                            <span className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors duration-300">
                                              {adminLink.label === "Analytics Dashboard" && "View site analytics"}
                                              {adminLink.label === "Blog Admin" && "Manage blog posts"}
                                              {adminLink.label === "Media Admin" && "Upload & organize media"}
                                              {adminLink.label === "Data Admin" && "Analytics & insights"}
                                            </span>
                                          </div>
                                          <ChevronRight className="w-4 h-4 ml-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 text-emerald-500" />
                                        </div>
                                      </Link>
                                    </motion.div>
                                  ))}
                                </div>

                                {/* Enhanced footer with additional info */}
                                <div className="px-6 py-4 border-t border-neutral-700/50 bg-neutral-950/60">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-neutral-500">Secure Access</p>
                                      <p className="text-xs text-emerald-400 font-medium">Authentication Required</p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                  </div>
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </li>
                    </ul>
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
