"use client"

import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { ContactForm } from "../components/ContactForm"
import { Sparkles, Video, MessageSquare } from "lucide-react"

const trustedByLogos = [
  {
    name: "VelocityTX",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+MAIN+RGB+(1).png",
  },
  {
    name: "Builders VC",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/builders-dark.svg",
  },
  {
    name: "The Health Cell",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell.png",
  },
  {
    name: "Mission Road Ministries",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/missionroad.svg",
  },
  {
    name: "Univision",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/univision-logo.svg",
  },
  {
    name: "Methodist Healthcare Ministries",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png",
  },
  {
    name: "Akshar Staffing",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/vemos-vamos/Akshar-Staffing.png",
  },
  {
    name: "Alamo Angels",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/angels.png",
  },
  {
    name: "Tech Bloc",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/healthcell-2-techbloc.png",
  },
]

export function ContactPageClient() {
  const [mounted, setMounted] = useState(false)

  const services = [
    {
      icon: Sparkles,
      text: "ROI-driven media strategies that deliver measurable results",
    },
    {
      icon: MessageSquare,
      text: "Brand storytelling that connects with your audience",
    },
    {
      icon: Video,
      text: "Video production and event coverage that captivates",
    },
  ]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Ensure page starts at top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900 overflow-hidden">
      <div className="relative min-h-[100dvh] flex items-center py-8 lg:py-12">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50" />
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, gray 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-20 items-start">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8 lg:space-y-10 mt-16 sm:mt-20 lg:mt-0"
            >
              {/* Main Headline */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-5 lg:space-y-6"
              >
                <motion.h1
                  className="text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight"
                  transition={{ duration: 0.3 }}
                >
                  <motion.span
                    className="block"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    Take the
                  </motion.span>
                  <motion.span
                    className="block text-gray-900"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    next step
                  </motion.span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7 }}
                  className="text-lg sm:text-xl text-gray-600 leading-relaxed font-normal max-w-lg"
                >
                  We partner with venture capital firms, accelerators, startups, and industry leaders to create{" "}
                  <span className="text-gray-900 font-medium">bold, strategic content</span> that delivers results.
                </motion.p>
              </motion.div>

              {/* Services List */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.9 }}
                className="space-y-5"
              >
                <motion.h2
                  className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight"
                  transition={{ duration: 0.3 }}
                >
                  What we specialize in
                </motion.h2>
                <ul className="space-y-4">
                  {services.map((service, index) => (
                    <motion.li
                      key={index}
                      className="flex items-start gap-4"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 1.0 + 0.15 * index }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mt-0.5">
                        <service.icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <span className="flex-1 text-base text-gray-600 leading-relaxed font-normal">{service.text}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              {/* Trust Indicator - Logo Carousel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.5 }}
                className="pt-6 border-t border-gray-100"
              >
                <p className="text-sm text-gray-500 font-normal mb-4">
                  Trusted by <span className="font-medium text-gray-700">leading organizations</span>
                </p>
                <div className="relative overflow-hidden">
                  {/* Gradient masks for smooth fade effect */}
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                  
                  <motion.div
                    className="flex items-center gap-8"
                    animate={{
                      x: [0, -1200],
                    }}
                    transition={{
                      x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 25,
                        ease: "linear",
                      },
                    }}
                  >
                    {/* Double the logos for seamless loop */}
                    {[...trustedByLogos, ...trustedByLogos].map((company, index) => (
                      <div
                        key={`${company.name}-${index}`}
                        className="flex-shrink-0 h-8 flex items-center justify-center"
                      >
                        <img
                          src={company.logo}
                          alt={`${company.name} logo`}
                          className="h-6 md:h-8 w-auto object-contain opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300"
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-8 lg:mt-0"
            >
              <div className="relative">
                <ContactForm
                  isVisible={mounted}
                  className="relative z-10 w-full"
                />             
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
