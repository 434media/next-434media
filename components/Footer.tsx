"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowUpRight, Mail, MapPin } from "lucide-react"
import { InstagramIcon } from "@/components/icons/InstagramIcon"
import { ScrambleText } from "./ScrambleText"
import { Newsletter } from "./Newsletter"
import { BRAND } from "@/lib/seo/brand"

export default function Footer() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)
  const footerRef = useRef<HTMLElement>(null)
  const currentYear = new Date().getFullYear()

  // Hide the public footer on admin routes and the full-screen squads deck
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/squads")) {
    return null
  }

  // "Build with us" — close the loop on this page.
  const buildLinks = [
    { label: "Start a project", href: "/contact", emphasis: true },
    { label: "Our work", href: "/work" },
    { label: "Shop TXMX", href: "/shop" },
  ]

  const legalLinks = [
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Terms", href: "/terms-of-service" },
  ]

  // Sub-brands and partners we operate or co-produce with.
  const subBrands = [
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
            backgroundImage: `url('https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/434MediaICONWHITE.png')`,
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
              {/* Main footer grid — Brand / Build / Sub-brands / Newsletter */}
              <div className="py-12 md:py-16 border-b border-white/10">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-y-10 gap-x-6 md:gap-x-8">
                  {/* Brand column — elevator pitch + social */}
                  <div className="col-span-2 md:col-span-3">
                    <h2 id="footer-heading" className="font-menda-black text-white text-2xl leading-none mb-4">
                      <Link href="/" aria-label="434 Media — Home">
                        <ScrambleText
                          text="434 MEDIA"
                          className="inline-block cursor-pointer"
                          scrambleOnMount={false}
                          scrambleOnHover={true}
                        />
                      </Link>
                    </h2>
                    <p className="font-geist-sans text-sm text-white font-medium leading-snug max-w-xs mb-2">
                      {BRAND.shortTagline}
                    </p>
                    <p className="font-geist-sans text-sm text-neutral-400 leading-relaxed max-w-xs mb-5">
                      {BRAND.description}
                    </p>
                    {/* Social */}
                    <div className="flex items-center gap-3">
                      <a
                        href="https://www.linkedin.com/company/434media"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-white transition-colors duration-200"
                        aria-label="Follow 434 MEDIA on LinkedIn"
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
                        aria-label="Follow 434 MEDIA on Instagram"
                      >
                        <InstagramIcon className="w-4.5 h-4.5" />
                      </a>
                    </div>
                  </div>

                  {/* Build with us — internal CTAs + NAP */}
                  <nav className="md:col-span-3" aria-label="Footer site links">
                    <p className="font-geist-mono text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.2em] mb-4 leading-none">
                      Build with us
                    </p>
                    <ul className="space-y-2.5 mb-6">
                      {buildLinks.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className={`font-geist-sans text-sm transition-colors duration-200 leading-tight ${
                              link.emphasis
                                ? "text-white font-medium hover:text-neutral-300"
                                : "text-neutral-400 hover:text-white"
                            }`}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="space-y-2 pt-5 border-t border-white/5">
                      <a
                        href="mailto:build@434media.com"
                        className="group flex items-start gap-2 font-geist-sans text-sm text-neutral-400 hover:text-white transition-colors duration-200"
                      >
                        <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>build@434media.com</span>
                      </a>
                      <p className="flex items-start gap-2 font-geist-sans text-sm text-neutral-500 leading-snug">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                          816 Camaron St., Suite 1.11
                          <br />
                          San Antonio, TX 78212
                        </span>
                      </p>
                    </div>
                  </nav>

                  {/* Sub-brands */}
                  <div className="md:col-span-3">
                    <p className="font-geist-mono text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.2em] mb-4 leading-none">
                      Sub-brands
                    </p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {subBrands.map((link) => (
                        <li key={link.label}>
                          {link.external ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 font-geist-sans text-sm text-neutral-400 hover:text-white transition-colors duration-200 leading-tight"
                            >
                              <span>{link.label}</span>
                              <ArrowUpRight
                                className="h-3 w-3 text-neutral-600 transition-all duration-200 group-hover:text-white group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                aria-hidden="true"
                              />
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

                  {/* Newsletter — value-prop-led copy */}
                  <div className="col-span-2 md:col-span-3">
                    <p className="font-geist-mono text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.2em] mb-4 leading-none">
                      The Feed · Newsletter
                    </p>
                    <p className="font-geist-sans text-sm text-neutral-400 leading-relaxed mb-4 max-w-sm">
                      Field notes from the studio — what we&apos;re producing, what&apos;s launching,
                      who&apos;s working on it.
                    </p>
                    <Newsletter />
                    <p className="mt-3 font-geist-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                      No spam · 1 send/month
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom strip — copyright, legal, contact echo */}
              <div className="py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-geist-sans text-xs text-neutral-600 leading-none">
                  &copy; {currentYear} 434 MEDIA · {BRAND.shortTagline}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {legalLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="font-geist-sans text-xs text-neutral-600 hover:text-neutral-300 transition-colors duration-200 leading-none"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <span className="font-geist-sans text-xs text-neutral-700 leading-none" aria-hidden="true">·</span>
                  <a
                    href="mailto:build@434media.com"
                    className="font-geist-sans text-xs text-neutral-600 hover:text-neutral-300 transition-colors duration-200 leading-none"
                  >
                    build@434media.com
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  )
}

