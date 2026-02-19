"use client"

import { motion } from "motion/react"
import Link from "next/link"

const trustedByIcons = [
  {
    name: "Digital Canvas",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-ymas.svg",
    website: "https://www.digitalcanvas.community/",
    height: "h-7 md:h-7",
    invert: true,
  },
  {
    name: "TXMX Boxing",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg",
    website: "/shop",
    height: "h-8 md:h-8",
    invert: true,
  },
  {
    name: "SDOH",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg",
    website: "/en/sdoh",
    height: "h-9 md:h-9",
  },
  {
    name: "The Health Cell",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell.png",
    website: "https://thehealthcell.org/",
    height: "h-7 md:h-8",
  },
  {
    name: "Mission Road Ministries",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/missionroad.svg",
    website: "https://www.missionroadministries.org/",
    height: "h-7 md:h-9",
  },
  {
    name: "Univision",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/univision-logo.svg",
    website: "https://www.univision.com/",
    height: "h-5 md:h-9",
  },
  {
    name: "Methodist Healthcare Ministries",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png",
    website: "https://www.mhm.org/",
    height: "h-9 md:h-10",
  },
  {
    name: "VelocityTX",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+MAIN+RGB+(1).png",
    website: "https://velocitytx.org/",
    height: "h-7 md:h-9",
  },
  {
    name: "Builders VC",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/builders-dark.svg",
    website: "https://www.builders.vc/",
    height: "h-8 md:h-9",
  },
  {
    name: "Alamo Angels",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/angels.png",
    website: "https://alamoangels.com/",
    height: "h-8 md:h-7",
  },
  {
    name: "Tech Bloc",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell-2-techbloc.png",
    website: "https://satechbloc.com/",
    height: "h-9 md:h-12",
  },
  {
    name: "Learn2AI",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/Learn2ai.svg",
    website: "https://www.learn2ai.co/",
    height: "h-7 md:h-7",
  },
  {
    name: "DEVSA",
    iconFile: "https://devsa-assets.s3.us-east-2.amazonaws.com/devsa-logo.svg",
    website: "https://www.devsa.community/",
    height: "h-7 md:h-8",
  },
]

const TrustedBy = () => {
  const tripleIcons = [...trustedByIcons, ...trustedByIcons, ...trustedByIcons]

  return (
    <section className="relative bg-white overflow-hidden" id="trusted-by">
      {/* Heading + description — centered */}
      <div className="px-4 sm:px-6 lg:px-8 pt-24 md:pt-32 lg:pt-40 pb-14 md:pb-20 lg:pb-24">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            viewport={{ once: true }}
            className="font-ggx88 font-black text-neutral-950 text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tighter leading-[0.92] mb-6 md:mb-8 lg:mb-10"
            id="portfolio-heading"
          >
            Bold Stories.
            <br />
            Proven Impact.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            viewport={{ once: true }}
            className="font-geist-sans text-neutral-500 text-lg md:text-xl lg:text-2xl font-normal leading-[1.55] tracking-tight max-w-3xl mx-auto"
          >
            From brand campaigns to community impact, we help the world's most innovative firms find their voice. We partner with visionaries to turn bold ideas into market-leading stories.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 md:mt-10"
          >
            <Link
              href="/work"
              className="font-geist-sans text-sm font-medium px-6 py-3 rounded-lg bg-neutral-950 text-white hover:bg-neutral-800 transition-colors duration-200"
            >
              View Our Work
            </Link>
            <Link
              href="/contact"
              className="font-geist-sans text-sm font-medium px-6 py-3 rounded-lg border border-neutral-300 text-neutral-950 hover:bg-neutral-100 transition-colors duration-200"
            >
              Get in Touch
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Trusted by + logo scroll */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
        viewport={{ once: true }}
        className="relative z-10 border-t border-neutral-100 px-4 sm:px-6 lg:px-8 py-8 md:py-10"
      >
        <div className="max-w-5xl mx-auto">
          <p className="font-geist-sans text-sm text-neutral-400 font-normal mb-5 text-center sm:text-left">
            Trusted by <span className="font-medium text-neutral-600">leading organizations</span>
          </p>

          <div className="relative overflow-hidden">
            {/* Fade edges */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-linear-to-r from-white to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-linear-to-l from-white to-transparent z-10" />

            <div
              className="flex items-center gap-12 md:gap-16 animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused] w-max"
            >
              {tripleIcons.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="shrink-0 flex items-center justify-center"
                >
                  <img
                    src={item.iconFile}
                    alt={`${item.name} logo`}
                    className={`${item.height} w-auto object-contain opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300${item.invert ? ' invert' : ''}`}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

export default TrustedBy
