"use client"

import type React from "react"

import { useState, useRef } from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react"
import { useMediaQuery } from "../hooks/use-mobile"
import { PortfolioModal } from "./PortfolioModal"
import { FadeIn } from "./FadeIn"
import Image from "next/image"
import { useHorizontalScroll } from "../hooks/use-horizontal-scroll"
import { KeyboardNavigation } from "./keyboardNavigation"

interface PortfolioItem {
  company: string
  title: string
  description: string
  video: string
  poster: string
  photo: string
  gif?: string
  showImage: boolean
  showVideo: boolean
  content: string
  linkedin?: string
  instagram?: string
  website?: string
  showLinkedin: boolean
  showInstagram: boolean
  showWebsite: boolean
}

export function PortfolioGrid() {
  const [active, setActive] = useState<PortfolioItem | null>(null)
  const isMobile = useMediaQuery("(max-width: 639px)")
  const isTablet = useMediaQuery("(min-width: 640px) and (max-width: 1023px)")

  const { scrollYProgress } = useScroll()
  const { scrollRef, scrollX, canScrollLeft, canScrollRight, scroll } = useHorizontalScroll()

  const leftBlurOpacity = useTransform(scrollX, [0, 0.02], [0, 1])
  const rightBlurOpacity = useTransform(scrollX, [0.98, 1], [1, 0])
  const leftArrowOpacity = useTransform(scrollX, [0, 0.01], [0, 1])
  const rightArrowOpacity = useTransform(scrollX, [0.99, 1], [1, 0])

  const handleItemClick = (item: PortfolioItem) => {
    setActive(item)
  }

  const imageRotation = useTransform(scrollYProgress, [0, 1], [0, 360])
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.2, 1])
  const imageBrightness = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.2, 1])

  return (
    <motion.div id="portfolio" className="relative py-6 sm:py-8 lg:py-12 bg-white" aria-label="Portfolio showcase">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Animated Intro Section */}
        <FadeIn>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8 sm:mb-12 lg:mb-16 max-w-7xl mx-auto"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8">
              <div className="flex-1 text-center md:text-left order-2 md:order-1 md:pr-8">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  className="text-neutral-950 font-ggx88 font-bold text-balance text-5xl/[1.1] sm:text-6xl/[1.1] lg:text-7xl/[1.1] xl:text-9xl/[1.1] tracking-tight leading-none mb-4 md:mb-6"
                  id="portfolio-heading"
                >
                  Connecting Enterprises
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                  className="text-neutral-700 text-lg sm:text-xl lg:text-3xl max-w-2xl leading-snug tracking-tight text-balance"
                >
                  Leveraging networks to connect people, places and things through creative media and smart marketing.
                </motion.p>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.6,
                  ease: [0.21, 1.02, 0.73, 0.98],
                }}
                style={{
                  rotate: imageRotation,
                  scale: imageScale,
                  filter: `brightness(${imageBrightness})`,
                }}
                className="w-full md:w-1/2 lg:w-1/2 max-w-xl mx-auto order-1 md:order-2 flex items-center justify-center"
                aria-hidden="true"
              >
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONBLACK+(1).png"
                  alt="434 Media Icon"
                  width={700}
                  height={700}
                  className="w-full h-auto object-contain"
                />
              </motion.div>
            </div>
          </motion.div>
        </FadeIn>

        {/* Featured Grid - First 6 Items */}
        <h3 className="sr-only" id="featured-portfolio">
          Featured Portfolio Items
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" aria-labelledby="featured-portfolio">
          {portfolioArray.slice(0, 6).map((item, index) => (
            <PortfolioItem key={item.company} item={item} index={index} onClick={handleItemClick} />
          ))}
        </div>

        {/* Scrollable Section - Last 4 Items */}
        <h3 className="sr-only" id="more-portfolio">
          More Portfolio Items
        </h3>
        <div className="relative mt-8 sm:mt-12 lg:mt-16" aria-labelledby="more-portfolio">
          {/* Navigation Arrows */}
          <div className="flex justify-between items-center">
            <motion.button
              key="left-arrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: canScrollLeft ? 1 : 0.3 }}
              exit={{ opacity: 0 }}
              style={{ opacity: leftArrowOpacity }}
              onClick={() => scroll("left")}
              className="absolute -left-4 sm:-left-6 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 shadow-lg hover:bg-white transition-colors border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Scroll left to see more portfolio items"
              disabled={!canScrollLeft}
            >
              <i className="ri-arrow-left-line text-xl text-neutral-950" />
            </motion.button>
            <motion.button
              key="right-arrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: canScrollRight ? 1 : 0.3 }}
              exit={{ opacity: 0 }}
              style={{ opacity: rightArrowOpacity }}
              onClick={() => scroll("right")}
              className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 shadow-lg hover:bg-white transition-colors border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Scroll right to see more portfolio items"
              disabled={!canScrollRight}
            >
              <i className="ri-arrow-right-line text-xl text-neutral-950" />
            </motion.button>
          </div>
          <div
            ref={scrollRef}
            className="flex overflow-x-auto pb-8 gap-4 sm:gap-6 snap-x snap-mandatory scrollbar-hide"
            role="region"
            aria-label="Scrollable portfolio items"
            tabIndex={0}
          >
            <KeyboardNavigation
              onArrowLeft={() => canScrollLeft && scroll("left")}
              onArrowRight={() => canScrollRight && scroll("right")}
              enabled={true}
            />
            {portfolioArray.slice(6).map((item, index) => (
              <motion.div
                key={item.company}
                className="snap-start shrink-0 first:pl-4 sm:first:pl-0 last:pr-4 sm:last:pr-6 pt-8"
                style={{
                  width: isMobile ? "90%" : isTablet ? "75%" : "45%",
                  minWidth: isMobile ? "280px" : isTablet ? "400px" : "500px",
                }}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
              >
                <PortfolioItem item={item} onClick={handleItemClick} />
              </motion.div>
            ))}
          </div>
          {/* Blur Effect */}
          <motion.div
            className="absolute right-0 top-0 bottom-8 w-6 md:w-10 bg-white/5 backdrop-blur-sm pointer-events-none"
            style={{ opacity: rightBlurOpacity }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute left-0 top-0 bottom-8 w-6 md:w-10 bg-white/5 backdrop-blur-sm pointer-events-none"
            style={{ opacity: leftBlurOpacity }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>{active && <PortfolioModal item={active} onClose={() => setActive(null)} />}</AnimatePresence>
    </motion.div>
  )
}

function PortfolioItem({
  item,
  index,
  onClick,
}: {
  item: PortfolioItem
  index?: number
  onClick: (item: PortfolioItem) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(item)
    }
  }

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: 0.5,
        delay: index ? index * 0.1 : 0,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="group cursor-pointer flex flex-col"
      onClick={() => onClick(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${item.company}: ${item.title}`}
      onKeyDown={handleKeyDown}
    >
      <div className="relative rounded-2xl overflow-hidden shadow-lg transition-shadow duration-300 group-hover:shadow-xl">
        <div className="aspect-[16/9] overflow-hidden bg-neutral-900">
          <Image
            src={item.photo || "/placeholder.svg"}
            alt=""
            width={1600}
            height={900}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ opacity: isHovered && item.gif ? 0 : 1 }}
            aria-hidden="true"
          />
          {item.gif && (
            <Image
              src={item.gif || "/placeholder.svg"}
              alt=""
              width={1600}
              height={900}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 rounded-2xl"
              style={{ opacity: isHovered ? 1 : 0 }}
              aria-hidden="true"
            />
          )}
        </div>
        {/* Text Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 sm:p-6">
          <h4 className="text-white font-geist-sans font-bold text-base sm:text-lg lg:text-xl tracking-tight mb-1 sm:mb-2">
            {item.company}
          </h4>
          <p className="text-white/90 text-xs sm:text-sm lg:text-base mb-2 sm:mb-4 md:max-w-sm leading-snug">
            {item.title}
          </p>
          {item.showVideo && (
            <motion.div
              className="inline-flex items-center gap-2 text-emerald-400 text-xs sm:text-sm font-medium"
              whileHover={{ x: 5 }}
            >
              See More
              <i className="ri-arrow-right-line" aria-hidden="true" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export const portfolioArray: PortfolioItem[] = [
  {
    company: "VelocityTX Innovation Showcase",
    title: "Spotlighting the Future of Bioscience",
    description:
      "The VelocityTX Innovation Showcase brings together San Antonio's thriving innovation ecosystem to spotlight pioneering startups, cutting-edge research, and impactful programs shaping the future of bioscience. This dynamic event features hands-on demonstrations, engaging conversations, and a celebration of VelocityTX's legacy of driving inclusive economic growth in San Antonio.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/Innovation+Showcase+2024+V3.mov",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/vtx.jpeg",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/vtx.jpeg",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/InnovationShowcase-ezgif.com-video-to-gif-converter+(1)+(1).gif",
    showImage: true,
    showVideo: true,
    content: "Spotlighting pioneering startups, cutting-edge research, and impactful programs",
    linkedin: "https://www.linkedin.com/company/velocitytx/",
    instagram: "https://www.instagram.com/velocitytx/",
    website: "https://velocitytx.org/",
    showLinkedin: true,
    showInstagram: true,
    showWebsite: true,
  },
  {
    company: "Health Cell SOI",
    title: "State of the Industry celebrates the people shaping the future of healthcare",
    description:
      "The Health Cell's Annual State of the Industry is a premier event that brings together industry trailblazers to explore groundbreaking insights, celebrate community impact, and shape the future of healthcare.",
    video: "",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/soi.jpeg",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/soi.jpeg",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell.gif",
    showImage: true,
    showVideo: false,
    content: "Bringing together industry trailblazers to explore groundbreaking insights",
    linkedin: "https://www.linkedin.com/company/thehealthcell/",
    instagram: "https://www.instagram.com/thehealthcell/",
    website: "https://thehealthcell.org/",
    showLinkedin: true,
    showInstagram: true,
    showWebsite: true,
  },
  {
    company: "AIM",
    title: "A Catalyst for Life Sciences Innovation & Commercialization",
    description: "Accelerating innovation in military medicine through collaboration between academia, industry, and the military.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/AIM2025_V3.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/aim-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/aim-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/aim.gif",
    showImage: true,
    showVideo: true,
    content: "Premier platform uniting academia, industry, and the military",
    linkedin: "https://www.linkedin.com/company/velocitytx/",
    instagram: "https://www.instagram.com/velocitytx/",
    website: "https://aimsatx.com/",
    showLinkedin: false,
    showInstagram: false,
    showWebsite: true,
  },
  {
    company: "Tech Bloc",
    title: "Driving innovation and Growth in San Antonio's Tech Ecosystem",
    description:
      "Tech Day | Tech Fuel is TechBloc's premier event celebrating San Antonio's vibrant tech ecosystem. With thought-provoking sessions, meaningful connections, opportunities to drive progress and a $100K prize pool, it's the place to engage with innovators, leaders, and the future of technology.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/TechDay2024.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/techbloc-poster.jpg",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/techbloc-poster.jpg",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/techbloc.gif",
    showImage: true,
    showVideo: true,
    content: "Celebrating San Antonio's vibrant tech ecosystem",
    linkedin: "https://www.linkedin.com/company/sa-tech-bloc/",
    instagram: "https://www.instagram.com/techbloc/",
    website: "https://satechbloc.com/",
    showLinkedin: true,
    showInstagram: true,
    showWebsite: true,
  },
  {
    company: "Alamo Angels",
    title: "Empowering Innovation and Economic Growth",
    description:
      "Alamo Angels fosters economic development by connecting accredited investors with high-quality deal flow and supporting the growth of early-stage companies, creating a seamless pathway for entrepreneurial success.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/Alamo+Angles.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/angels-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/angels-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/alamoangles.gif",
    showImage: true,
    showVideo: true,
    content: "Connecting accredited investors with high-quality deal flow",
    linkedin: "https://www.linkedin.com/company/alamoangelsofsa/",
    instagram: "https://www.instagram.com/alamoangelsofsa/",
    website: "https://alamoangels.com/",
    showLinkedin: true,
    showInstagram: true,
    showWebsite: true,
  },
  {
    company: "Methodist Healthcare Ministries",
    title: "South Texas Community Health Accelerator",
    description:
      "Powered by VelocityTX & Methodist Healthcare Ministries, the South Texas Community Health Accelerator program connects education, entrepreneurship, and innovation through three core components: Que es SDOH? a Speaker + Seminar Series, Startup Bootcamp and a competitive Health Accelerator resulting in the opportunity to pilot your program within the MHM network.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/Start+Up+Week+Post+Promo+WEB.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.gif",
    showImage: true,
    showVideo: true,
    content: "Advancing health equity by addressing social determinants of health",
    linkedin: "https://www.linkedin.com/company/methodist-healthcare-ministries/",
    instagram: "https://www.instagram.com/mhmstx",
    website: "https://www.434media.com/sdoh",
    showLinkedin: false,
    showInstagram: false,
    showWebsite: true,
  },
  {
    company: "Salute to Troops",
    title: '"We will always be the land of the free" - Gen. John Evans, CMDR, R-North',
    description:
      "Salute to Troops is a unique event marketing platform dedicated to fostering collaboration between Academia, Industry, and the Military. Our mission is to drive innovation, build community, and assist the military in overcoming historic challenges related to recruitment, retention, and reintegration by creating impactful narratives.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/Salute-To-Troops.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/troops-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/troops-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/salutetotroops.gif",
    showImage: true,
    showVideo: true,
    content: "Fostering collaboration between Academia, Industry, and the Military",
    linkedin: "",
    instagram: "https://www.instagram.com/milcityusa/",
    website: "https://www.salutetotroops.com/",
    showLinkedin: false,
    showInstagram: true,
    showWebsite: true,
  },
  {
    company: "TXMX Boxing",
    title: "Levantamos Los Puños",
    description:
      "TXMX Boxing is a dynamic media platform designed to connect brands with a passionate fight fan audience. By celebrating the rich cultural heritage of Texas and Mexico, TXMX Boxing offers unique opportunities for brands to authentically engage with a community that is deeply rooted in both sport and culture.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/Copy+of+TXMX+Teaser+1.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/txmx-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/txmx-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMX.gif",
    showImage: true,
    showVideo: true,
    content: "Culturally connecting brands with a fight fan audience",
    linkedin: "",
    instagram: "https://www.instagram.com/txmxboxing/",
    website: "",
    showLinkedin: false,
    showInstagram: true,
    showWebsite: false,
  },
  {
    company: "MilCityUSA",
    title: "Celebrating Military Innovation and Entrepreneurialism",
    description:
      "MilCityUSA serves as the social media hub for Salute to Troops and other military-focused content, spotlighting innovation and entrepreneurialism within the armed forces.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/MilCity.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/mcu-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/mcu-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/milcityusa.gif",
    showImage: true,
    showVideo: true,
    content: "Spotlighting innovation and entrepreneurialism within the armed forces",
    linkedin: "",
    instagram: "https://www.instagram.com/milcityusa/",
    website: "https://www.salutetotroops.com/",
    showLinkedin: false,
    showInstagram: true,
    showWebsite: true,
  },
  {
    company: "VemosVamos",
    title: "Creatively Raw. Curiosity Driven.",
    description:
      "A bilingual space for those who aren’t afraid to question, create, and grow.",
    video: "https://ampd-asset.s3.us-east-2.amazonaws.com/VV+Web+Banner+2.mp4",
    poster: "https://ampd-asset.s3.us-east-2.amazonaws.com/vv-poster.png",
    photo: "https://ampd-asset.s3.us-east-2.amazonaws.com/vv-poster.png",
    gif: "https://ampd-asset.s3.us-east-2.amazonaws.com/vv-poster.png",
    showImage: true,
    showVideo: true,
    content:
      "We are a bilingual platform that helps people turn their passions into profits by connecting them with a network of individuals who have already done it in the community",
    linkedin: "https://www.linkedin.com/company/vemosvamos/",
    instagram: "https://www.instagram.com/vemos.vamos/",
    website: "https://www.vemosvamos.com/",
    showLinkedin: true,
    showInstagram: true,
    showWebsite: true,
  },
]

