"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import { XIcon, PlayIcon, ArrowUpRightIcon } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type BentoSize = "sm" | "md" | "lg" | "wide" | "tall"

interface BentoItem {
  id: string
  title: string
  description: string
  size: BentoSize
  // Visual
  image?: string
  imagePosition?: string
  logo?: string
  logoDark?: boolean // true = logo has white fill, needs dark bg
  bgColor?: string
  // Interaction
  videoUrl?: string
  videoAspectRatio?: "16:9" | "4:5"
  href?: string
  tags?: string[]
  priority?: boolean // true = fetchPriority high, eager loading
}

// ─── Data ────────────────────────────────────────────────────────────────────

const bentoItems: BentoItem[] = [
  {
    id: "vanita-leo",
    title: "Vanita Leo",
    description: "Texas Cumbia artist blending traditional sounds with modern storytelling. Media production, brand partnerships, and content strategy amplifying her unique voice and cultural impact.",
    size: "wide",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/vanita.png",
    imagePosition: "left",
    priority: true,
    href: "https://www.instagram.com/p/DRK7SlZj4wP/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA%3D%3D",
    bgColor: "bg-amber-50",
    tags: ["Cumbia", "Artist"],
  },
    {
    id: "builders-vc",
    title: "Builders VC",
    description: "Venture capital firm backing bold founders. Content strategy and brand storytelling for portfolio amplification.",
    size: "sm",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/builders-dark.svg",
    bgColor: "bg-neutral-50",
    href: "https://www.builders.vc/",
    tags: ["VC", "Startups"],
  },
  {
    id: "wifttx",
    title: "WIFT TX",
    description: "Women in Film & Television Texas. Amplifying women's voices in media through event coverage and creative partnerships.",
    size: "sm",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/wifttx.avif",
    bgColor: "bg-rose-950",
    logoDark: true,
    href: "https://www.digitalcanvas.community/thefeed/1.5B-Reasons-to-Film-in-Texas",
    tags: ["Film", "Women in Media"],
  },
  {
    id: "velocity-tx",
    title: "VelocityTX",
    description: "Innovation hub fueling biotech and life science startups. Brand partnerships, event coverage, and impact reporting.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/vtx.png",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+MAIN+RGB+(1).png",
    bgColor: "bg-white",
    href: "https://www.digitalcanvas.community/thefeed/434-crashes-sasw-10th-year",
    tags: ["Biotech", "Startups"],
  },
  {
    id: "mission-road",
    title: "Mission Road Ministries",
    description: "Nonprofit partner serving individuals with disabilities. Media production amplifying mission-driven stories of resilience.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/missionroad.png",
    bgColor: "bg-neutral-50",
    href: "https://www.missionroadministries.org/",
    tags: ["Nonprofit", "Impact"],
  },
  {
    id: "univision",
    title: "Univision",
    description: "Spanish-language media coverage. Cross-platform content partnerships reaching millions of Hispanic and Latino audiences.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/univision.png",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/univision-logo.svg",
    bgColor: "bg-purple-950",
    logoDark: true,
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/Alejandro+Ferna%CC%81ndez+Concert+.mov",
    videoAspectRatio: "4:5",
    href: "https://www.digitalcanvas.community/thefeed/capturing-a-milestone",
    tags: ["Media", "Broadcast"],
  },
  {
    id: "alamo-angels",
    title: "Alamo Angels",
    description: "Angel investor network. Event production, pitch coverage, and founder storytelling for South Texas's startup ecosystem.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/angels3.png",
    bgColor: "bg-neutral-50",
    href: "https://www.digitalcanvas.community/thefeed/built-for-the-triangle",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/Alamo+Angles.mp4",
    tags: ["VC", "Angels"],
  },
  {
    id: "txmx-boxing",
    title: "TXMX Boxing",
    description: "TXMX Boxing is a fight culture brand inspired by Texas and Mexico — built to celebrate boxing, community, and the fighters who live it. We create lifestyle content, events, and gear that capture the spirit of the sport, connecting fans and fighters through storytelling, culture, and style.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/txmx.png",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMX+DROP+TEASER+V2.mp4",
    href: "/shop",
    tags: ["Brand", "E-Commerce"],
  },
  {
    id: "altbionics",
    title: "Alt-Bionics",
    description: "Transforming the fields of prosthetics and humanoid robotics with cutting-edge, yet affordable bionic hands.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/altbionics.png",
    bgColor: "bg-neutral-900",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/AltBionics+.mov",
    videoAspectRatio: "4:5",
    href: "https://www.altbionics.com/",
    tags: ["humanoid", "robotics"],
  },
  {
    id: "mhm",
    title: "Methodist Healthcare Ministries",
    description: "We are broadening the definition of health care beyond providing high-quality care when people are sick to address systemic inequities so that more people can reach their full potential for health and life.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/sdoh-accelerator.jpg",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png",
    bgColor: "bg-white",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/Demo-Day-V3.mov",
    href: "https://www.mhm.org/",
    tags: ["Healthcare", "Nonprofit"],
  },
  {
    id: "rise-of-a-champion",
    title: "Rise of a Champion",
    description: "Icontalks x TXMX Boxing brought together a curated room of athletes, entertainers, and industry leaders to celebrate greatness and build meaningful connections.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/rise.png",
    bgColor: "bg-neutral-900",
    logoDark: true,
    href: "https://www.digitalcanvas.community/thefeed/loud-about-legacy",
    tags: ["Documentary", "Sports"],
  },
  {
    id: "vemos-vamos",
    title: "Vemos Vamos",
    description: "Bilingual storytelling initiative connecting communities through shared vision. Event production, brand strategy, and content creation.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/vemos-vamos/vemosinsights.jpg",
    href: "https://www.vemosvamos.com/about",
    tags: ["Agency", "Bilingual"],
  },
  {
    id: "tech-bloc",
    title: "Tech Bloc",
    description: "A non-profit dedicated to fostering economic development and advocacy, helping connect and grow the tech ecosystem in San Antonio and Central Texas.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/techday.png",
    bgColor: "bg-neutral-50",
    href: "https://www.sanantoniotechday.com/",
    tags: ["Advocacy", "Tech"],
  },
  {
    id: "digital-canvas",
    title: "Digital Canvas",
    description: "Powered by 434 MEDIA x DEVSA, Digital Canvas designs and produces conferences, workshops, and AI-driven experiences that help organizations connect creativity, community, and technology — at scale.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/digitalcanvas.png",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/digital-canvas-ymas.svg",
    logoDark: true,
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/digitalcanvas.mov",
    bgColor: "bg-neutral-900",
    href: "https://www.digitalcanvas.community/",
    tags: ["Community", "Creative"],
  },
  {
    id: "health-cell",
    title: "The Health Cell",
    description: "The Health Cell was formed by and for San Antonio’s biotechnology, medical, military and academic leadership to promote professional development and collaboration across the City’s health sector.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/healthcell.png",
    bgColor: "bg-neutral-50",
    href: "https://www.434media.com/blog/44b-and-counting-the-health-cell-2025",
    tags: ["Health", "Innovation"],
  },
    {
    id: "nucleate-texas",
    title: "Nucleate Texas",
    description: "Biotech student organization. Event coverage and brand storytelling for the next generation of life science founders.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/nucleate.png",
    bgColor: "bg-indigo-950",
    logoDark: true,
    href: "https://luma.com/nucleate-sxsw-2026",
    tags: ["Biotech", "Students"],
  },
  {
    id: "aimsatx",
    title: "AIM Health R&D Summit",
    description: "Join military and civilian leaders, researchers, and innovators to explore breakthrough technologies, share cutting-edge research, and forge partnerships that will transform healthcare for our service members and beyond.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/aim-group.jpg",
    bgColor: "bg-neutral-900",
    logoDark: true,
    href: "https://aimsatx.com/",
    tags: ["Military", "Innovation"],
  },
  {
    id: "devsa",
    title: "DEVSA",
    description: "Empowering San Antonio's developer community through events, workshops, and networking that bridge the gap between talent and opportunity.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/devsa-space.webp",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/DEVSA+Web+Banner.mp4",
    href: "https://www.devsa.community",
    tags: ["Community", "Tech"],
  },
  {
    id: "sdoh",
    title: "¿Qué es SDOH?",
    description: "Turning awareness into action. Multimedia campaigns addressing social determinants of health through accelerator programs, bootcamps, and demo days.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/sdoh2.png",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/SDOH+ACCELERATOR+PROGRAM+RECAP_2025.mp4",
    href: "/en/sdoh",
    tags: ["Health", "Impact"],
  },

  {
    id: "learn2ai",
    title: "Learn2AI",
    description: "AI literacy for everyone. Master AI skills through practical learning and hands-on projects. Turn knowledge into real-world results and future opportunities.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/ai2.png",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/Learn2ai.svg",
    bgColor: "bg-neutral-50",
    href: "https://www.learn2ai.co/",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/Learn2AI+-+081825+G.mp4",
    tags: ["AI", "Education"],
  },
  {
    id: "adornthebay",
    title: "Adorn the Bay",
    description: "Revitalize Tampa Bay area businesses, non-profits, and municipal facilities that have been damaged or destroyed by recent hurricanes.",
    size: "tall",
    image: "https://ampd-asset.s3.us-east-2.amazonaws.com/work/adornbay.png",
    bgColor: "bg-sky-50",
    href: "https://adornmurals.com/home",
    videoUrl: "https://ampd-asset.s3.us-east-2.amazonaws.com/ampd.mp4",
    tags: ["Murals", "Art"],
  },
]

// ─── Grid helpers ─────────────────────────────────────────────────────────────

function getGridClasses(size: BentoSize) {
  // Mobile: all items uniform (1×1). Desktop: original bento sizing.
  switch (size) {
    case "lg":
      return "lg:col-span-2 lg:row-span-2"
    case "wide":
      return "lg:col-span-2"
    case "tall":
      return "lg:row-span-2"
    case "md":
    case "sm":
    default:
      return ""
  }
}

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({
  videoUrl,
  title,
  aspectRatio = "16:9",
  onClose,
}: {
  videoUrl: string
  title: string
  aspectRatio?: "16:9" | "4:5"
  onClose: () => void
}) {
  const isPortrait = aspectRatio === "4:5"
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = "unset"
    }
  }, [onClose])

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
      <motion.div
        className={`relative overflow-hidden bg-black ${
          isPortrait
            ? "w-full max-w-sm aspect-4/5"
            : "w-full max-w-4xl aspect-video"
        }`}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-white/60 hover:text-white p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors duration-200"
          aria-label="Close video"
        >
          <XIcon className="w-5 h-5" />
        </button>
        <video
          src={videoUrl}
          autoPlay
          controls
          playsInline
          className="w-full h-full object-cover"
          aria-label={`${title} video`}
        />
      </motion.div>
    </motion.div>
  )
}

// ─── Bento Card ───────────────────────────────────────────────────────────────

function BentoCard({
  item,
  onPlayVideo,
}: {
  item: BentoItem
  onPlayVideo: (videoUrl: string, title: string, aspectRatio?: "16:9" | "4:5") => void
}) {
  const isDarkCard = !!item.image || !!item.logoDark

  const handleClick = () => {
    if (item.videoUrl) {
      onPlayVideo(item.videoUrl, item.title, item.videoAspectRatio)
    }
  }

  const descClamp =
    item.size === "lg" || item.size === "tall"
      ? "line-clamp-3"
      : "line-clamp-2"

  const inner = (
    <div
      className={`group relative w-full h-full overflow-hidden ${
        item.image ? "bg-neutral-950" : item.bgColor || "bg-neutral-950"
      }`}
    >
      {/* Background image */}
      {item.image && (
        <img
          src={item.image}
          alt=""
          draggable={false}
          loading={item.priority ? "eager" : "lazy"}
          fetchPriority={item.priority ? "high" : "auto"}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ objectPosition: item.imagePosition || 'center' }}
        />
      )}

      {/* Image gradient overlay */}
      {item.image && (
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />
      )}

      {/* Hover darken overlay for readability */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 z-1" />

      {/* Logo centered (logo-only cards) */}
      {item.logo && !item.image && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <img
            src={item.logo}
            alt={`${item.title} logo`}
            className="max-h-12 md:max-h-16 w-auto object-contain opacity-60 group-hover:opacity-100 transition-opacity duration-300"
            draggable={false}
          />
        </div>
      )}

      {/* Mobile logo overlay — items with both logo + image */}
      {item.logo && item.image && (
        <div className="absolute inset-0 flex items-center justify-center z-3 bg-black/30 lg:hidden">
          <img
            src={item.logo}
            alt={`${item.title}`}
            className="max-h-10 w-auto object-contain drop-shadow-lg"
            draggable={false}
          />
        </div>
      )}

      {/* Text-only title */}
      {!item.logo && !item.image && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <h3
            className={`font-ggx88 font-black text-xl md:text-2xl tracking-tighter leading-none text-center ${
              isDarkCard ? "text-white/80" : "text-neutral-800"
            }`}
          >
            {item.title}
          </h3>
        </div>
      )}

      {/* Play icon */}
      {item.videoUrl && (
        <div className="absolute top-3 right-3 z-10 ">
          <div className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <PlayIcon className="w-3 h-3 text-white fill-white" />
          </div>
        </div>
      )}

      {/* External link arrow */}
      {item.href && !item.videoUrl && (
        <div className="absolute top-3 right-3 z-10 ">
          <ArrowUpRightIcon
            className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
              isDarkCard ? "text-white/50" : "text-neutral-400"
            }`}
          />
        </div>
      )}

      {/* Hover info overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out">
        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <p
            className={`font-geist-sans text-[10px] font-medium tracking-widest uppercase mb-1.5 ${
              isDarkCard || item.image
                ? "text-white/60"
                : "text-white/60"
            }`}
          >
            {item.tags.join(" · ")}
          </p>
        )}

        {/* Title (when logo or image present) */}
        {(item.image || item.logo) && (
          <h3
            className={`font-geist-sans text-sm font-semibold leading-tight tracking-tight ${
              isDarkCard || item.image
                ? "text-white"
                : "text-white"
            }`}
          >
            {item.title}
          </h3>
        )}

        {/* Description */}
        <p
          className={`font-geist-sans text-xs leading-normal mt-1 ${descClamp} ${
            isDarkCard || item.image
              ? "text-white/70"
              : "text-white/70"
          }`}
        >
          {item.description}
        </p>
      </div>
    </div>
  )

  if (item.videoUrl) {
    return (
      <button
        onClick={handleClick}
        className="cursor-pointer text-left w-full h-full"
        aria-label={`Play ${item.title} video`}
      >
        {inner}
      </button>
    )
  }

  if (item.href) {
    const isExternal = item.href.startsWith("http")
    return (
      <Link
        href={item.href}
        className="block w-full h-full"
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {inner}
      </Link>
    )
  }

  return <div className="w-full h-full">{inner}</div>
}

// ─── Page Client ──────────────────────────────────────────────────────────────

export default function WorkClient() {
  const [activeVideo, setActiveVideo] = useState<{
    url: string
    title: string
    aspectRatio?: "16:9" | "4:5"
  } | null>(null)

  const handlePlayVideo = useCallback((url: string, title: string, aspectRatio?: "16:9" | "4:5") => {
    setActiveVideo({ url, title, aspectRatio })
  }, [])

  const handleCloseVideo = useCallback(() => {
    setActiveVideo(null)
  }, [])

  return (
    <>
      <main className="min-h-dvh bg-white text-neutral-950">
        {/* Header */}
        <div className="pt-28 md:pt-36 pb-12 md:pb-16 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <p className="font-geist-sans text-xs font-medium tracking-widest uppercase text-neutral-400 mb-4">
                Build Your Impact
              </p>
              <h1 className="font-ggx88 font-black text-neutral-950 text-5xl md:text-6xl lg:text-7xl tracking-tighter leading-[0.92] mb-5">
                Work That Matters
              </h1>
              <p className="font-geist-sans text-neutral-500 text-lg md:text-xl font-normal leading-relaxed tracking-tight max-w-2xl mb-8">
                Where creativity meets community. A portfolio of brand
                narratives, immersive events, and campaigns designed to
                challenge the status quo.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 font-geist-sans text-sm font-medium text-white bg-neutral-950 px-5 py-2.5 rounded-md hover:bg-neutral-800 transition-colors duration-200"
              >
                Work with us
                <ArrowUpRightIcon className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Grid Section */}
        <div className="px-6 lg:px-8 pt-12 md:pt-0 pb-20 md:pb-28">
          <div className="max-w-7xl mx-auto relative">
            {/* Grid with visible 1px line structure */}
            <div className="bg-neutral-200 p-px">
              <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[160px] lg:auto-rows-[200px] gap-px">
                {bentoItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{
                      duration: 0.5,
                      delay: Math.min(index * 0.03, 0.3),
                    }}
                    className={getGridClasses(item.size)}
                  >
                    <BentoCard item={item} onPlayVideo={handlePlayVideo} />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Video Modal */}
      <AnimatePresence>
        {activeVideo && (
          <VideoModal
            videoUrl={activeVideo.url}
            title={activeVideo.title}
            aspectRatio={activeVideo.aspectRatio}
            onClose={handleCloseVideo}
          />
        )}
      </AnimatePresence>
    </>
  )
}
