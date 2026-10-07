"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Newsletter } from "./Newsletter"
import { BRAND } from "@/lib/seo/brand"
import { BRAND_RECORDS } from "@/lib/brand-records"

export default function Footer() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)
  const footerRef = useRef<HTMLElement>(null)
  const currentYear = new Date().getFullYear()

  // "Build with us" — close the loop on this page.
  const buildLinks = [
    { label: "Start a production", href: "/contact", emphasis: true },
  ]

  const legalLinks = [
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Terms", href: "/terms-of-service" },
  ]

  // The footer reveals when it nears the viewport, not when a fraction of it is
  // inside one.
  //
  // It used to ask for `threshold: 0.1` - "is 10% of this element visible" - of
  // an element that is EMPTY until the answer is yes. An empty footer is zero
  // pixels tall, so it has no area for a tenth of, and it only gains height by
  // rendering the content this observer is gating. Content needs to be seen to
  // render and needs to render to be seeable.
  //
  // On most pages that resolved anyway, because the content above is long
  // enough that a zero-height footer still lands inside the viewport. On the
  // Work page it did not: at maximum scroll the footer sat 0.21px BELOW the
  // fold, and a zero-height element contributes no scrollable height to push
  // itself into view. The page had no footer at all, and nothing reported it.
  //
  // `rootMargin` asks a question the element's own size cannot invalidate: is
  // the bottom of the document within 300px. Same correction as the Work card
  // videos, same underlying mistake - a threshold expressed as a fraction of
  // the element is a fraction of the wrong thing.
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
      { rootMargin: "300px 0px", threshold: 0 },
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

  // Hide the public footer on application surfaces that provide their own shell.
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/squads") ||
    pathname?.startsWith("/travel")
  ) {
    return null
  }

  return (
    <footer
      ref={footerRef}
      className="bg-[var(--color-chrome-bg)] mt-auto relative overflow-hidden"
      aria-labelledby="footer-heading"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        {/* Fades in once, when it nears the viewport (.m-footer-in,
            globals.css). It never leaves, so there was no exit to keep. */}
        {isVisible && (
            <div
              className="m-footer-in"
            >
              {/* Main footer grid — Brand / Build / Newsletter */}
              <div className="py-12 md:py-16 border-b border-[var(--color-chrome-divider)]">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-y-10 gap-x-6 md:gap-x-8">
                  {/* Brand column — elevator pitch + social. Width tracks the
                      max-w-xs copy; a wider column just opens a gap. */}
                  <div className="col-span-2 md:col-span-4">
                    <h2 id="footer-heading" className="mb-4">
                      <Link href="/" className="inline-block" aria-label="434 Media — Home">
                        <Image
                          src="/brand/434-primary-light.svg"
                          alt="434 MEDIA"
                          width={168}
                          height={36}
                          className="h-auto w-[120px]"
                        />
                      </Link>
                    </h2>
                    <p className="font-geist-sans t-body-s text-[var(--color-chrome-text)] max-w-xs mb-2">
                      {BRAND_RECORDS.mottoStyled}
                    </p>
                    <p className="font-geist-sans t-body-s text-[var(--color-chrome-text-secondary)] max-w-xs mb-5">
                      {BRAND.description}
                    </p>
                    {/* Social */}
                    <div className="flex items-center gap-3">
                      <a
                        href="https://www.linkedin.com/company/434media"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-chrome-icon)] hover:text-[var(--color-chrome-text)] transition-colors duration-200"
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
                    </div>
                  </div>

                  {/* Build with us — internal CTAs. The contact route is the one
                      way in; there is no email/address echo here anymore. */}
                  <nav className="col-span-2 md:col-span-3" aria-label="Footer site links">
                    <p className="font-geist-mono t-label text-[var(--color-chrome-label)] mb-4">
                      Build with us
                    </p>
                    <ul className="space-y-2.5">
                      {buildLinks.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className={`font-geist-sans text-sm transition-colors duration-200 leading-tight ${
                              link.emphasis
                                ? "text-[var(--color-chrome-text)] font-medium hover:text-[var(--color-chrome-text-secondary)]"
                                : "text-[var(--color-chrome-text-secondary)] hover:text-[var(--color-chrome-text)]"
                            }`}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>

                  {/* Newsletter — value-prop-led copy. Takes the spare column
                      since it's the only one with a form control to fit. */}
                  <div className="col-span-2 md:col-span-5">
                    <p className="font-geist-mono t-label text-[var(--color-chrome-label)] mb-4">
                      The Feed · Newsletter
                    </p>
                    <p className="font-geist-sans t-body-s text-[var(--color-chrome-text-secondary)] mb-4 max-w-sm">
                      Field notes from the studio — what we&apos;re producing, what&apos;s launching,
                      who&apos;s working on it.
                    </p>
                    <Newsletter />
                    <p className="mt-3 font-geist-mono t-label text-[var(--color-chrome-label)]">
                      No spam · 1 send/month
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom strip — copyright, legal, contact echo. The echo is the
                  only place the address appears now; the Build with us column
                  routes to /contact instead. */}
              <div className="py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-geist-sans t-caption text-[var(--color-chrome-label)]">
                  &copy; {currentYear} 434 MEDIA · {BRAND_RECORDS.mottoStyled}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {legalLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="font-geist-sans t-caption text-[var(--color-chrome-label)] hover:text-[var(--color-chrome-text-secondary)] transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <span className="font-geist-sans t-caption text-[var(--color-chrome-label)]" aria-hidden="true">·</span>
                  <a
                    href="mailto:build@434media.com"
                    className="font-geist-sans t-caption text-[var(--color-chrome-label)] hover:text-[var(--color-chrome-text-secondary)] transition-colors duration-200"
                  >
                    build@434media.com
                  </a>
                </div>
              </div>
            </div>
          )}
      </div>
    </footer>
  )
}
