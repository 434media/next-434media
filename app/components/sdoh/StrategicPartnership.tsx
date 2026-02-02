"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useInView } from "motion/react"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface StrategicPartnershipProps {
  locale: Locale
  dict: Dictionary
}

/**
 * StrategicPartnership - VelocityTX & Methodist Healthcare Ministries partnership section
 * 
 * Displays partnership logos and introduces the three core components.
 */
export function StrategicPartnership({ locale, dict }: StrategicPartnershipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const partnershipDict = dict?.sdoh?.partnership || {
    label: "STRATEGIC PARTNERSHIP",
    velocityAlt: "VelocityTX Logo",
    methodistAlt: "Methodist Healthcare Ministries Logo",
  }

  return (
    <section ref={ref} className="py-20 sm:py-28 lg:py-32 bg-neutral-50 relative overflow-hidden">
      {/* Background accent */}
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
        <motion.div
          className="relative bg-white py-10 sm:py-12 lg:py-16 px-6 sm:px-8 lg:px-12 border border-neutral-200"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          {/* Accent lines */}
          <div className="absolute top-0 left-0 w-full h-1 bg-[#A31545]" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B35]" />

          <div className="relative max-w-5xl mx-auto">
            {/* Badge */}
            <div className="text-center mb-6 sm:mb-8">
              <motion.div 
                className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-neutral-900 text-white text-sm sm:text-base font-bold tracking-wider"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="w-2 h-2 bg-[#FF6B35] rounded-full mr-2 sm:mr-3" />
                {partnershipDict.label}
              </motion.div>
            </div>

            {/* Title */}
            <motion.h2 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-8 sm:mb-10 text-neutral-900 leading-tight text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {locale === "es" ? "Impulsado por" : "Powered by"}
            </motion.h2>

            {/* Partner Logos */}
            <motion.div 
              className="relative mb-8 sm:mb-10"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="relative flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-16">
                <Link
                  href="https://velocitytx.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-80 transition-opacity duration-300"
                >
                  <div className="relative h-28 sm:h-32 lg:h-36 w-72 sm:w-80 lg:w-96">
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/Sponsor+Logos/VelocityTX+Logo+BUTTON+RGB.png"
                      alt={partnershipDict.velocityAlt ?? "VelocityTX Logo"}
                      fill
                      className="object-contain"
                    />
                  </div>
                </Link>

                <div className="flex lg:flex-col items-center gap-4">
                  <div className="w-16 lg:w-px h-px lg:h-16 bg-neutral-300" />
                  <div className="w-4 h-4 bg-[#FF6B35] rounded-full" />
                  <div className="w-16 lg:w-px h-px lg:h-16 bg-neutral-300" />
                </div>

                <Link
                  href="https://mhm.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:opacity-80 transition-opacity duration-300"
                >
                  <div className="relative h-28 sm:h-32 lg:h-36 w-72 sm:w-80 lg:w-96">
                    <Image
                      src="https://ampd-asset.s3.us-east-2.amazonaws.com/mhm.png"
                      alt={partnershipDict.methodistAlt ?? "Methodist Healthcare Ministries Logo"}
                      fill
                      className="object-contain"
                    />
                  </div>
                </Link>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <p className="text-base sm:text-lg md:text-xl leading-relaxed text-neutral-700 mb-4 sm:mb-6">
                {locale === "es" ? (
                  <>
                    En asociación con VelocityTX y Methodist Healthcare Ministries, el programa Community Health
                    Accelerator conecta educación, emprendimiento e innovación a través de{" "}
                    <span className="font-bold text-[#A31545]">tres componentes principales</span>.
                  </>
                ) : (
                  <>
                    In partnership with VelocityTX and Methodist Healthcare Ministries, the Community Health
                    Accelerator program connects education, entrepreneurship, and innovation through{" "}
                    <span className="font-bold text-[#A31545]">three core components</span>.
                  </>
                )}
              </p>

              <div className="inline-flex items-center px-5 py-2 bg-neutral-100 text-neutral-900 text-base font-medium border border-neutral-200">
                <div className="w-2 h-2 bg-[#A31545] rounded-full mr-2" />
                {locale === "es" ? "Descubre cada componente a continuación" : "Discover each component below"}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
