"use client"
import { motion, useScroll, useTransform } from "framer-motion"
import { useState, useRef } from "react"
import { Vortex } from "./vortex"
import Image from "next/image"

const trustedByIcons = [
  {
    name: "VelocityTX",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+MAIN+RGB+(1).png",
    website: "https://velocitytx.org/",
  },
  {
    name: "Alt Bionics",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/altbionics.png",
    website: "https://www.altbionics.com/",
  },
  {
    name: "The Health Cell",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell.png",
    website: "https://thehealthcell.org/",
  },
  {
    name: "Mission Road Ministries",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/missionroad.svg",
    website: "https://www.missionroadministries.org/",
  },
  {
    name: "Univision",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/univision-logo.svg",
    website: "https://www.univision.com/",
  },
  {
    name: "Methodist Healthcare Ministries",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png",
    website: "https://www.mhm.org/",
  },
  {
    name: "Akshar Staffing",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/vemos-vamos/Akshar-Staffing.png",
    website: "https://www.aksharstaffing.com/",
  },
  {
    name: "Alamo Angels",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/angels.png",
    website: "https://alamoangels.com/",
  },
  {
    name: "Tech Bloc",
    iconFile: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell-2-techbloc.png",
    website: "https://satechbloc.com/",
  },
]

const TrustedBy = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 360])

  const handleIconClick = (website: string) => {
    window.open(website, "_blank", "noopener,noreferrer")
  }

  return (
    <section className="relative bg-white py-6 md:py-8 lg:py-12 overflow-hidden" id="trusted-by" ref={containerRef}>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8 sm:mb-12 lg:mb-16 max-w-7xl mx-auto"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 -mt-16 md:-mt-10">
            <div className="flex-1 text-center md:text-left order-2 md:order-1 md:pr-8 -mt-10 md:mt-0">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="text-neutral-950 font-ggx88 font-black text-balance text-4xl/[0.9] sm:text-5xl/[0.9] md:text-6xl/[1.1] lg:text-7xl/[1.1] xl:text-9xl/[1.1] tracking-tighter leading-none mb-4 md:mb-6"
                id="portfolio-heading"
              >
                Connecting Enterprises
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                className="text-neutral-600 font-medium text-lg sm:text-xl md:text-2xl lg:text-3xl max-w-2xl leading-snug tracking-tight text-balance"
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
                rotate: rotate,
              }}
              className="w-full md:w-1/2 lg:w-2/3 xl:w-3/4 max-w-none mx-auto order-1 md:order-2 flex items-center justify-center overflow-visible"
              aria-hidden="true"
            >
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONBLACK+(1).png"
                alt="434 Media Globe Icon"
                width={1400}
                height={1400}
                className="w-full h-auto object-cover max-w-[700px] md:max-w-[900px] lg:max-w-[1000px] xl:max-w-[1400px] 2xl:max-w-[1600px]"
              />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="hidden md:block text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl/[0.8] md:text-6xl/[0.8] lg:text-8xl/[0.8] xl:text-9xl/[0.8] font-black text-black mb-4 tracking-tighter">
            Trusted by.
          </h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 border border-gray-200"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          {trustedByIcons.map((item, index) => (
            <motion.button
              key={item.name}
              onClick={() => handleIconClick(item.website)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="relative flex items-center justify-center p-8 md:p-12 lg:p-16 border-r border-b border-gray-200 [&:nth-child(2n)]:border-r-0 md:[&:nth-child(3n)]:border-r-0 transition-colors duration-300 group min-h-[160px] md:min-h-[200px] lg:min-h-[240px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-inset overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              aria-label={`Visit ${item.name} website`}
            >
              {hoveredIndex === index && (
                <div className="absolute inset-0 z-0">
                  <Vortex
                    backgroundColor="#000"
                    particleCount={200}
                    baseHue={120 + index * 60}
                    baseSpeed={0.15}
                    rangeSpeed={1.2}
                    baseRadius={0.8}
                    rangeRadius={1.5}
                    containerClassName="w-full h-full"
                  />
                </div>
              )}

              <div className="relative z-10 w-full h-20 md:h-28 lg:h-32 flex items-center justify-center">
                <img
                  src={item.iconFile || "/placeholder.svg"}
                  alt={`${item.name} logo`}
                  className="w-16 h-16 md:w-24 md:h-24 lg:w-28 lg:h-28 object-contain group-hover:invert transition-colors duration-300"
                />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default TrustedBy
