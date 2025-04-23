"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion } from "motion/react"

// Update the partner logo sizes to be larger
const partners = [
  {
    name: "VelocityTX",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW%2BPartner%2Band%2BSponsors%2BLogos_VelocityTX.png",
    width: 340,
    height: 170,
  },
  {
    name: "Methodist Healthcare Ministries",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW%2BPartner%2Band%2BSponsors%2BLogos_Methodist.png",
    width: 360,
    height: 170,
  },
  {
    name: "Brownsville Community Improvement Corporation",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW%2B-%2BPartner%2BLogos_BCIC.jpg",
    width: 360,
    height: 170,
  },
  {
    name: "UTRGV",
    logo: "https://ampd-asset.s3.us-east-2.amazonaws.com/RGVSW%2B-%2BPartner%2BLogos_UTRGV-03.jpg",
    width: 320,
    height: 170,
  },
]

// Update the PartnerLogos component to add more spacing and improve the layout
export function PartnerLogos() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Update the container and motion div for partner logos
  return (
    <div ref={containerRef} className="relative overflow-hidden w-full lg:mt-16 lg:pt-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 justify-items-center">
        {partners.map((partner, index) => (
          <motion.div
            key={partner.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="flex items-center justify-center p-2 sm:p-4 transition-all duration-300 z-10"
            whileHover={{ scale: 1.05 }}
          >
            <Image
              src={partner.logo || "/placeholder.svg"}
              alt={`${partner.name} logo`}
              width={partner.width}
              height={partner.height}
              className="h-auto w-auto max-w-[180px] sm:max-w-[220px] md:max-w-[280px]"
              priority={index < 2} // Load the first two images with priority
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
