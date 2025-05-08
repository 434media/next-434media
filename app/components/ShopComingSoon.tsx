"use client"
import Image from "next/image"
import Link from "next/link"
import { motion } from "motion/react"
import { FadeIn } from "../components/FadeIn"
import { useMobile } from "../hooks/use-mobile"

export default function ShopComingSoon() {
  const isMobile = useMobile()

  // Floating elements animation - made larger and more visible
  const floatingElements = [
    { id: 1, x: "15%", y: "20%", size: "w-32 h-32 md:w-48 md:h-48", delay: 0 },
    { id: 2, x: "75%", y: "15%", size: "w-40 h-40 md:w-64 md:h-64", delay: 0.5 },
    { id: 3, x: "25%", y: "70%", size: "w-36 h-36 md:w-56 md:h-56", delay: 1 },
    { id: 4, x: "70%", y: "60%", size: "w-28 h-28 md:w-40 md:h-40", delay: 1.5 },
    { id: 5, x: "45%", y: "40%", size: "w-24 h-24 md:w-32 md:h-32", delay: 2 },
  ]

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-black to-gray-900 overflow-hidden">
      {/* Animated background elements - increased opacity and size */}
      <div className="absolute inset-0 z-0">
        {floatingElements.map((element) => (
          <motion.div
            key={element.id}
            className={`absolute ${element.size} rounded-full bg-gradient-to-r from-blue-500 to-purple-600 blur-xl`}
            style={{ left: element.x, top: element.y }}
            initial={{ opacity: 0.4 }}
            animate={{
              y: ["0%", "10%", "0%"],
              opacity: [0.4, 0.7, 0.4],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              delay: element.delay,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "reverse",
            }}
          />
        ))}

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] bg-repeat opacity-20"></div>
      </div>

      {/* Main content - centered and enlarged */}
      <div className="relative z-10 container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-screen">
        <FadeIn>
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
              className="inline-block mb-8"
            >
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
                alt="434 MEDIA"
                width={isMobile ? 150 : 200}
                height={isMobile ? 150 : 200}
                className="mx-auto"
                priority
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 font-menda-black tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600">
                  SHOP
                </span>{" "}
                <br className="md:hidden" />
                <motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  COMING SOON
                </motion.span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="max-w-2xl mx-auto"
            >
              <p className="text-xl md:text-2xl lg:text-3xl text-gray-300 leading-relaxed">
                We&apos;re crafting an exclusive collection of merchandise that embodies our creative spirit.
              </p>
            </motion.div>

            {/* Animated underline */}
            <motion.div
              className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full mt-12 mx-auto"
              initial={{ width: 0 }}
              animate={{ width: isMobile ? "80%" : "40%" }}
              transition={{ duration: 1.2, delay: 1.2, ease: "easeInOut" }}
            />

            {/* Back to home link */}
            <motion.div
              className="mt-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.5 }}
            >
              <Link
                href="/"
                className="inline-flex items-center text-gray-400 hover:text-white transition-colors duration-200 text-lg"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Home
              </Link>
            </motion.div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
