"use client"

import { useEffect, useState } from "react"
import { SDOHHero } from "../components/SDOHHero"
import { SDOHNewsletter } from "../components/SDOHNewsletter"
import { BackToTop } from "../components/BackToTop"
import { FadeIn } from "../components/FadeIn"
import Image from "next/image"
import Script from "next/script"

export default function SDOHClientPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Common heading styles for consistency
  const gradientHeadingClass = "font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-cyan-600"
  const sectionHeadingClass = `${gradientHeadingClass} text-2xl sm:text-3xl md:text-4xl lg:text-6xl mb-4 sm:mb-6 text-center`
  const subHeadingClass = `${gradientHeadingClass} text-xl sm:text-2xl md:text-3xl mb-3 sm:mb-4`
  const cardHeadingClass = `${gradientHeadingClass} text-lg sm:text-xl md:text-2xl mb-2 sm:mb-3`

  return (
    <main className="flex flex-col min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Hero Section */}
      <SDOHHero />

      {/* Main content */}
      <div id="main-content" tabIndex={-1}>
        {/* Powered By Section - Combined with Resources */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-6 max-w-6xl">
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-16">
                <h2 className={sectionHeadingClass}>Seminar + Speaker Series</h2>
                <p className="text-base sm:text-lg md:text-xl text-neutral-700 leading-relaxed">
                  Powered by <strong>VelocityTX</strong> and <strong>Methodist Healthcare Ministries</strong>, these
                  live events and panels are designed to spark conversation, raise awareness, and make complex health
                  topics feel approachable and relevant—especially for aspiring founders, healthcare workers, educators,
                  and community changemakers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
                {/* Card 1 */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200 flex flex-col h-full">
                  <div className="aspect-video relative">
                    {/* Video placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 z-10"></div>
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-4 border border-yellow-300/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/rgv-startup-week-banner.png"
                      alt="Market Analysis and Value Delivery"
                      fill
                      className="object-cover opacity-60 z-0"
                    />
                  </div>
                  <div className="p-6 flex-grow">
                    <h3 className={cardHeadingClass}>Market Analysis and Value Delivery</h3>
                    <p className="text-neutral-700">
                      Understanding Needs and Quality Solutions presented by Shireen Abdullah, Founder, Yumlish, 2024
                      MHM Accelerator Cohort Champion
                    </p>
                  </div>
                  <div className="px-6 pb-6">
                    <a
                      href="https://rgvstartupweek.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Learn More
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200 flex flex-col h-full">
                  <div className="aspect-video relative">
                    {/* Video placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 z-10"></div>
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-4 border border-yellow-300/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/methodist-healthcare-logo.png"
                      alt="Legal Considerations for Raising Capital"
                      fill
                      className="object-cover opacity-60 z-0"
                    />
                  </div>
                  <div className="p-6 flex-grow">
                    <h3 className={cardHeadingClass}>Legal Considerations for Raising Capital</h3>
                    <p className="text-neutral-700">
                      Understanding the Process presented by Jose Padilla, Founder, Padilla Law, LLC and LegalmenteAI
                    </p>
                  </div>
                  <div className="px-6 pb-6">
                    <a
                      href="https://www.mhm.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Learn More
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200 flex flex-col h-full">
                  <div className="aspect-video relative">
                    {/* Video placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 z-10"></div>
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full p-4 border border-yellow-300/30">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-white"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/velocitytx-logo.png"
                      alt="The Perfect Pitch"
                      fill
                      className="object-cover opacity-60 z-0"
                    />
                  </div>
                  <div className="p-6 flex-grow">
                    <h3 className={cardHeadingClass}>The Perfect Pitch</h3>
                    <p className="text-neutral-700">
                      Captivating Investors and Closing Deals presented by Luis Martinez, PhD, Sr. Venture Assoc.,
                      Capital Factory
                    </p>
                  </div>
                  <div className="px-6 pb-6">
                    <a
                      href="https://velocitytx.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Learn More
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Upcoming Events Section (Formerly Resources) */}
            <FadeIn>
              <div className="max-w-3xl mx-auto text-center mb-16">
                <h2 className={sectionHeadingClass}>Upcoming Events</h2>
                <p className="text-xl text-neutral-700 leading-relaxed">
                  Join these upcoming events to learn more about SDOH and how you can get involved in creating healthier
                  communities.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-16">
                {/* Left Side - Startup Bootcamp */}
                <div className="bg-white p-8 rounded-xl shadow-md">
                  <h3 className={`${subHeadingClass} flex items-center`}>
                    <span className="bg-cyan-100 text-cyan-700 p-2 rounded-full mr-3">
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
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </span>
                    Startup Bootcamp
                  </h3>
                  <ul className="space-y-4">
                    <li className="pl-6 border-l-4 border-cyan-500">
                      <strong>When:</strong> April 25-27, 2025
                    </li>
                    <li className="pl-6 border-l-4 border-cyan-500">
                      <strong>Where:</strong> TSTC - Harlingen, Welcome Center
                    </li>
                    <li className="pl-6 border-l-4 border-cyan-500">
                      <strong>What:</strong> Embark on a transformative journey at our THREE-DAY Startup Bootcamp. Dive
                      into immersive workshops and collaborate with industry experts!
                    </li>
                  </ul>
                  <div className="mt-6">
                    <a
                      href="https://www.eventbrite.com/e/startup-bootcamp-tickets-1307199552049"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Reserve Your Spot
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Right Side - RGV Startup Week */}
                <div className="bg-white p-8 rounded-xl shadow-md">
                  <h3 className={`${subHeadingClass} flex items-center`}>
                    <span className="bg-yellow-100 text-yellow-700 p-2 rounded-full mr-3">
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
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    RGV Startup Week
                  </h3>
                  <ul className="space-y-4">
                    <li className="pl-6 border-l-4 border-yellow-300">
                      <strong>When:</strong> April 25 - May 2, 2025
                    </li>
                    <li className="pl-6 border-l-4 border-yellow-300">
                      <strong>Where:</strong> Multiple venues across the RGV
                    </li>
                    <li className="pl-6 border-l-4 border-yellow-300">
                      <strong>What:</strong> A week-long celebration of entrepreneurship featuring workshops, panels,
                      and networking events. The <strong>SDOH Panel</strong> is a featured event during{" "}
                      <strong>RGV Startup Week</strong>.
                    </li>
                  </ul>
                  <div className="mt-6">
                    <a
                      href="https://rgvsw25.events.whova.com/registration"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Register Now
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 ml-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Community Health Accelerator Info Box */}
              <div className="bg-gradient-to-r from-cyan-50 to-white p-8 rounded-xl shadow-md border border-cyan-100 mb-20">
                <h3 className={subHeadingClass}>Community Health Accelerator</h3>
                <p className="text-lg text-neutral-700 mb-4">
                  The Community Health Accelerator is a cohort-based program that provides growing companies the
                  assistance they need to overcome the challenges that frequently cause startup companies to fail.
                  Programming is modeled after the gold standards of the industry, and includes a structured curriculum,
                  mentoring, business education, operational advice, pitch coaching, peer collaboration, and more.
                </p>
                <p className="text-lg text-neutral-700 mb-4">
                  Cohort companies will participate in a public Demo Day pitch event at the conclusion of the
                  accelerator and receive the opportunity to run a pilot program of their technology in the Methodist
                  system.
                </p>
                <div className="mt-6">
                  <a
                    href="https://velocitytx.org/startup-programs/support/accelerator/"
                    className="inline-flex items-center text-cyan-600 hover:text-cyan-700 font-medium"
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
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </a>
                </div>
              </div>
            </FadeIn>

            {/* Newsletter Section - Moved Below */}
            <FadeIn>
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl p-6 sm:p-10 md:p-16 shadow-xl relative overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10" aria-hidden="true">
                  <Image src="/images/grid-pattern.svg" alt="" fill className="object-cover" />
                </div>

                {/* Accent elements */}
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-cyan-500 to-cyan-700"></div>
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-yellow-400 to-yellow-600"></div>

                <div className="relative z-10">
                  <div className="max-w-3xl mx-auto text-center mb-6 sm:mb-10">
                    <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-4 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-300">
                      Stay Connected
                    </h2>
                    <p className="text-base sm:text-lg md:text-xl text-white/90 leading-relaxed">
                      If you&apos;ve ever asked,{" "}
                      <strong className="text-yellow-300">&quot;What can I do to make a difference?&quot;</strong> — this is where
                      you start.
                    </p>
                  </div>
                  <div className="max-w-xl mx-auto">
                    <SDOHNewsletter />
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Banner Image - Fixed to ensure visibility */}
        <section className="bg-white mb-12 sm:mb-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl shadow-lg sm:shadow-2xl">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-yellow-300/20 z-10"></div>

                {/* Banner image */}
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW.png"
                  alt="RGV Startup Week"
                  width={1920}
                  height={300}
                  className="w-full h-auto object-cover"
                  priority
                />

                {/* Animated border */}
                <div
                  className="absolute inset-0 border-2 sm:border-4 border-cyan-500/30 z-20"
                  style={{
                    animation: "pulseBorder 4s infinite alternate",
                  }}
                ></div>

                {/* Add inline styles for the animation */}
                <style jsx>{`
                  @keyframes pulseBorder {
                    0% { border-color: rgba(6, 182, 212, 0.3); }
                    50% { border-color: rgba(253, 224, 71, 0.3); }
                    100% { border-color: rgba(6, 182, 212, 0.3); }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .absolute {
                      animation: none !important;
                    }
                  }
                `}</style>
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
